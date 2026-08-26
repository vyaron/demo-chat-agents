#!/usr/bin/env node
/**
 * QuickChat Demo Orchestrator Runner — generic dev-loop
 *
 * Loop per backlog item:
 *   1) Pick next task from .plan/000-backlog.md
 *   2) Read relevant Figma frames when available (discovery allowed)
 *   3) Generate plan in .plan/NNN-YYYY-MM-DD-topic.md and request approval
 *   4) Launch FE then BE agents
 *   5) Launch QA / E2E validation
 *   6) Report done and wait for approval
 *   7) Mark backlog item done and continue to next task
 */

import { execSync, spawn } from "child_process"
import dotenv from "dotenv"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs"
import { createInterface } from "readline"

dotenv.config()

const FIGMA_URL = process.env.FIGMA_URL || getArg("--figma") || ""
const LINEAR_KEY = process.env.LINEAR_API_KEY || getArg("--linear-key") || ""
const LINEAR_TEAM = process.env.LINEAR_TEAM_ID || getArg("--linear-team") || ""
const CLAUDE_PERMISSION_MODE = process.env.CLAUDE_PERMISSION_MODE || getArg("--claude-permission-mode") || "bypassPermissions"
const CLAUDE_ALLOWED_TOOLS = process.env.CLAUDE_ALLOWED_TOOLS || getArg("--claude-allowed-tools")

const PLAN_DIR = ".plan"
const BACKLOG_FILE = `${PLAN_DIR}/000-backlog.md`

// Everything the loop generates lives in .orchestrate/ (gitignored, see its
// README). These paths must stay in step with the "Allowed paths" in
// .claude/agents/*.md and ALLOWED_WRITE_PREFIXES in
// .claude/hooks/enforce-agent-boundaries.js — if they drift, the boundary hook
// blocks an agent from writing the very report the loop then waits for.
const ORCHESTRATE_DIR = ".orchestrate"
const LATEST_PLAN_FILE = `${ORCHESTRATE_DIR}/PLAN.md`
const TICKETS_FILE = `${ORCHESTRATE_DIR}/tickets.json`
const FE_REPORT = `${ORCHESTRATE_DIR}/frontend-agent-report.md`
const BE_REPORT = `${ORCHESTRATE_DIR}/backend-agent-report.md`
const QA_REPORT = `${ORCHESTRATE_DIR}/qa-report.md`
const API_CONTRACT = `${ORCHESTRATE_DIR}/api-contract.yaml`
const TRACE_FILE = `${ORCHESTRATE_DIR}/trace.json`

// Sub-agent definitions. Passed with --system-prompt-file (a path), NOT
// --system-prompt (which takes the prompt text itself).
const AGENT_PROMPT = {
  orchestrator: ".claude/agents/orchestrator.md",
  frontend: ".claude/agents/frontend.md",
  backend: ".claude/agents/backend.md",
  qa: ".claude/agents/qa.md",
}

// Cost/observability: one entry per Claude CLI call this loop iteration.
// Populated by recordCost(), printed by printCostTable(), reset per task.
let costLog = []

async function main() {
  banner("QUICKCHAT DEMO — DEV LOOP")

  ensurePlanDirAndBacklog()
  ensureOrchestrateDir()

  const prd = readProductDefinition()
  const linearClient = LINEAR_KEY ? createLinearClient(LINEAR_KEY) : null
  const linearStates = linearClient && LINEAR_TEAM ? await getTeamStates(linearClient, LINEAR_TEAM) : null

  let loopCount = 0
  while (true) {
    const task = getNextBacklogTask()
    if (!task) {
      banner("NO MORE TODO TASKS — LOOP COMPLETE")
      break
    }

    loopCount += 1
    banner(`LOOP ${loopCount} · ${task.title}`)
    log(`Picked task from backlog: ${task.title}`)
    log(`Scope: ${task.scope}${task.isFullStack ? "" : " (no 'stack:full' marker — the Backend Agent will not run)"}`)

    const branchName = `feat/${task.slug}`
    createGitBranch(branchName)

    const planPath = getNextPlanPath(task.slug)
    const planContent = await askClaudeForPlan({
      task,
      prd,
      figmaUrl: task.figmaUrl || FIGMA_URL,
      planPath,
      previousPlans: readAllPlanFiles(),
    })

    writeFileSync(planPath, planContent, "utf-8")
    writeFileSync(LATEST_PLAN_FILE, planContent, "utf-8")
    log(`Plan written: ${planPath}`)
    await reviewPlanUntilApproved({
      task,
      prd,
      figmaUrl: task.figmaUrl || FIGMA_URL,
      planPath,
    })
    await markPlanStatus(planPath, "active")

    let tickets
    if (linearClient && LINEAR_TEAM) {
      tickets = await askClaudeToCreateTickets({ teamId: LINEAR_TEAM, task, planPath })
      if (!tickets) {
        warn("Claude ticket creation failed, falling back to direct Linear API.")
        tickets = await createLinearTickets({ client: linearClient, teamId: LINEAR_TEAM, states: linearStates, task, planPath })
      }
      writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2))
    } else {
      warn("No Linear configured. Using simulated tickets after terminal approval.")
      tickets = simulateTickets(task)
      writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2))
    }

    if (linearClient && linearStates?.inProgress) {
      await updateLinearIssue(linearClient, tickets.frontend.issueId, { stateId: linearStates.inProgress })
    }

    await runAgent({
      systemPrompt: AGENT_PROMPT.frontend,
      input: `You are the Frontend Agent.\nTask: ${task.title}\nLinear ticket: ${tickets.frontend.url}${task.figmaUrl || FIGMA_URL ? `\nFigma: ${task.figmaUrl || FIGMA_URL}` : ""}\nApproved plan: ${planPath}\nAPI contract to write: ${API_CONTRACT}\nWrite your report to ${FE_REPORT}.\nFollow your agent instructions exactly.\nEnd your final response with exact line: STATUS: DONE`,
      outputFile: FE_REPORT,
      doneMarker: "STATUS: DONE",
      label: "Frontend Agent",
      role: "frontend",
    })

    // The next stage is the Backend Agent on a stack:full task, QA otherwise.
    const afterFrontend = task.isFullStack ? tickets.backend : tickets.qa
    if (linearClient && linearStates?.done) {
      await updateLinearIssue(linearClient, tickets.frontend.issueId, { stateId: linearStates.done })
      if (linearStates.inProgress) {
        await updateLinearIssue(linearClient, afterFrontend.issueId, { stateId: linearStates.inProgress })
      }
    }

    if (task.isFullStack) {
      await runAgent({
        systemPrompt: AGENT_PROMPT.backend,
        input: `You are the Backend Agent.\nTask: ${task.title}\nLinear ticket: ${tickets.backend.url}\nApproved plan: ${planPath}\nAPI contract: ${API_CONTRACT}\nWrite your report to ${BE_REPORT}.\nFollow your agent instructions exactly.\nEnd your final response with exact line: STATUS: DONE`,
        outputFile: BE_REPORT,
        doneMarker: "STATUS: DONE",
        label: "Backend Agent",
        role: "backend",
      })

      if (linearClient && linearStates?.done) {
        await updateLinearIssue(linearClient, tickets.backend.issueId, { stateId: linearStates.done })
        if (linearStates.inProgress) {
          await updateLinearIssue(linearClient, tickets.qa.issueId, { stateId: linearStates.inProgress })
        }
      }
    } else {
      log("Frontend-only task (no 'stack:full' marker) — skipping the Backend Agent.")
    }

    await runAgent({
      systemPrompt: AGENT_PROMPT.qa,
      input: `You are the QA Agent.\nTask: ${task.title}\nScope: ${task.scope}\nLinear ticket: ${tickets.qa.url}\nApproved plan: ${planPath}\n${task.isFullStack ? "Run validation across frontend, backend, and e2e." : "This is a frontend-only task: no backend work was done for it. Validate the frontend and e2e only, and record backend checks as not applicable."}\nWrite ${QA_REPORT} and end final response with exact line: STATUS: DONE`,
      outputFile: QA_REPORT,
      doneMarker: "STATUS: DONE",
      label: "QA Agent",
      role: "qa",
    })

    if (linearClient) {
      const reviewState = linearStates?.inReview || linearStates?.todo
      if (reviewState) {
        await updateLinearIssue(linearClient, tickets.qa.issueId, { stateId: reviewState })
      }
      log("Feature gate: approve completion by moving QA ticket to Done in Linear.")
      await waitForLinearIssueState({
        client: linearClient,
        issueId: tickets.qa.issueId,
        targetKinds: ["completed", "done"],
        label: `${tickets.qa.id} feature approval`,
      })
    } else {
      await waitForApproval("Feature done. Type APPROVED to mark task complete and continue: ")
    }

    await markPlanStatus(planPath, "done")
    markBacklogTaskDone(task)
    printCostTable()
    log(`Task complete: ${task.title}`)
  }
}

// Parses a Claude CLI `--output-format json` response, records its cost/usage
// into costLog under the given role, and returns the agent's text result so
// callers can keep treating it like plain stdout.
function recordCost(role, label, rawStdout) {
  if (!rawStdout) return null

  let parsed
  try {
    parsed = JSON.parse(rawStdout)
  } catch {
    // Not JSON (e.g. simulated/fallback output) - nothing to record.
    return rawStdout
  }

  costLog.push({
    role,
    label,
    inputTokens: parsed.usage?.input_tokens ?? 0,
    outputTokens: parsed.usage?.output_tokens ?? 0,
    cacheReadTokens: parsed.usage?.cache_read_input_tokens ?? 0,
    costUsd: parsed.total_cost_usd ?? 0,
    durationMs: parsed.duration_ms ?? 0,
  })

  return parsed.result ?? rawStdout
}

function logLastCost(label) {
  const entry = costLog[costLog.length - 1]
  if (!entry || entry.label !== label) return
  log(`${label}: $${entry.costUsd.toFixed(4)} · ${entry.inputTokens} in / ${entry.outputTokens} out tokens · ${(entry.durationMs / 1000).toFixed(1)}s`)
}

function printCostTable() {
  if (costLog.length === 0) return

  banner("COST & OBSERVABILITY — THIS TASK")
  const rows = costLog.map((entry) => ({
    Role: entry.label,
    "In tokens": entry.inputTokens,
    "Out tokens": entry.outputTokens,
    "Cache read": entry.cacheReadTokens,
    "Cost (USD)": `$${entry.costUsd.toFixed(4)}`,
    "Duration": `${(entry.durationMs / 1000).toFixed(1)}s`,
  }))
  console.table(rows)

  const totalCost = costLog.reduce((sum, entry) => sum + entry.costUsd, 0)
  log(`Total cost this task: $${totalCost.toFixed(4)} across ${costLog.length} Claude call(s).`)

  writeFileSync(TRACE_FILE, JSON.stringify(costLog, null, 2), "utf-8")
  log(`Trace written: ${TRACE_FILE}`)

  costLog = []
}

// The agents write their reports here, and the boundary hook only allows those
// writes under .orchestrate/ — so the directory has to exist before the first
// agent runs, not just before the loop writes tickets.json.
function ensureOrchestrateDir() {
  if (!existsSync(ORCHESTRATE_DIR)) {
    mkdirSync(ORCHESTRATE_DIR, { recursive: true })
  }
}

// The product definition is the PRD for planning purposes. `.doc/` holds the
// hand-written sources (AGENTS.md "Repository Layout"); the old `docs/PRD.md`
// is only read as a fallback so an un-migrated checkout still runs.
function readProductDefinition() {
  for (const candidate of [".doc/product-definition.md", "docs/PRD.md"]) {
    if (existsSync(candidate)) return readFileSync(candidate, "utf-8")
  }
  warn("No product definition found (.doc/product-definition.md) — planning with task title only.")
  return ""
}

function ensurePlanDirAndBacklog() {
  if (!existsSync(PLAN_DIR)) {
    mkdirSync(PLAN_DIR, { recursive: true })
  }

  if (!existsSync(BACKLOG_FILE)) {
    const template = [
      "# Prioritized Backlog",
      "",
      "Use this format:",
      "- [ ] <title>",
      "- [ ] <title> | figma:<url>    (optional)",
      "",
      "Example:",
      "- [ ] message searching",
      "- [ ] message searching | figma:https://www.figma.com/design/tHm72cbGTItMqApwFQ7pkZ/WhatsAppUI?node-id=0-8855&m=dev",
      "",
    ].join("\n")
    writeFileSync(BACKLOG_FILE, template, "utf-8")
  }
}

function getNextBacklogTask() {
  const text = readFileSync(BACKLOG_FILE, "utf-8")
  const lines = text.split("\n")

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    const m = line.match(/^\s*-\s*\[( |x|X)\]\s*(.+)$/)
    if (!m) continue
    const done = m[1].toLowerCase() === "x"
    if (done) continue

    const raw = m[2].trim()
    const parts = raw.split("|").map((p) => p.trim()).filter(Boolean)
    const title = parts[0]

    let figmaUrl = ""
    let stack = ""
    for (const p of parts.slice(1)) {
      const kv = p.split(":")
      if (kv.length < 2) continue
      const key = kv[0].trim().toLowerCase()
      const value = kv.slice(1).join(":").trim()
      if (key === "figma") figmaUrl = value
      if (key === "stack") stack = value.toLowerCase()
    }

    // Scope marker. A task is frontend-only unless the backlog line opts in with
    // `| stack:full` — that is the single switch that decides whether a backend
    // ticket is created and whether the Backend Agent runs at all. Prose in the
    // title ("- full stack feature") is not enough; the marker has to be there.
    const isFullStack = stack === "full"

    return {
      lineIndex: i,
      line,
      title,
      slug: slugify(title),
      figmaUrl,
      isFullStack,
      scope: isFullStack ? "full stack" : "frontend-only",
    }
  }

  return null
}

function markBacklogTaskDone(task) {
  const text = readFileSync(BACKLOG_FILE, "utf-8")
  const lines = text.split("\n")
  const current = lines[task.lineIndex]
  if (!current) return
  lines[task.lineIndex] = current.replace("[ ]", "[x]")
  writeFileSync(BACKLOG_FILE, lines.join("\n"), "utf-8")
}

function readAllPlanFiles() {
  if (!existsSync(PLAN_DIR)) return []
  const names = readdirSync(PLAN_DIR)
    .filter((n) => n.endsWith(".md") && n !== "000-backlog.md")
    .sort()
  return names.map((name) => ({
    name,
    content: readFileSync(`${PLAN_DIR}/${name}`, "utf-8"),
  }))
}

function getNextPlanPath(slug) {
  const names = existsSync(PLAN_DIR)
    ? readdirSync(PLAN_DIR).filter((n) => /^\d{3}-\d{4}-\d{2}-\d{2}-.+\.md$/.test(n))
    : []
  let max = 0
  for (const n of names) {
    const num = Number(n.slice(0, 3))
    if (Number.isFinite(num)) max = Math.max(max, num)
  }
  const next = String(max + 1).padStart(3, "0")
  const date = new Date().toISOString().slice(0, 10)
  return `${PLAN_DIR}/${next}-${date}-${slug}.md`
}

async function markPlanStatus(planPath, status) {
  if (!existsSync(planPath)) return
  const old = readFileSync(planPath, "utf-8")
  if (!old.includes("Status:")) return
  const updated = old.replace(/Status:\s*(draft|active|done|superseded)/i, `Status: ${status}`)
  writeFileSync(planPath, updated, "utf-8")
}

async function askClaudeForPlan({ task, prd, figmaUrl, planPath, previousPlans }) {
  const prevList = previousPlans.map((p) => `- ${p.name}`).join("\n") || "(none)"
  const figmaTaskLine = figmaUrl ? `- figma: ${figmaUrl}` : "- figma: (none provided)"
  const figmaPlanningGuidance = figmaUrl
    ? [
      "Use your Figma tool to discover and inspect relevant frames for this task.",
      "Discovery is allowed but stay scoped to this task only.",
      "In the plan, include a short section listing selected frames (name + id).",
    ].join("\n")
    : [
      "No Figma link was provided for this task.",
      "Do not block planning on Figma.",
      "Use the PRD and existing codebase as the primary sources of truth, and call out any UI assumptions in Open Questions.",
    ].join("\n")

  const args = [
    "--model", "claude-opus-4-8",
    "--permission-mode", CLAUDE_PERMISSION_MODE,
    "--add-dir", process.cwd(),
    "--system-prompt-file", AGENT_PROMPT.orchestrator,
    "--print",
    "--output-format", "json",
  ]
  if (CLAUDE_ALLOWED_TOOLS) args.push("--allowedTools", CLAUDE_ALLOWED_TOOLS)

  const input = `Follow the writing-plans skill (.claude/skills/writing-plans/SKILL.md) exactly.

Task selected from backlog:
- title: ${task.title}
- slug: ${task.slug}
- scope: ${task.scope}
${figmaTaskLine}

${task.isFullStack
      ? "This task is marked stack:full, so backend work is in scope and a Backend Agent will run after the Frontend Agent."
      : "This task is frontend-only. No Backend Agent will run for it, so do not plan server, API, or database work. If the feature needs data the frontend cannot serve, record that in Open Questions as a follow-up stack:full task."}

Existing plans in .plan:
${prevList}

PRD context (first 80 lines):
${prd.split("\n").slice(0, 80).join("\n")}

${figmaPlanningGuidance}

Write the implementation plan to: ${planPath}
Also print the same plan content to stdout.

Plan requirements:
- Use the required metadata fields and required sections from the writing-plans skill
- Status must start as draft
- Use repository-relative paths only
- Open Questions section must contain clear questions and recommended answers`

  const rawStdout = await spawnClaude(args, input)
  if (!rawStdout) {
    warn("Claude unavailable for planning; using fallback plan template.")
    return generatePlanFallback({ task, figmaUrl })
  }
  const stdout = recordCost("orchestrator", "Orchestrator (planning)", rawStdout)
  logLastCost("Orchestrator (planning)")

  if (existsSync(planPath)) {
    const written = readFileSync(planPath, "utf-8")
    if (written.trim().length > 200) return written
  }

  return stdout
}

async function askClaudeToRevisePlan({ task, prd, figmaUrl, planPath, currentPlan, feedback }) {
  const figmaTaskLine = figmaUrl ? `- figma: ${figmaUrl}` : "- figma: (none provided)"
  const args = [
    "--model", "claude-opus-4-8",
    "--permission-mode", CLAUDE_PERMISSION_MODE,
    "--add-dir", process.cwd(),
    "--system-prompt-file", AGENT_PROMPT.orchestrator,
    "--print",
  ]
  if (CLAUDE_ALLOWED_TOOLS) args.push("--allowedTools", CLAUDE_ALLOWED_TOOLS)

  const input = `Follow the writing-plans skill (.claude/skills/writing-plans/SKILL.md) exactly.

Revise this existing plan based on latest user feedback and latest plan-file edits.

Task:
- title: ${task.title}
- slug: ${task.slug}
${figmaTaskLine}

Plan path: ${planPath}

PRD context (first 80 lines):
${prd.split("\n").slice(0, 80).join("\n")}

User feedback for this revision cycle:
${feedback}

Current plan content:
${currentPlan}

Output only the full updated markdown plan.

Hard requirements:
- Keep required metadata fields and sections
- Keep repository-relative paths only
- Keep Status as draft until explicit APPROVED in terminal
- Resolve or update Open Questions based on feedback where possible`

  const stdout = await spawnClaude(args, input)
  if (!stdout) return null
  return stdout.trim() || null
}

async function reviewPlanUntilApproved({ task, prd, figmaUrl, planPath }) {
  log("Plan gate: review and refine. Tickets will be created only after terminal APPROVED.")

  while (true) {
    const answer = await askUserInput(
      `Review ${planPath}. Type APPROVED to continue, or enter feedback to revise the plan: `,
    )
    const normalized = answer.trim().toUpperCase()
    if (normalized === "APPROVED") {
      log("Plan gate passed via terminal approval.")
      return
    }

    const currentPlan = existsSync(planPath) ? readFileSync(planPath, "utf-8") : ""
    if (!currentPlan.trim()) {
      warn(`Plan file ${planPath} is missing or empty. Update it, then continue review.`)
      continue
    }

    const feedback = answer.trim() || "No extra terminal feedback. Re-read the latest plan file and improve clarity and completeness."
    const revised = await askClaudeToRevisePlan({ task, prd, figmaUrl, planPath, currentPlan, feedback })
    if (!revised) {
      warn("Could not auto-revise the plan (Claude unavailable). You can edit the plan file manually, then continue review.")
      continue
    }

    writeFileSync(planPath, revised, "utf-8")
    writeFileSync(LATEST_PLAN_FILE, revised, "utf-8")
    log(`Plan updated: ${planPath}`)
  }
}

async function askClaudeToCreateTickets({ teamId, task, planPath }) {
  const plan = existsSync(planPath) ? readFileSync(planPath, "utf-8") : ""
  const args = [
    "--model", "claude-opus-4-8",
    "--permission-mode", CLAUDE_PERMISSION_MODE,
    "--add-dir", process.cwd(),
    "--system-prompt-file", AGENT_PROMPT.orchestrator,
    "--print",
  ]
  if (CLAUDE_ALLOWED_TOOLS) args.push("--allowedTools", CLAUDE_ALLOWED_TOOLS)

  // A frontend-only task gets no backend ticket — asking for one would put a
  // ticket on the board that no agent in this run will ever pick up.
  const ticketList = task.isFullStack
    ? "1) Frontend implementation ticket\n2) Backend implementation ticket\n3) QA / E2E validation ticket"
    : "1) Frontend implementation ticket\n2) QA / E2E validation ticket\n\nDo NOT create a backend ticket: this task is frontend-only."
  const shape = task.isFullStack
    ? `{"frontend":{"id":"<identifier>","issueId":"<uuid>","url":"<url>"},"backend":{"id":"<identifier>","issueId":"<uuid>","url":"<url>"},"qa":{"id":"<identifier>","issueId":"<uuid>","url":"<url>"}}`
    : `{"frontend":{"id":"<identifier>","issueId":"<uuid>","url":"<url>"},"qa":{"id":"<identifier>","issueId":"<uuid>","url":"<url>"}}`

  const input = `Using your Linear tool, create issues in team ${teamId} for this task:
- ${task.title}
- scope: ${task.scope}

Plan file: ${planPath}
Plan content:
${plan}

Create exactly:
${ticketList}

Use Todo state and medium priority.

Output exactly this block and nothing else around it:
TICKETS_JSON
${shape}
END_TICKETS_JSON`

  const stdout = await spawnClaude(args, input)
  if (!stdout) return null
  return parseTicketsFromOutput(stdout, { requireBackend: task.isFullStack })
}

function parseTicketsFromOutput(stdout, { requireBackend } = {}) {
  const match = stdout.match(/TICKETS_JSON\s*\n({[\s\S]+?})\s*\nEND_TICKETS_JSON/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (!parsed.frontend || !parsed.qa) return null
    if (requireBackend && !parsed.backend) return null
    return parsed
  } catch {
    return null
  }
}

function createLinearClient(apiKey) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: apiKey,
  }

  return {
    async graphql(query, variables = {}) {
      const body = JSON.stringify({ query, variables })
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST", headers, body,
      })
      const json = await res.json()
      if (json?.errors?.length) {
        throw new Error(`Linear API error: ${JSON.stringify(json.errors)}`)
      }
      return json.data
    },
  }
}

async function getTeamStates(client, teamId) {
  const query = `
    query TeamStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes { id name type }
        }
      }
    }
  `
  const data = await client.graphql(query, { teamId })
  const nodes = data?.team?.states?.nodes || []
  return {
    todo: findStateId(nodes, ["unstarted", "backlog", "todo", "triage"]),
    inProgress: findStateId(nodes, ["started", "in progress", "inprogress", "doing"]),
    inReview: findStateId(nodes, ["in review", "review", "for review"]),
    done: findStateId(nodes, ["completed", "done"]),
  }
}

function findStateId(nodes, candidates) {
  const lowered = candidates.map((x) => x.toLowerCase())
  for (const node of nodes) {
    const name = String(node?.name || "").toLowerCase()
    const type = String(node?.type || "").toLowerCase()
    if (lowered.includes(type) || lowered.includes(name)) return node.id
  }
  return undefined
}

async function createLinearTickets({ client, teamId, states, task, planPath }) {
  const plan = existsSync(planPath) ? readFileSync(planPath, "utf-8") : ""

  async function createIssue(title, description) {
    const query = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }
    `
    const input = { teamId, title, description, priority: 2 }
    if (states?.todo) input.stateId = states.todo

    const data = await client.graphql(query, { input })
    const issue = data?.issueCreate?.issue
    if (!issue) throw new Error("Linear API error: issueCreate returned no issue")
    return issue
  }

  const summary = plan.split("\n").slice(0, 40).join("\n")

  const fe = await createIssue(`[DEVLOOP][FE] ${task.title}`, `Implement frontend scope for:\n${task.title}\n\nPlan: ${planPath}\n\n${summary}`)
  const be = task.isFullStack
    ? await createIssue(`[DEVLOOP][BE] ${task.title}`, `Implement backend scope for:\n${task.title}\n\nPlan: ${planPath}\n\n${summary}`)
    : null
  const qa = await createIssue(`[DEVLOOP][QA] ${task.title}`, `Validate feature and run E2E for:\n${task.title}\n\nPlan: ${planPath}`)

  const tickets = {
    frontend: { id: fe.identifier, issueId: fe.id, url: fe.url },
    qa: { id: qa.identifier, issueId: qa.id, url: qa.url },
  }
  if (be) tickets.backend = { id: be.identifier, issueId: be.id, url: be.url }
  return tickets
}

async function getLinearIssueState(client, issueId) {
  const query = `
    query IssueState($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        state { id name type }
      }
    }
  `
  const data = await client.graphql(query, { issueId })
  return data?.issue?.state || null
}

async function waitForLinearIssueState({ client, issueId, targetKinds, label }) {
  const targets = targetKinds.map((x) => x.toLowerCase())
  log(`Waiting for Linear approval: ${label}`)
  // Poll until state type/name matches one of targetKinds
  while (true) {
    const state = await getLinearIssueState(client, issueId)
    const type = String(state?.type || "").toLowerCase()
    const name = String(state?.name || "").toLowerCase()
    if (targets.includes(type) || targets.includes(name)) {
      log(`Linear gate passed: ${label} -> ${state?.name || state?.type}`)
      return
    }
    await sleep(8000)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function updateLinearIssue(client, issueId, input) {
  const query = `
    mutation UpdateIssue($issueId: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $issueId, input: $input) {
        success
      }
    }
  `
  await client.graphql(query, { issueId, input })
}

function simulateTickets(task) {
  const up = task.slug.toUpperCase().replace(/[^A-Z0-9]/g, "") || "TASK"
  const tickets = {
    frontend: { id: `${up}-FE`, issueId: "sim-fe", url: `https://linear.app/demo/issue/${up}-FE` },
    qa: { id: `${up}-QA`, issueId: "sim-qa", url: `https://linear.app/demo/issue/${up}-QA` },
  }
  if (task.isFullStack) {
    tickets.backend = { id: `${up}-BE`, issueId: "sim-be", url: `https://linear.app/demo/issue/${up}-BE` }
  }
  return tickets
}

async function runAgent({ systemPrompt, input, outputFile, doneMarker, label, role }) {
  const args = [
    "--model", "claude-opus-4-8",
    "--permission-mode", CLAUDE_PERMISSION_MODE,
    "--add-dir", process.cwd(),
    "--system-prompt-file", systemPrompt,
    "--print",
    "--output-format", "json",
  ]
  if (CLAUDE_ALLOWED_TOOLS) args.push("--allowedTools", CLAUDE_ALLOWED_TOOLS)

  log(`${label}: launching Claude with permission mode '${CLAUDE_PERMISSION_MODE}'.`)
  // AGENT_ROLE is read by .claude/hooks/enforce-agent-boundaries.js so the
  // per-role "Allowed paths" in .claude/agents/*.md are actually enforced, not
  // just requested — this matters because CLAUDE_PERMISSION_MODE defaults to
  // bypassPermissions for this demo, so hooks are the only real guardrail left.
  // The name must stay in step with that hook and with AGENTS.md; renaming it on
  // one side only makes the hook fail OPEN, silently.
  const rawStdout = await spawnClaude(args, input, role ? { AGENT_ROLE: role } : {})

  if (rawStdout === null) {
    warn(`${label}: Claude not available or failed — simulating output.`)
    simulateAgent(label, outputFile, doneMarker)
    return
  }

  const stdout = recordCost(role ?? "agent", label, rawStdout)
  logLastCost(label)

  writeFileSync(outputFile, stdout, "utf-8")
  const doneRegex = /^\s*STATUS\s*:\s*DONE\s*$/im
  if (stdout.includes(doneMarker) || doneRegex.test(stdout)) {
    log(`${label}: STATUS: DONE ✓`)
  } else {
    warn(`${label} finished but did not include '${doneMarker}' marker.`)
  }
}

function simulateAgent(label, outputFile, doneMarker) {
  const content = `=== ${label.toUpperCase()} REPORT (SIMULATED) ===\n\n${doneMarker}\n`
  writeFileSync(outputFile, content)
}

function spawnClaude(args, stdinText, extraEnv = {}) {
  try {
    execSync("claude --version", { stdio: "ignore" })
  } catch {
    return Promise.resolve(null)
  }

  const env = { ...process.env, ...extraEnv }
  // --output-format json buffers one JSON blob instead of streaming readable
  // text, so don't echo it live to the terminal (it'd just dump raw JSON
  // mid-demo) — the caller prints a clean summary once recordCost() parses it.
  const quiet = args.includes("--output-format")

  return new Promise((resolve) => {
    let child
    if (process.platform === "win32") {
      const command = ["claude", ...args.map(quoteArgForCmd)].join(" ")
      child = spawn(command, {
        stdio: ["pipe", "pipe", "inherit"],
        shell: true,
        env,
      })
    } else {
      child = spawn("claude", args, {
        stdio: ["pipe", "pipe", "inherit"],
        shell: false,
        env,
      })
    }

    let stdout = ""
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString()
      stdout += text
      if (!quiet) process.stdout.write(text)
    })

    child.stdin.write(stdinText)
    child.stdin.end()

    child.on("error", () => resolve(null))
    child.on("close", (code) => resolve(code === 0 ? stdout : null))
  })
}

function generatePlanFallback({ task, figmaUrl }) {
  const today = new Date().toISOString().slice(0, 10)
  return `# Plan: ${task.title}

Status: draft
Owner: Orchestrator
Last updated: ${today}

## Goal
Deliver ${task.title} in the existing product using incremental FE, BE, and QA updates.

## Scope
- In scope: changes needed for ${task.title}
- Out of scope: unrelated refactors, unrelated new features

## Assumptions
- Existing app and test setup are functional
- Figma source for this task: ${figmaUrl}

## Open Questions
- Should this feature include analytics events? Recommended: no for first increment.
- Should this feature ship behind a flag? Recommended: no for demo speed.

## Steps
1. Frontend agent implements UI and updates API contract if needed.
2. Backend agent implements API changes and tests.
3. QA agent runs unit, integration, and e2e checks.

## Validation
- frontend: npx vitest run
- backend: npx vitest run
- e2e: cd frontend && npx playwright test --reporter=list

## Risks
- Figma discovery may select non-target frames if task title is vague.
- Existing tests may fail due to unrelated baseline issues.

## Rollout Order
1. FE changes
2. BE changes
3. QA verification

## Rollback
- Revert branch commits for this task.
- Restore previous ticket states and mark plan superseded if replaced.
`
}

function createGitBranch(branch) {
  try {
    execSync(`git rev-parse --verify ${branch}`, { stdio: "ignore" })
    log(`Git branch '${branch}' already exists — checking it out.`)
    execSync(`git checkout ${branch}`, { stdio: "inherit" })
  } catch {
    log(`Creating git branch: ${branch}`)
    execSync(`git checkout -b ${branch}`, { stdio: "inherit" })
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "task"
}

function waitForApproval(prompt) {
  return askUserInput(prompt).then((answer) => {
    if (answer.trim().toUpperCase() === "APPROVED") return
    console.error("Aborted.")
    process.exit(1)
  })
}

function askUserInput(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function banner(msg) {
  const line = "=".repeat(60)
  console.log(`\n${line}\n  ${msg}\n${line}`)
}

function log(msg) {
  console.log(`  ${msg}`)
}

function warn(msg) {
  console.log(`  ! ${msg}`)
}

function getArg(flag) {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : undefined
}

function quoteArgForCmd(value) {
  const s = String(value)
  if (!/[\s"]/u.test(s)) return s
  return `"${s.replace(/"/g, '""')}"`
}

main().catch((e) => {
  console.error("\nOrchestrator error:", e.message)
  process.exit(1)
})
