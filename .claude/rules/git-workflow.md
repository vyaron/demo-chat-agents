# Git Workflow

## Approval gates — no exceptions
- **Never commit** until the user explicitly approves committing.
- **Never merge** a branch without explicit approval.
- **Never push a release tag** without explicit approval.

## Branches
- Do implementation work on a dedicated branch, never on `main`.
- Create the branch before executing an approved plan.
- One plan or workstream per branch.
- **Inside the dev loop, `dev-loop.js` owns the branch.** It creates and checks out
  the task branch before the first agent starts, so a sub-agent is already on the
  right branch and must never run `git checkout`, `git switch`, or `git branch`.
  Creating it a second time fails the run with
  `fatal: a branch named '<name>' already exists`;
  `.claude/hooks/block-destructive-bash.js` blocks these for any run with
  `AGENT_ROLE` set. Interactive sessions still branch normally.
- Lowercase, predictable names, singular domain terms:
  - `feat/<topic>` — new capability
  - `fix/<topic>` — bug fix
  - `chore/<topic>` — maintenance
  - `docs/<topic>` — documentation only

## Commits
- Imperative subject, concise and action-oriented: `add org validation rule`.
- One intent per commit. Do not bundle unrelated changes.

## Merges
- At least one review pass before merge when others are involved.
- Resolve open comments and questions before merging.

Release tagging and version numbers are a separate procedure — see the
`cutting-a-release` skill.
