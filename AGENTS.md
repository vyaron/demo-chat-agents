# Agent Instructions

## communication with me
- Please start all your responses with Hopa!

## Security
- Never commit or expose secrets (tokens, API keys, passwords, cluster credentials, secret values).

## Guardrails (Single Source of Truth)
- Guardrail logic lives in `.claude/hooks/`. It is wired into the runtime by
  `.claude/settings.json`, which is the only location Claude Code reads hook and
  permission config from — a hook script that is not listed there never runs.
- Do not duplicate permission or hook rules in other agent docs.
- If any instruction conflicts with the hooks, the hooks win.
- `dev-loop.js` and `trace-agent.js` set `AGENT_ROLE` when they spawn a sub-agent;
  that is what `.claude/hooks/enforce-agent-boundaries.js` uses to enforce per-role
  write paths. Renaming it on only one side makes the hook fail **open**, silently —
  it exits 0 for an unknown role. Change all three together or none.
- `node verify-guardrails.mjs` drives every hook with real payloads and asserts what
  it blocks. Run it after changing a hook, a role name, or an "Allowed paths" list —
  these hooks fail silently open, so a passing demo proves nothing on its own.
- `.claude/settings.json` names each `.mcp.json` server in `enabledMcpjsonServers`
  instead of setting `enableAllProjectMcpServers`, so adding a server to `.mcp.json`
  stays a deliberate act. Without the entry, the headless agents `dev-loop.js` spawns
  treat the server as "pending approval" and run with none of its tools.

## Repository Layout
- `.doc/` — hand-written product and architecture docs.
- `.claude/rules/` — always-on constraints, imported below. Short by design.
- `.claude/skills/` — procedural know-how, loaded on demand by task.
- `.claude/agents/` — sub-agent definitions used by the dev loop.
- `.claude/hooks/` — guardrail hook implementations, wired by `.claude/settings.json`.
- `.plan/` — `000-backlog.md` is the task queue; `NNN-YYYY-MM-DD-*.md` are the plans.
- `.orchestrate/` — everything the dev loop generates (plan mirror, tickets, agent
  reports, QA report, API contract, cost traces). Never create a `docs/` directory.
- `frontend/` — the Vite + React + TypeScript app. Not Next.js: there is no App Router
  and no `src/app/`.
- `backend/` — the Express + socket.io API, backed by Supabase. It already exists.
  Only a backlog task explicitly marked `stack:full` may change it — `dev-loop.js`
  reads that marker and skips the Backend Agent entirely on a frontend-only task.

## Rules — always in context
@.claude/rules/code-style.md
@.claude/rules/naming.md
@.claude/rules/ui-and-styling.md
@.claude/rules/git-workflow.md

## Skills — load when the task calls for it
| Skill | Use it when |
|---|---|
| `writing-plans` | Creating, revising, or superseding a plan in `.plan/` |
| `writing-tests` | Adding or reviewing unit, integration, or e2e tests |
| `error-handling` | Shaping an error response, status code, retry, or failure UX |
| `database-schema` | Adding or changing a table, column, index, or migration |
| `cutting-a-release` | Choosing a version number or tagging a release |

## Product and Domain
- Product definition and acceptance criteria: `.doc/product-definition.md`.
- Architecture overview: `.doc/architecture.md`.
- Canonical domain terms: `.doc/glossary.md` — document a new shared term there
  before using it broadly.
- Keep these docs updated when API routes, auth/org boundaries, or schema/migrations change.
