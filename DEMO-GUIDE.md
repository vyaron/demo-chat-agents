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
> "Two tickets created. CHAT-BE is blocked — it depends on the frontend
> agent finishing and defining the API contract first."

### Frontend Agent (4–5 min)

> "The orchestrator now launches the frontend agent with CHAT-FE."

The agent runs in the terminal. Talk through what it's doing as it streams:
- Scaffolding React + Vite
- Building components
- Writing tests
- Running Playwright

> "Notice — it defines the API contract before the backend exists.
> The frontend agent owns the API shape."

When tests pass, the agent prints `STATUS: DONE`.

### Backend Agent (3–4 min)

> "Frontend agent reported done. Orchestrator automatically unblocks CHAT-BE
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
