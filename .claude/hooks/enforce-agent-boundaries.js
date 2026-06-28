#!/usr/bin/env node
// PreToolUse guardrail: enforces the "Allowed paths" sections already written
// in agents/frontend/CLAUDE.md and agents/backend/CLAUDE.md. Those files only
// *ask* the agent to stay in its lane ("Forbidden: backend/**") - nothing
// stopped it from ignoring that under bypassPermissions. This hook reads the
// CLAUDE_AGENT_ROLE env var that run-demo.js now sets when it spawns each
// sub-agent (see runAgent -> spawnClaude in run-demo.js) and blocks any
// Edit/Write outside that role's allowed paths.
//
// Orchestrator runs (no CLAUDE_AGENT_ROLE set) and interactive sessions are
// left unrestricted by this hook on purpose.

const ALLOWED_WRITE_PREFIXES = {
  frontend: ['frontend/', 'docs/api-contract.yaml', 'docs/frontend-agent-report.md'],
  backend: ['backend/', 'docs/backend-agent-report.md'],
  qa: ['docs/qa-report.md']
}

let input = ''
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const role = process.env.CLAUDE_AGENT_ROLE
  const allowedPrefixes = role && ALLOWED_WRITE_PREFIXES[role]
  if (!allowedPrefixes) {
    process.exit(0) // no role set (orchestrator / interactive) - not this hook's job
  }

  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const filePath = (payload?.tool_input?.file_path ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!filePath) {
    process.exit(0)
  }

  const isAllowed = allowedPrefixes.some(prefix => filePath.startsWith(prefix))
  if (!isAllowed) {
    console.error(
      `[guardrail] "${role}" agent tried to write outside its allowed paths: "${filePath}". ` +
      `Allowed: ${allowedPrefixes.join(', ')}`
    )
    process.exit(2)
  }

  process.exit(0)
})
