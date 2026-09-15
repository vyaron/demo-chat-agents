lens: [DOCS] DOC vs REALITY — does AGENTS.md describe the repo that actually exists

findings:

  - severity: major
    what:     "verify-guardrails.mjs drives every hook" is untrue — context-watch.js is never invoked by it
    where:    AGENTS.md:19-21 vs verify-guardrails.mjs (0 references to context-watch)
    why:      The one UserPromptSubmit hook can fail open forever and the suite the doc tells you to trust still reports all green
    fix:      Either add real UserPromptSubmit payload cases for context-watch.js or reword the claim to "every PreToolUse hook"

  
verdict: needs work
