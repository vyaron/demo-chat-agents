lens: [SEC ] security

findings:
  - severity: blocker
    what:     sub-agents inherit the full parent environment, secrets included
    where:    dev-loop.js:783 (also trace-agent.js:81)
    why:      block-secret-file-access guards the env file, but LINEAR_API_KEY / GITHUB_TOKEN / ANTHROPIC_API_KEY are still one `node -e` away under bypassPermissions — verify-guardrails.mjs even asserts that read is allowed
    fix:      pass an explicit allowlisted env to spawnClaude (PATH, HOME, AGENT_ROLE, and only the keys a role truly needs) instead of spreading process.env

  - severity: major
    what:     bypassPermissions is the default with no tool allowlist
    where:    dev-loop.js:25-26
    why:      the settings.json permissions.deny list never applies to sub-agents, and CLAUDE_ALLOWED_TOOLS is unset by default, so network-capable tools are wide open next to inherited credentials — three hooks are the entire boundary
    fix:      default CLAUDE_PERMISSION_MODE to acceptEdits and ship a real default CLAUDE_ALLOWED_TOOLS, making bypassPermissions an explicit opt-in

  - severity: minor
    what:     MCP servers install unpinned third-party packages at launch
    where:    .mcp.json:6,12,18
    why:      `npx -y` resolves whatever version is latest at run time for figma-developer-mcp, server-github and @mseep/linear-mcp, each spawned with a live API token in its env — one bad release reads those tokens
    fix:      pin exact versions (or vendor the servers) so an upstream change is a reviewed bump, not a silent fetch

  - severity: minor
    what:     the Linear API key is accepted as a command-line flag
    where:    dev-loop.js:23
    why:      `--linear-key` puts the secret in argv, shell history and the process list, and on win32 spawnClaude builds a shell string (dev-loop.js:792), so it can also surface in command echo
    fix:      remove the flag and read the key only from the environment
