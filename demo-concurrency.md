# Demo — Agent Concurrency: Five Reviewers, One Repo

Five reviewers audit **this repository** at the same time, each through a different
lens, none of them seeing each other's work. A live console beside the Claude window
shows all five working at once.

Prompt-only. The review itself is read-only — the only thing
written is each agent's own progress log, into a gitignored scratch directory.

**Two acts, ~10 minutes.** Act 1 is the spectacle. Act 2 is the point.

---

## Stage Setup

Two panes, side by side. Claude Code on the left, the live console on the right.

**Right pane — start this first and leave it running:**

```bash
mkdir -p .lab && : > .lab/live.log && tail -f .lab/live.log
```

PowerShell equivalent:

```powershell
New-Item -ItemType Directory -Force .lab; Clear-Content -Path .lab\live.log -ErrorAction SilentlyContinue; Get-Content .lab\live.log -Wait
```

Font 18pt or larger. The console is the show — give it real estate.

`.lab/*.log` is already covered by the `*.log` rule in [.gitignore](.gitignore#L11),
so this leaves no diff behind and needs no cleanup.

---

## Act 1 — Launch

Paste this whole block into Claude Code:

````
Audit this repository from five independent perspectives.

In a SINGLE message, issue five Agent tool calls (subagent_type: general-purpose)
so all five run concurrently. Do not run them one at a time.

The five lenses, one per agent:

  [SEC ]  SECURITY       — secrets handling, the .claude/hooks guardrails, the
                           permission model, bypassPermissions in dev-loop.js,
                           the MCP server surface in .mcp.json
  [PERF]  PERFORMANCE    — frontend render and socket behaviour, backend query
                           shape, anything that degrades as messages accumulate
  [A11Y]  ACCESSIBILITY  — frontend/src only: contrast, keyboard paths, focus
                           states, the inline SVG icons, screen reader semantics
  [COST]  COST           — LLM unit economics: what dev-loop.js spends per run,
                           and what backend/src/lib/ai.ts spends per @ai message
  [DOCS]  DOC vs REALITY — does AGENTS.md describe the repo that actually exists?
                           Check its specific claims against the code.

Give every agent these same instructions:

  - You are REVIEWING. Read-only: do not edit or create any file except your own
    log line appends described below. Do not fix anything you find.
  - Ignore node_modules/, dist/, coverage/, test-results/, and .git/ entirely.
  - Stay strictly inside your lens. If you notice something outside it, ignore it.
    Another reviewer has it.

  - LOG AS YOU GO. Before each file you open and on each finding, append one line:

        echo "[TAG ] $(date +%H:%M:%S)  <what you are doing right now>" >> .lab/live.log

    Use your own tag from the list above, keeping the brackets and padding so the
    columns line up. Keep each line under 80 characters. Log at least 8 times —
    this is a live display, silence looks like a hang.

  - IMPORTANT: never write a literal environment-file name into a log line. Say
    "the env file" instead. A repository guardrail inspects every shell command
    and will block the echo itself if it names one.

  - Report back in EXACTLY this format:

        lens: <your lens>

        findings:
          - severity: blocker | major | minor
            what:     <the problem, one line>
            where:    <file:line>
            why:      <the consequence, one line>
            fix:      <what you would change, one line>

        verdict: healthy | needs work | serious problems

  - 3 to 6 findings, ranked most severe first. No preamble.

When all five report, print the five reports one after another. Nothing else yet.
````

**What the room sees:** five agents start together in the task list, and the right
pane immediately fills with interleaved lines from all five lenses — SEC reading a
hook, A11Y reading a component, DOCS reading `AGENTS.md`, all timestamped to the
same second.

> "Nobody is waiting for anybody. Five reviewers, five different questions, one
> pass over the repo."

Let it run. Do not narrate over the console — let people read it.

---

## Act 2 — The Seams

The payoff. Paste as a follow-up once all five have reported:

```
Now cross-reference the five reports.

1. Where do two lenses want INCOMPATIBLE things — where satisfying one reviewer
   breaks another? Name both lenses, state the tension in one sentence, and say
   what a human has to decide.

2. Which findings did exactly ONE lens catch, that no other lens could have?

Do not resolve anything. Surface it.
```

> "That's what five reviewers bought us. Not five opinions — the seams between
> them. One reviewer holding all five instructions would have quietly averaged
> these into a consensus that nobody actually holds."

---

## Presenter Notes

### The moment to watch for

`block-secret-file-access.js` is wired with `matcher: "*"`
([settings.json:18](.claude/settings.json#L18)), so it inspects **every** tool call,
not just Bash. The SECURITY reviewer will very likely try to read `.env` or
`backend/.env` — both exist — and get hard-blocked mid-review.

If it happens, stop and point at it:

> "Our own security reviewer just got stopped by our own guardrail. Nobody wrote
> that rule for this demo — it's been in the repo the whole time, and it doesn't
> care that the thing it's blocking is on our side."

This is the best unscripted beat available. Hope for it.

### Territory each lens should cover

Use these to nudge a reviewer that comes back thin — "did SEC look at how the
sub-agent roles are enforced?" Recovers live and reads as deliberate.

- **SEC** — `AGENTS.md` itself documents that `enforce-agent-boundaries.js` **fails
  open** on an unknown `AGENT_ROLE`; `dev-loop.js` runs sub-agents under
  `bypassPermissions`; two `.env` files exist on disk; `permissions.deny` overlaps
  the hooks but covers less.
- **PERF** — `frontend/src` is only 559 lines across 7 files, so this lens has the
  least to chew on; point it at `lib/socket.ts` and `ChatConversation.tsx` (206
  lines, the biggest component) and at the backend message queries.
- **A11Y** — the WhatsApp palette (`#075E54`), inline SVG icons with no accessible
  names, `ChatInput.tsx`, focus and keyboard paths through `ChatList.tsx`.
- **COST** — `dev-loop.js` spawns a plan agent plus FE/BE/QA agents per backlog
  task and has a `printCostTable()`; `backend/src/lib/ai.ts` fires per `@ai`
  mention. Per-run versus per-message economics are genuinely different shapes.
- **DOCS** — the richest lens here, because `AGENTS.md` makes unusually specific,
  checkable claims: `AGENT_ROLE` must match in three places, `.orchestrate/` is
  generated, never create `docs/`, `frontend/` is Vite and not Next.js,
  `enabledMcpjsonServers` is deliberate. Some will hold. Some may not.

I have not pre-audited these files, so treat the above as *where to look*, not as
a list of known defects. The reviewers will find what they find — that is the
demo, and a lens coming back "healthy" is a legitimate result to read out loud.

### If it goes sideways

| Problem | Fix |
|---|---|
| Agents launch sequentially | The "SINGLE message / five Agent tool calls" line got softened. Re-paste verbatim and add "issue all five in one message." |
| Console stays empty | Agents skipped the logging. Say "keep appending to `.lab/live.log` as you work." Check the tail pane is on the same path. |
| An `echo` gets blocked by the guardrail | The log line named an env file. Expected — see above. Use it, don't fight it. |
| Occasional garbled console line | Five processes appending to one file. Harmless, and honestly it makes the concurrency visible. Say so. |
| A lens returns two thin findings | Nudge from the territory list above. |
| A run stalls | You have four reports. Act 2 works fine on four. |
| Reviewers wander into `dist/` or `coverage/` | Both exist on disk. The prompt excludes them; if one drifts, say "skip build output." |

### Notes

- Cleanup is unnecessary — `.lab/` holds only gitignored `*.log` files, so git
  shows nothing. (`rm -rf` is blocked by `block-destructive-bash.js` anyway. Use
  `rm -r .lab` if you insist.)
- Want *structural* read-only instead of instructed read-only? Swap
  `general-purpose` for `Explore`, which has no write tools — but then the agents
  cannot write log lines either, and you lose the console. Not worth it here.
- Running the SECURITY lens as `subagent_type: security-reviewer` instead makes
  the point that agent *type* is a real choice. It also has no Write tool, so give
  that one a pass on logging.
- Five lenses is a choice, not a limit. `SKEPTICAL PM` — "is the whole dev-loop
  worth it versus just using Claude Code interactively?" — is the spiciest
  available swap-in for this particular repo.

### Timing

| Beat | Minutes |
|---|---|
| Frame it, start the tail pane | 1 |
| Paste Act 1, watch the console | 4 |
| Read the five verdicts | 2 |
| Act 2 — the seams | 3 |
