# Product Definition — QuickChat

## Purpose
- Define shared product intent so planning, architecture, and delivery stay aligned.
- This file is the source of acceptance criteria. QA marks each criterion PASS/FAIL
  against it, so keep it concrete.

## Product Vision
QuickChat is a real-time, WhatsApp-style messaging app. Users browse a list of
conversations and exchange messages that appear instantly for everyone in the thread.

## Target Users
- Primary: someone catching up on personal conversations on phone or desktop, who
  expects a message to land the moment it is sent.
- Secondary: the course audience watching this app get built by a multi-agent loop —
  the codebase doubles as the teaching artifact, so clarity beats cleverness.

## Problem Statement
Messaging only feels usable when it is immediate. A chat UI that requires a refresh to
show a new message, or that loses the thread on reconnect, reads as broken no matter how
correct the underlying data is. QuickChat's job is to make send → appear → sync feel
instant and never lose a message in the process.

## Value Proposition
- Message delivery is optimistic locally and confirmed over the socket, so the UI never
  waits on the network to feel responsive.
- One coherent thread view across devices and tabs.

## Product Scope

### In scope
- **Screen 1 — Chat list**: header (`QuickChat` + avatar), search box, and a list of
  conversations showing avatar, name, truncated last-message preview, timestamp, and an
  unread badge when `unread_count > 0`. Selecting a conversation opens Screen 2.
- **Screen 2 — Conversation**: back arrow, contact avatar, name, online indicator; a
  scrollable message list with own messages right-aligned in green (`#25D366`) and others
  left-aligned in white; per-bubble `HH:MM` timestamp; date separators ("Today",
  "Yesterday"); a pinned input with placeholder "Message" and a send button enabled only
  when the input is non-empty; a typing indicator above the input.

### Out of scope (v1)
- User authentication, push notifications, message reactions and read receipts,
  media attachments, group chats, and the "New chat" screen.

## Functional Requirements
| ID | Requirement |
|----|-------------|
| F1 | User sees a list of existing conversations on app load |
| F2 | User can open a conversation and see message history |
| F3 | User can type and send a message |
| F4 | Sent message appears immediately in the conversation (optimistic update) |
| F5 | Message is persisted to Supabase |
| F6 | Others in the same conversation receive the message in real time via WebSocket |
| F7 | Typing indicator is shown when the other user is typing |
| F8 | App works on desktop (1280px+) and mobile (375px+) |

## Non-Functional Requirements
- First meaningful paint under 2 seconds on a local network.
- No full-page reload when moving between screens.
- Graceful WebSocket failure: show a "Reconnecting…" banner rather than failing silently.

## Acceptance Criteria
QA marks each PASS/FAIL with evidence. The **Needs** column says what has to exist for the
criterion to be testable — on a frontend-only task, criteria needing a backend are recorded
as "not applicable, frontend-only task" rather than FAIL.

| ID | Criterion | Needs |
|----|-----------|-------|
| AC-1 | On load, at least 2 conversations are visible in the list | frontend |
| AC-2 | Opening a conversation shows the correct message history | frontend |
| AC-3 | Sending a message adds it to the list without a page reload | frontend |
| AC-4 | The sent message is stored in the Supabase `messages` table | backend |
| AC-5 | A second browser tab shows a message sent from the first | backend |
| AC-6 | Typing in the input shows a typing indicator in the other tab | backend |
| AC-7 | The UI matches the Figma design (colors, spacing, structure) | frontend |
| AC-8 | All frontend unit tests pass (`cd frontend && npm test`) | frontend |
| AC-9 | All backend API tests pass | backend |
| AC-10 | Playwright e2e covers AC-3, and AC-5 once a backend exists | frontend |

## Data Model (proposed)
```
conversations
  id              uuid PK
  name            text
  avatar_url      text
  created_at      timestamptz

messages
  id              uuid PK
  conversation_id uuid FK -> conversations.id
  sender_id       text        (plain string for the demo — no auth)
  sender_name     text
  content         text
  created_at      timestamptz
```
These field names are snake_case on purpose: they match `frontend/src/types/index.ts`,
which the UI already consumes.

## Constraints and Assumptions
- Frontend is Vite + React 18 + Tailwind v4; realtime is `socket.io-client` pointed at
  `import.meta.env.VITE_API_URL` (dev default `http://localhost:3001`).
- There is no `backend/` directory until a backlog task marked `stack:full` creates one.
  Until then F5–F7 and AC-4/5/6/9 are unimplemented by design.
- No auth: `sender_id` is a plain string.

## Prioritization Rules
- Prioritize work that most improves user outcomes and core metrics.
- Prefer changes that reduce operational complexity and support costs.
- Defer low-impact features unless required for launch readiness.

## Update Triggers
- Update this file when core user segments, product scope, or acceptance criteria change.
