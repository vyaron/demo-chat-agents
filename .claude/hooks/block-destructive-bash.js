#!/usr/bin/env node
// PreToolUse guardrail: blocks destructive shell patterns before they run.
// Demo purpose: show that a hook enforces a hard boundary even if the
// agent's plan or prompt would have allowed the command, and even when
// the sub-agent was launched with --permission-mode bypassPermissions.

// Access to env/secret FILES is handled by block-secret-file-access.js, which
// runs on every tool. Do not add a bare /\.env\b/ rule here: it also matches
// `process.env`, `import.meta.env` and `$env:`, which blocked ordinary commands.
const DENY_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bgit\s+push\s+--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bDROP\s+(TABLE|DATABASE)\b/i,
  /\bdelete\s+from\s+\w+\s*;?\s*$/i, // DELETE with no WHERE clause
  /\bsupabase\s+db\s+reset\b/i
]

// Sub-agents only. dev-loop.js creates and checks out the task branch before any
// agent runs (createGitBranch), so an agent that branches on its own either kills
// the run with `fatal: a branch named '...' already exists` or silently moves the
// work off the task branch. .claude/rules/git-workflow.md loads into every
// sub-agent session and tells them to branch before implementing — that prose is
// what produced the collision; this is the part that actually holds.
// Gated on AGENT_ROLE, the same var enforce-agent-boundaries.js reads, so
// interactive sessions and the orchestrator keep branching normally.
const AGENT_GIT_DENY_PATTERNS = [
  // Creating or moving between branches. `git checkout -- <path>` (restore a
  // file) stays allowed; `git checkout <branch>` and `-b` do not.
  /\bgit\s+(checkout|switch)\s+(?!--(?:\s|$))\S/i,
  // Creating, renaming or deleting a branch. Listing (`git branch`, `-a`, `-v`,
  // `--list`, `--show-current`) stays allowed.
  /\bgit\s+branch\s+(?:-[mMdD]\b|[^-\s])/i
]

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const command = payload?.tool_input?.command ?? ''
  const match = DENY_PATTERNS.find(pattern => pattern.test(command))

  if (match) {
    console.error(`[guardrail] Blocked command matching ${match}: ${command}`)
    process.exit(2) // exit code 2 = block the tool call
  }

  if (process.env.AGENT_ROLE) {
    const gitMatch = AGENT_GIT_DENY_PATTERNS.find(pattern => pattern.test(command))
    if (gitMatch) {
      console.error(
        `[guardrail] Blocked git branch command: ${command}\n` +
        `dev-loop.js already created and checked out the task branch — you are on it. ` +
        `Do not run git checkout/switch/branch. Just edit the files for your ticket.`
      )
      process.exit(2)
    }
  }

  process.exit(0)
})
