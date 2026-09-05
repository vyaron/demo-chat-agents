# @ai Mention — Claude Replies in the Conversation

**Status:** draft
**Owner:** Orchestrator Agent
**Last updated:** 2026-08-31

---

## Goal

When a user sends a message containing `@ai`, the backend calls Claude and posts the
reply back into the same conversation as a normal message — persisted to Supabase and
pushed to every client in the room over the existing socket. The reply is written in a
British-butler voice supplied as the system prompt.

This adds the product's first non-human participant. Nothing about the chat-list,
top bar, search, or typing indicator changes.

---

## Scope

### Backend (`stack:full` — this task carries the marker)

- New `backend/src/lib/ai.ts`:
  - `hasAiMention(content: string): boolean` — detects the `@ai` trigger.
  - `generateAiReply(history, prompt): Promise<string>` — one call to the Claude
    Messages API via the official `@anthropic-ai/sdk`.
- Wire it into the **socket `send_message` handler** (`backend/src/socket/chat.ts`),
  after the user's message is persisted:
  1. persist the user message and broadcast it (unchanged behaviour),
  2. if `hasAiMention(content)`, fetch recent conversation history,
  3. call Claude, insert the reply as a `messages` row with `sender_id: "ai"`,
  4. `io.to(conversationId).emit("new_message", reply)` — **`io`, not `socket.to`**,
     so the sender sees it too (the sender only optimistically rendered its own text).
- Emit `ai_typing` to the room while the call is in flight, so the existing typing
  indicator covers the wait.
- `ANTHROPIC_API_KEY` added to `backend/.env.example` as a placeholder only. The real
  key goes in the gitignored `backend/.env` and is never committed.
- Vitest coverage for `ai.ts` with the SDK mocked, plus the failure paths.

### Frontend

- None. The AI reply arrives as an ordinary `Message` on the existing `new_message`
  socket event and renders through `MessageBubble` unchanged.
- One exception if Q2 is answered "yes": a listener for `ai_typing` alongside the
  existing `user_typing` handler.

### Database

- **No schema change.** `sender_id` and `sender_name` are plain text with no foreign
  key (`backend/supabase/schema.sql`), so `"ai"` is a valid sender as-is.

### Docs

- Add `ai` to `.doc/glossary.md` as the canonical short term (never `assistant`,
  `bot`, or `agent` — `agent` already means a dev-loop sub-agent in this repo).
- Update `.doc/architecture.md`: Anthropic is a new external dependency on the
  message-send path.

---

## Assumptions

1. The trigger is a literal, case-insensitive `@ai` token bounded by whitespace or
   string edges — `@ai`, `@AI`, `hey @ai what's up`. Not `@aisle`, not `email@ai.com`.
2. The socket path is the only entry point that needs wiring. `POST /api/conversation/:id/messages`
   exists but the UI sends over the socket (`frontend/src/lib/socket.ts:29`), so REST
   stays unchanged this task.
3. Conversation history sent to Claude is capped at the **last 20 messages** — enough
   for context, bounded cost, well inside the context window.
4. One reply per triggering message. The AI never replies to its own messages, so
   `@ai` inside an AI reply cannot start a loop.
5. Model is `claude-opus-5` with `output_config: { effort: "low" }` and adaptive
   thinking left on (the default on this model). Low effort keeps a chat reply snappy;
   explicitly disabling thinking is avoided because on this model that can leak
   `<thinking>` tags into visible output.
6. `max_tokens: 1024` — a chat reply, not an essay. Non-streaming: the reply is
   persisted whole before it is broadcast, so there is nothing to stream to.
7. Failures degrade silently in the thread: the user's own message is already saved
   and broadcast, so a Claude failure must never roll that back.

---

## Open Questions

**Q1 Answer: "british butler"**

**Q2 — Show a typing indicator while Claude is thinking?**
A reply can take a few seconds; without a signal the thread looks frozen.
*Recommended:* **Yes.** Emit `ai_typing` to the room on call start. It reuses the
existing indicator component and is ~5 lines of frontend. If declined, the backend
work is unchanged and the frontend scope drops to zero.

**Q3 — What happens on a Claude failure (timeout, 429, 500, missing key)?**
*Recommended:* log the failure server-side in the existing structured shape
(`backend/src/lib/error.ts` sets the precedent — category, requestId, operation) and
emit `ai_error` to the room with a safe, generic message. Do **not** persist an error
message into the conversation — an error is not chat history, and a persisted one
would pollute the thread and any later search. The user's message stays saved.

**Q4 — Is the AI reply visually distinct from a human message?**
*Recommended:* **No, not in v1.** It is left-aligned in white like any other sender,
labelled by `sender_name`. Distinct styling is a design decision with no Figma frame
behind it — defer until there is one.

---

## Steps

### Phase 1 — API contract (Backend Agent)

1. Record in `.orchestrate/api-contract.yaml` that this task adds **no HTTP route**.
   The contract change is on the socket surface: existing `new_message` gains AI-authored
   payloads (same `Message` shape, `sender_id: "ai"`), plus new server→client events
   `ai_typing` and `ai_error`.

### Phase 2 — Backend implementation (Backend Agent)

1. `npm --prefix backend install @anthropic-ai/sdk`.
2. Add `ANTHROPIC_API_KEY` to `backend/.env.example` with a placeholder value.
3. Write `backend/src/lib/ai.ts`:
   - `AI_SYSTEM_PROMPT` constant (pending Q1),
   - `AI_SENDER = { id: "ai", name: "AI" }`,
   - `hasAiMention()` — anchored, case-insensitive match,
   - `generateAiReply()` — `client.messages.create({ model: "claude-opus-5",
     max_tokens: 1024, system: AI_SYSTEM_PROMPT, output_config: { effort: "low" },
     messages })`, mapping history to alternating turns and narrowing `content` blocks
     by `type === "text"` before reading `.text`.
   - Guard `stop_reason === "refusal"` before reading `content` — on this model a
     refusal returns HTTP 200 with empty content, and indexing `content[0]` would throw.
4. Wire into `backend/src/socket/chat.ts` per the Scope section. Keep the AI branch
   after the existing insert/broadcast so the user's message is never blocked by it.
5. Failure path per Q3: catch, log structured, emit `ai_error`, never throw into the
   socket handler.
6. Tests in `backend/tests/`: `hasAiMention` truth table (including `@aisle` and
   `email@ai.com` negatives), reply insertion shape, refusal handling, API-failure
   handling, and that a Claude failure leaves the user's message persisted.

### Phase 3 — Frontend (Frontend Agent, only if Q2 = yes)

1. Listen for `ai_typing` next to the existing `user_typing` handler and drive the
   existing indicator. Clear it when the matching `new_message` arrives.
2. One Vitest case for the listener.

### Phase 4 — QA (QA Agent)

Run the Validation checklist below against the plan and the acceptance criteria in
`.doc/product-definition.md`.

---

## Validation

Each item is provable by a test or a command.

- [ ] `hasAiMention` returns true for `@ai`, `@AI`, `hey @ai there`; false for
      `@aisle`, `email@ai.com`, `ai`, and empty string — unit test.
- [ ] A socket `send_message` containing `@ai` inserts **two** rows: the user's
      message, then one with `sender_id: "ai"` — integration test with the SDK mocked.
- [ ] A socket `send_message` **without** `@ai` inserts exactly one row and makes zero
      Anthropic calls — unit test asserting the mock was not called.
- [ ] The AI reply is emitted with `io.to(room)`, not `socket.to(room)` — asserted on
      the mock, so the sending client receives it.
- [ ] When the Anthropic call rejects, the user's message is still persisted and
      broadcast, and `ai_error` is emitted — unit test.
- [ ] When Claude returns `stop_reason: "refusal"`, no message row is inserted and
      nothing throws — unit test.
- [ ] History sent to Claude is capped at 20 messages — unit test on the mock's args.
- [ ] `ANTHROPIC_API_KEY` appears in `backend/.env.example` and **not** in any tracked
      file with a real value: `git grep -n "sk-ant"` returns nothing.
- [ ] `cd backend && npm test` passes.
- [ ] `cd frontend && npm test` passes (unchanged, proves no regression).
- [ ] `cd frontend && npx playwright test` passes (unchanged; the e2e suite has no
      Anthropic key and must not start requiring one).
- [ ] `cd backend && npm run build` and `cd frontend && npm run build` are clean.
- [ ] `node verify-guardrails.mjs` passes — this task changes no hook, but it is the
      repo's standing check that the boundaries still hold.
- [ ] `ai` is documented in `.doc/glossary.md`.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| A leaked `ANTHROPIC_API_KEY` is a billable secret | `.env` is gitignored; only a placeholder ships in `.env.example`; a `git grep` for `sk-ant` is in the Validation list |
| Claude latency makes the thread look frozen | `ai_typing` indicator (Q2); `effort: "low"` and `max_tokens: 1024` keep replies short |
| Reply loop — the AI triggers itself | The AI branch runs only in the `send_message` handler for client-sent messages; the AI's own insert never re-enters it |
| An Anthropic outage breaks chat | The AI branch runs strictly after the user's message is persisted and broadcast; failures are caught and never rethrown into the socket handler |
| Runaway cost from a chatty room | 20-message history cap, `max_tokens: 1024`, one reply per triggering message. No rate limit in v1 — accepted for a demo app, flagged here as the first thing to add if it goes further |
| Backend Agent edits `frontend/**` | `.claude/hooks/enforce-agent-boundaries.js` blocks it via `AGENT_ROLE`; the Q2 frontend slice is a separate ticket for the Frontend Agent |
| `@ai` inside a *searched* message now returns AI replies too | Expected and harmless — AI replies are ordinary messages and should be searchable |

---

## Rollout Order

1. **Q1 answered** (verbatim vs. corrected system prompt) — blocks Phase 2 only.
2. **Backend**: `ai.ts`, socket wiring, tests.
3. **Frontend**: `ai_typing` listener, only if Q2 = yes.
4. **QA**: full Validation checklist.

Backend leads here — the reverse of the messages-search plan — because the frontend
slice is optional and depends on an event the backend defines.

---

## Rollback

1. Revert the `send_message` handler in `backend/src/socket/chat.ts` to its previous
   form (persist + `socket.to(...).emit`).
2. Delete `backend/src/lib/ai.ts` and its tests.
3. Remove the `ai_typing` listener from the frontend, if it was added.
4. `npm --prefix backend uninstall @anthropic-ai/sdk`.
5. Remove `ANTHROPIC_API_KEY` from `backend/.env.example`.
6. Revert the `.doc/glossary.md` and `.doc/architecture.md` entries.

No database migration ran, so there is nothing to undo in Supabase. Existing AI-authored
rows remain as plain messages from a sender named `AI` and are harmless.

---

## Approval Gate

**Please review this plan. Type APPROVED to proceed, or provide feedback to revise.**
Q1 in particular needs your answer before the Backend Agent starts.
