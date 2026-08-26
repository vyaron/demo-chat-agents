#!/usr/bin/env node
/**
 * Live observability demo — runs ONE Claude Code agent with
 * --output-format stream-json and prints every tool call as it happens
 * (file paths read/written, commands run), then a final cost/usage summary.
 *
 * This is deliberately separate from dev-loop.js: the dev-loop script uses
 * --output-format json (one buffered blob) so it can write reports cleanly;
 * this script trades that buffering for live, line-by-line visibility into
 * "what did the agent actually do" - the thing the Session 4 concept slide
 * is about.
 *
 * Usage:
 *   node trace-agent.js --task "add dark theme support to the app"
 * 
 *   node trace-agent.js --task "Implement the contact info page per .plan/000-backlog.md" \
 *     [--agent .claude/agents/frontend.md] [--role frontend]
 *
 * Defaults to the frontend agent's definition if --agent is omitted.
 */

import { spawn, execSync } from "child_process"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { dirname } from "path"
import { createInterface } from "readline"

const TASK = getArg("--task")
const ROLE = getArg("--role") || "frontend"
// --system-prompt is still accepted as an alias so older demo notes keep working.
const AGENT_FILE = getArg("--agent") || getArg("--system-prompt") || `.claude/agents/${ROLE}.md`
const CLAUDE_PERMISSION_MODE = process.env.CLAUDE_PERMISSION_MODE || getArg("--claude-permission-mode") || "bypassPermissions"
const TRACE_FILE = ".orchestrate/trace-live.json"

if (!TASK) {
  console.error("Usage: node trace-agent.js --task \"<what the agent should do>\" [--agent path] [--role name]")
  process.exit(1)
}

if (!existsSync(AGENT_FILE)) {
  console.error(`Agent definition not found: ${AGENT_FILE}`)
  process.exit(1)
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

function banner(text) {
  console.log(`\n=== ${text} ===\n`)
}

main()

async function main() {
  banner(`LIVE TRACE — ${ROLE} agent`)
  console.log(`Agent definition: ${AGENT_FILE}`)
  console.log(`Task: ${TASK}`)
  console.log(`Permission mode: ${CLAUDE_PERMISSION_MODE}\n`)

  try {
    execSync("claude --version", { stdio: "ignore" })
  } catch {
    console.error("claude CLI not found — this script needs the real CLI (no simulation fallback).")
    process.exit(1)
  }

  const args = [
    "--model", "claude-opus-4-8",
    "--permission-mode", CLAUDE_PERMISSION_MODE,
    "--add-dir", process.cwd(),
    "--system-prompt-file", AGENT_FILE,
    "--print",
    "--verbose",
    "--output-format", "stream-json",
  ]

  // Must match .claude/hooks/enforce-agent-boundaries.js and AGENTS.md — a rename
  // on one side only makes the boundary hook fail open without any error.
  const env = { ...process.env, AGENT_ROLE: ROLE }
  let child
  if (process.platform === "win32") {
    const command = ["claude", ...args.map(quoteArgForCmd)].join(" ")
    child = spawn(command, { stdio: ["pipe", "pipe", "inherit"], shell: true, env })
  } else {
    child = spawn("claude", args, { stdio: ["pipe", "pipe", "inherit"], shell: false, env })
  }

  child.stdin.write(TASK)
  child.stdin.end()

  let toolCallCount = 0
  let finalResult = null

  const rl = createInterface({ input: child.stdout })
  rl.on("line", (line) => {
    if (!line.trim()) return

    let event
    try {
      event = JSON.parse(line)
    } catch {
      return // partial/non-JSON line - ignore
    }

    const toolUses = findToolUses(event)
    for (const toolUse of toolUses) {
      toolCallCount += 1
      console.log(`  [tool ${toolCallCount}] ${toolUse.name}  ${summarizeInput(toolUse.name, toolUse.input)}`)
    }

    if (event.type === "result") {
      finalResult = event
    }
  })

  await new Promise((resolve) => child.on("close", resolve))

  if (!finalResult) {
    console.error("\nNo final result event received — agent may have errored before finishing.")
    process.exit(1)
  }

  printSummary(finalResult, toolCallCount)
}

// Recursively scan an event for {type: "tool_use", name, input} blocks,
// wherever they show up in the stream-json event shape.
function findToolUses(node, found = []) {
  if (!node || typeof node !== "object") return found

  if (node.type === "tool_use" && typeof node.name === "string") {
    found.push({ name: node.name, input: node.input })
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) findToolUses(item, found)
    } else if (value && typeof value === "object") {
      findToolUses(value, found)
    }
  }

  return found
}

function summarizeInput(toolName, input) {
  if (!input) return ""
  if (input.file_path) return input.file_path
  if (input.command) return truncate(input.command, 80)
  if (input.pattern) return input.pattern
  return truncate(JSON.stringify(input), 80)
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function printSummary(resultEvent, toolCallCount) {
  const usage = resultEvent.usage ?? {}
  const summary = {
    role: ROLE,
    toolCalls: toolCallCount,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    costUsd: resultEvent.total_cost_usd ?? 0,
    durationMs: resultEvent.duration_ms ?? 0,
    numTurns: resultEvent.num_turns ?? 0,
  }

  banner("TRACE SUMMARY")
  console.table([{
    Role: summary.role,
    "Tool calls": summary.toolCalls,
    "Turns": summary.numTurns,
    "In tokens": summary.inputTokens,
    "Out tokens": summary.outputTokens,
    "Cache read": summary.cacheReadTokens,
    "Cost (USD)": `$${summary.costUsd.toFixed(4)}`,
    "Duration": `${(summary.durationMs / 1000).toFixed(1)}s`,
  }])

  mkdirSync(dirname(TRACE_FILE), { recursive: true })
  writeFileSync(TRACE_FILE, JSON.stringify(summary, null, 2), "utf-8")
  console.log(`\nTrace written: ${TRACE_FILE}`)
}

function quoteArgForCmd(arg) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(arg)) return arg
  return `"${arg.replace(/"/g, '\\"')}"`
}
