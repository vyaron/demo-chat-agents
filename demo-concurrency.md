# Demo — Agent Concurrency: Five Reviewers, One Repo

Five reviewers audit **this repository** at the same time, each through a different
lens, none of them seeing each other's work. A live console beside the Claude window
shows all five working at once.

The review itself is read-only — the only thing
written is each agent's own progress log, into a gitignored scratch directory.

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

  - You are REVIEWING. Read-only: do not edit or create any file except the two
    described below — your own log line appends, and your own report file. Do not
    fix anything you find.
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

  - WRITE YOUR REPORT TO DISK before you reply. Save that exact text to
    .lab/<TAG>-report.md, where TAG is your own tag without brackets or padding:
    SEC, PERF, A11Y, COST, DOCS. Then return the same text as your reply.

When all five report, print the five reports one after another. Nothing else yet.
````

**What we see:** five agents start together in the task list, and the right
pane immediately fills with interleaved lines from all five lenses — SEC reading a
hook, A11Y reading a component, DOCS reading `AGENTS.md`, all timestamped to the
same second.

> "Nobody is waiting for anybody. Five reviewers, five different questions, one
> pass over the repo."


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

## Notes

### The moment to watch for

`block-secret-file-access.js` is wired with `matcher: "*"`
([settings.json:18](.claude/settings.json#L18)), so it inspects **every** tool call,
not just Bash. The SECURITY reviewer will very likely try to read `.env` or
`backend/.env` — both exist — and get hard-blocked mid-review.

If it happens:

> "Our own security reviewer just got stopped by our own guardrail. It doesn't
> care that the thing it's blocking is on our side."


### Territory each lens should cover

Use these to nudge a reviewer that comes back thin — "did SEC look at how the
sub-agent roles are enforced?"

- **SEC** — `AGENTS.md` itself documents that `enforce-agent-boundaries.js` **fails
  open** on an unknown `AGENT_ROLE`; `dev-loop.js` runs sub-agents under
  `bypassPermissions`; two `.env` files exist on disk; `permissions.deny` overlaps
  the hooks but covers less.
- **PERF** — `frontend/src` is only ~600 lines across 11 files, so this lens has the
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
| Claude summarizes instead of printing the five reports | The files are still on disk. `cat .lab/*-report.md`, or say "print each report verbatim." |
| Reviewers wander into `dist/` or `coverage/` | Both exist on disk. The prompt excludes them; if one drifts, say "skip build output." |

### Notes

- Cleanup is unnecessary — the whole `.lab/` directory is gitignored
  ([.gitignore](.gitignore#L31)), so git shows nothing after a run. (`rm -rf` is
  blocked by `block-destructive-bash.js` anyway. Use `rm -r .lab` if you insist.)
- The five reports land in `.lab/SEC-report.md` and friends. `cat .lab/*-report.md`
  in the console pane is a cleaner way to read the verdicts out than scrolling the
  Claude pane — and they survive the session, so Act 2 can be re-run later.
- Want *structural* read-only instead of instructed read-only? Swap
  `general-purpose` for `Explore`, which has no Edit or Write tool. It keeps Bash,
  so the log lines and the console still work. The reason not to here is different:
  `Explore` is tuned to *locate* code and reads excerpts rather than whole files,
  so it finds where things are without auditing them. Wrong shape for a review.
- Running the SECURITY lens as `subagent_type: security-reviewer` instead makes
  the point that agent *type* is a real choice. It has Read, Grep, Glob and Bash —
  no Write, so it stays on the console but cannot save its report the normal way.
  Either let that one skip the report file, or tell it to write via Bash heredoc.
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
