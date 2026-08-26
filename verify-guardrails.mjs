#!/usr/bin/env node
/**
 * Guardrail verification — proves the hooks in .claude/hooks/ actually block
 * what AGENTS.md says they block.
 *
 *   node verify-guardrails.mjs
 *
 * Each case spawns the real hook with a real PreToolUse payload on stdin and
 * asserts the exit code: 0 = allowed, 2 = blocked. Nothing is mocked, so this
 * catches the failure mode these hooks are most prone to — failing OPEN after a
 * rename or a path change, which produces no error and no output at runtime.
 *
 * Run it after touching a hook, a role name, or an "Allowed paths" list.
 */

import { spawnSync } from "child_process"
import { fileURLToPath } from "url"
import { dirname } from "path"

const REPO = dirname(fileURLToPath(import.meta.url))

function runHook(hook, payload, env = {}) {
  const result = spawnSync(process.execPath, [`.claude/hooks/${hook}`], {
    cwd: REPO,
    input: JSON.stringify(payload),
    env: { ...process.env, ...env },
    encoding: "utf-8",
  })
  return result.status
}

const ALLOW = 0
const BLOCK = 2
const cases = []

function check(name, actual, expected) {
  cases.push({ name, ok: actual === expected, actual, expected })
}

// A Write payload as Claude Code actually sends it: file_path is ABSOLUTE.
const write = (relPath) => ({
  tool_name: "Write",
  cwd: REPO,
  tool_input: { file_path: `${REPO}/${relPath}` },
})

const boundaries = (relPath, role) =>
  runHook("enforce-agent-boundaries.js", write(relPath), role ? { AGENT_ROLE: role } : {})

// --- Role boundaries: each agent stays in its lane ---
check("frontend may write frontend/src", boundaries("frontend/src/x.tsx", "frontend"), ALLOW)
check("frontend may NOT write backend/src", boundaries("backend/src/x.ts", "frontend"), BLOCK)
check("frontend may write its API contract", boundaries(".orchestrate/api-contract.yaml", "frontend"), ALLOW)
check("frontend may NOT write the QA report", boundaries(".orchestrate/qa-report.md", "frontend"), BLOCK)
check("backend may write backend/src", boundaries("backend/src/x.ts", "backend"), ALLOW)
check("backend may NOT write frontend/src", boundaries("frontend/src/x.tsx", "backend"), BLOCK)
check("qa may add tests", boundaries("frontend/tests/unit/a.test.tsx", "qa"), ALLOW)
check("qa may NOT edit feature source", boundaries("frontend/src/x.tsx", "qa"), BLOCK)
check("qa may write its report", boundaries(".orchestrate/qa-report.md", "qa"), ALLOW)

// An absolute path outside the repo must not slip past the prefix check.
check("no role may write outside the repo", runHook(
  "enforce-agent-boundaries.js",
  { tool_name: "Write", cwd: REPO, tool_input: { file_path: "c:/Users/somebody/evil.txt" } },
  { AGENT_ROLE: "frontend" },
), BLOCK)

// Orchestrator and interactive sessions are deliberately unrestricted.
check("no AGENT_ROLE means unrestricted", boundaries("backend/src/x.ts", null), ALLOW)

// --- Secret files: blocked whichever tool reaches for them ---
const secret = (toolInput, toolName = "Bash") =>
  runHook("block-secret-file-access.js", { tool_name: toolName, tool_input: toolInput })

check("Read .env is blocked", secret({ file_path: `${REPO}/.env` }, "Read"), BLOCK)
check("Read .env.local is blocked", secret({ file_path: `${REPO}/.env.local` }, "Read"), BLOCK)
check("Read .env.test is blocked", secret({ file_path: `${REPO}/.env.test` }, "Read"), BLOCK)
check("Read .env.example is allowed", secret({ file_path: `${REPO}/.env.example` }, "Read"), ALLOW)
check("Bash `cat .env` is blocked", secret({ command: "cat .env" }), BLOCK)
check("Bash `grep KEY backend/.env` is blocked", secret({ command: "grep -r KEY backend/.env" }), BLOCK)
check("Grep into backend/.env is blocked", secret({ path: `${REPO}/backend/.env` }, "Grep"), BLOCK)
// False positives that made earlier versions of this hook unusable:
check("grepping for import.meta.env is allowed", secret({ command: 'grep -rn "import.meta.env" frontend/src' }), ALLOW)
check("reading process.env in node -e is allowed", secret({ command: 'node -e "console.log(process.env.NEXT_PUBLIC_X)"' }), ALLOW)
check("Write whose content mentions .env is allowed", secret(
  { file_path: `${REPO}/README.md`, content: "copy .env.example to .env" }, "Write",
), ALLOW)
// Documented, accepted false positive: a regex-escaped `process\.env` is
// textually a Windows path. See the note in block-secret-file-access.js.
check("regex-escaped process\\.env is blocked (known false positive)",
  secret({ command: 'grep -rn "process\\.env" frontend/src' }), BLOCK)

// --- Destructive commands ---
const bash = (command) => runHook("block-destructive-bash.js", { tool_name: "Bash", tool_input: { command } })

check("rm -rf is blocked", bash("rm -rf frontend"), BLOCK)
check("git push --force is blocked", bash("git push --force origin main"), BLOCK)
check("DROP TABLE is blocked", bash('psql -c "DROP TABLE users"'), BLOCK)
check("npm test is allowed", bash("cd frontend && npm test"), ALLOW)
check("process.env in a command is allowed", bash('node -e "console.log(process.env.CI)"'), ALLOW)

let failed = 0
for (const c of cases) {
  if (!c.ok) failed += 1
  const status = c.ok ? "  ok  " : " FAIL "
  const detail = c.ok ? "" : `  (exit ${c.actual}, expected ${c.expected})`
  console.log(`${status}${c.name}${detail}`)
}

console.log(
  failed
    ? `\n${failed} of ${cases.length} guardrail checks FAILED — the hooks are not enforcing what AGENTS.md promises.`
    : `\nAll ${cases.length} guardrail checks pass.`,
)
process.exit(failed ? 1 : 0)
