# QuickChat Live Demo — Presenter Guide

## Before the Session (30 min setup)

### 1. Supabase
- Create a free project at supabase.com
- Go to SQL Editor → paste `backend/supabase/schema.sql` → Run
- Copy Project URL + service_role key (Settings → API)

### 2. Environment
```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
```

### 3. Install dependencies
```bash
cd frontend && npm install
cd ../backend && npm install
```

### 4. Pre-run test (night before!)
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Open http://localhost:5173 — verify chat list appears
```

### 5. Figma
- Duplicate the Figma file to your workspace
- Add your Figma URL to the dev-loop.js FIGMA_URL or set env var

### 6. Linear
- Have your Linear workspace open in browser
- Set LINEAR_API_KEY and LINEAR_TEAM_ID env vars (or --linear-key / --linear-team flags)
- Linear API key: Settings → API → Personal API keys

### 7. VSCode / Terminal setup
- Open the `demo-chat/` folder in VSCode
- Open 3 terminal panes: Orchestrator | Frontend | Backend
- Font size 18+ for audience readability

---

## On Stage — Step-by-Step Script

### Opening (2 min)
> "We have a PRD and Figma designs. Normally this would take a dev team a week.
> Watch what happens when we have an agent team instead."

Show:
- `.doc/product-definition.md` briefly (the requirements)
- The Figma designs briefly

### Run the Orchestrator (3 min)

In Terminal 1 (Orchestrator pane):
```bash
node dev-loop.js \
  --figma "YOUR_FIGMA_URL" \
  --linear-team "YOUR_TEAM_ID" \
  --linear-key "YOUR_API_KEY"
```

The orchestrator will:
1. Read the PRD
2. Print the implementation plan
3. **PAUSE** — waiting for your approval

> "See this? The agent stops and waits. It won't proceed without human sign-off.
> This is the plan gate — I'm the Orchestrator now."

Read the plan out loud (30 seconds), then type:
```
APPROVED
```

### Linear Tickets (1 min)

The script creates tickets. Switch to browser — show Linear.

**Which tickets appear depends on the task's scope.** A backlog line marked
`| stack:full` gets FE + BE + QA; anything else gets FE + QA only, and the
Backend Agent never runs. The terminal prints the scope right after it picks
the task, so you can point at it.

The first queued task (`converstaion top bar`) is **frontend-only**:
> "Two tickets — frontend and QA. No backend ticket, because this task never
> touches the server. The backlog line is the switch: no `stack:full` marker,
> no backend agent. Scope is a decision the human makes, not something the
> agents negotiate."

### Frontend Agent (4–5 min)

> "The orchestrator now launches the frontend agent with CHAT-FE."

The agent runs in the terminal. Talk through what it's doing as it streams:
- Reading the Figma frame and the plan
- Building components in the existing Vite app (it does **not** scaffold — the app exists)
- Writing tests
- Running Playwright

> "Notice — it still writes the API contract, even with no backend on this task.
> That's the handoff artifact a later full-stack task picks up.
> The frontend agent owns the API shape."

When tests pass, the agent prints `STATUS: DONE`.

### Backend Agent (3–4 min) — `stack:full` tasks only

**Skipped on the first task.** The terminal says so explicitly:
`Frontend-only task (no 'stack:full' marker) — skipping the Backend Agent.`
That line is worth reading out loud — it's the scope gate working.

To show this stage live, run a second loop iteration on `contact info page` or
`Conversations search`, both marked `stack:full`:

> "Frontend agent reported done. Orchestrator unblocks CHAT-BE
> and launches the backend agent."

Point out the backend agent reading `api-contract.yaml`:
> "It's reading what the frontend agent wrote — not what a human specified."

When backend tests pass: `STATUS: DONE`

### Live App Demo (2 min)

> "Let's see what they built."

Open `http://localhost:5173`:
- Show chat list (2 conversations)
- Open Alice's conversation — show message history
- Type a message — it appears
- Open a second browser window — send from first, appears in second
- Let typing indicator appear

> "WebSocket real-time messaging, persisted to Supabase, tested end to end.
> Built by agents in under 15 minutes."

---

## What to Say at Each Human Checkpoint

**Plan approval:**
> "I'm reading this plan as the Orchestrator. I'm checking:
> does this match what the PRD asks for? Are the tickets scoped correctly?
> I'm satisfied — APPROVED."

**After frontend DONE:**
> "The agent stopped and reported. I can read the report, check the API contract,
> review the components. I'm the quality gate — not a passive observer."

---

## If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| `claude CLI not found` | Script falls back to simulation — demo still works |
| Linear API error | Remove --linear-key flag — script simulates tickets |
| Supabase connection fails | Check .env file; verify schema was run |
| Frontend tests fail | Run `cd frontend && npx vitest run` to see which test |
| Port already in use | `npx kill-port 3001 5173` |

---

## What This Demo Teaches

| Concept | Where it shows up |
|---------|-------------------|
| Spec-Driven Dev | PRD → agent reads it, doesn't guess |
| Agent roles | Frontend can't touch backend dir; backend reads contract only |
| Human checkpoints | Plan approval gate before any code is written |
| The Loop | Tests fail → agent self-fixes → re-runs until pass |
| Handoff notes | Frontend report → backend agent reads it |
| Linear as coordination layer | Tickets link agents to requirements |
