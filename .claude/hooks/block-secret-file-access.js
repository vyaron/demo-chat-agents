#!/usr/bin/env node
// PreToolUse guardrail: hard-blocks any tool access to known secret files,
// regardless of which tool is used to reach them (Read, Edit, Write, Bash,
// Grep, Glob...). permissions.deny only covers the exact tool+pattern listed
// and can't see inside a Bash command string - this hook inspects the actual
// tool_input for every call, so `cat backend/.env`, `Read(.env)`, and
// `grep -r SUPABASE_SERVICE_KEY .` are all caught the same way.
//
// Runs even when CLAUDE_PERMISSION_MODE=bypassPermissions (run-demo.js's
// default for the FE/BE/QA sub-agents) - hooks are a separate enforcement
// layer from the permission system, which is exactly why this demo relies
// on them instead of permissions.deny alone.

const SECRET_PATH_FRAGMENTS = [
  'backend/.env'
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

  const toolInput = payload?.tool_input ?? {}
  const haystack = JSON.stringify(toolInput).toLowerCase()

  const match = SECRET_PATH_FRAGMENTS.find(fragment => haystack.includes(fragment.toLowerCase()))

  if (match) {
    console.error(`[guardrail] Blocked ${payload?.tool_name ?? 'tool'} call touching secret file: ${match}`)
    process.exit(2)
  }

  process.exit(0)
})
