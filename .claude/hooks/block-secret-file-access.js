#!/usr/bin/env node
// PreToolUse guardrail: hard-blocks any tool access to env/secret files,
// regardless of which tool is used to reach them (Read, Edit, Write, Bash,
// Grep, Glob...). permissions.deny only covers the exact tool+pattern listed
// and can't see inside a Bash command string - this hook inspects the target
// of every call, so `cat .env`, `Read(.env)` and `grep -r KEY backend/.env`
// are all caught the same way.
//
// The repo root .env holds LINEAR_API_KEY, which is exactly what the dev-loop
// sub-agents must never read back out or echo into a report.
//
// Runs even when CLAUDE_PERMISSION_MODE=bypassPermissions (dev-loop.js's
// default for the FE/BE/QA sub-agents) - hooks are a separate enforcement
// layer from the permission system, which is exactly why this demo relies
// on them instead of permissions.deny alone.

// Matches a real env file anywhere in the tree - the repo root `.env` (which
// holds LINEAR_API_KEY), plus any future frontend/.env or backend/.env.
//
// Suffixes are matched open-endedly (`.env.local`, `.env.test`, `.env.staging`,
// `.env.production.local`) rather than enumerated, because an enumerated list
// silently fails open on the one suffix nobody thought of. The template
// suffixes are then carved back out: `.env.example` / `.sample` / `.template`
// are committed content agents are allowed to read and write.
const ENV_SUFFIX = /\.env(?!\.(?:example|sample|template)(?![\w.-]))(?:\.[\w-]+)*(?![\w.-])/.source

// Path fields: the env file must be a whole path segment, so `src/env.ts` and
// `.envrc` don't match.
const SECRET_FILE_PATTERN = new RegExp(`(^|[/\\\\])${ENV_SUFFIX}`, 'i')

// Command strings: whatever precedes `.env` must be empty or end in a path
// separator. Without that anchor the pattern also swallows `import.meta.env`
// and `process.env` - see the warning in block-destructive-bash.js, which is
// where that exact mistake was made before.
//
// Known false positive, accepted deliberately: a regex-escaped `process\.env`
// typed into a grep is indistinguishable from the Windows path `process\` +
// `.env`, so it gets blocked. Backslash has to stay a separator for `type
// frontend\.env` to be caught, and over-blocking a search beats under-blocking
// a read. Search for the unescaped string instead.
const SECRET_IN_COMMAND_PATTERN = new RegExp(`(^|[\\s"'=;|&(])(?:[\\w.\\\\/-]*[\\\\/])?${ENV_SUFFIX}`, 'i')

// Only fields that NAME a target are inspected. Deliberately not scanning the
// whole tool_input: a Write's `content` can legitimately mention an env file
// (setup docs, .env.example templates, this hook's own source) without
// touching one — scanning content made the hook unable to edit itself.
const PATH_FIELDS = ['file_path', 'path', 'notebook_path']

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

  const blockedPath = PATH_FIELDS
    .map(field => toolInput[field])
    .find(value => typeof value === 'string' && SECRET_FILE_PATTERN.test(value))

  // A shell command can reach a secret file without ever naming a path field:
  // `cat .env`, `grep -r KEY .env`, `type frontend\.env`.
  const command = typeof toolInput.command === 'string' ? toolInput.command : ''
  const blockedCommand = SECRET_IN_COMMAND_PATTERN.test(command)

  if (blockedPath || blockedCommand) {
    console.error(
      `[guardrail] Blocked ${payload?.tool_name ?? 'tool'} call touching an env/secret file` +
      `${blockedPath ? `: ${blockedPath}` : ''}. Use .env.example instead.`
    )
    process.exit(2)
  }

  process.exit(0)
})
