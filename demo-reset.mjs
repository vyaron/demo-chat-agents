#!/usr/bin/env node
/**
 * Demo reset — puts the repo back to the state a dev-loop demo expects.
 *
 *   npm run demo:reset            # do it
 *   npm run demo:reset -- --dry   # show what it would do, change nothing
 *   npm run demo:reset -- --force # also: discard local edits, delete unmerged branches
 *
 * State leaks between runs, and the branch is only the first thing that collides.
 * A run that stops before markBacklogTaskDone leaves the task unchecked, so the
 * next run picks the same task, rebuilds the same branch name, writes another
 * .plan/NNN- file and overwrites the .orchestrate/ reports. This resets all of it
 * in one command so a workshop run always starts from the same place.
 *
 * What it will NOT do: touch a tracked file other than restoring
 * .plan/000-backlog.md, delete an unmerged branch without --force, or run at all
 * with a dirty working tree without --force. Losing work mid-workshop is worse
 * than a stale artifact.
 */

import { execSync } from "child_process"
import { existsSync, readdirSync, rmSync, statSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const REPO = dirname(fileURLToPath(import.meta.url))
const MAIN = "main"
const BACKLOG = ".plan/000-backlog.md"

const args = process.argv.slice(2)
const DRY = args.includes("--dry") || args.includes("--dry-run")
const FORCE = args.includes("--force")

const actions = []
const skipped = []

function git(command, { allowFail = false } = {}) {
  try {
    return execSync(`git ${command}`, { cwd: REPO, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch (err) {
    if (allowFail) return null
    throw err
  }
}

function remove(target, options = {}) {
  if (DRY) return true
  try {
    rmSync(target, { ...options, force: true })
    return true
  } catch {
    return false
  }
}

function did(message) {
  actions.push(message)
  console.log(`  ${DRY ? "would" : "did "}  ${message}`)
}

function skip(message) {
  skipped.push(message)
  console.log(`  skip  ${message}`)
}

console.log(`\n=== DEMO RESET ${DRY ? "(dry run — nothing will change)" : ""}\n`)

// --- 1. Never destroy uncommitted work by surprise ---
const dirty = git("status --porcelain --untracked-files=no")
if (dirty && !FORCE && !DRY) {
  console.error("Working tree has uncommitted changes:\n")
  console.error(dirty)
  console.error("\nCommit or stash them first, or re-run with --force to discard them.")
  process.exit(1)
}
if (dirty && FORCE) {
  // Only the backlog is restored — the rest is reported and left alone, because
  // "reset the demo" should never mean "throw away whatever you were editing".
  if (!DRY) git(`restore -- ${BACKLOG}`, { allowFail: true })
  did(`restore ${BACKLOG} from git`)
  const others = dirty.split("\n").filter((line) => !line.includes("000-backlog.md"))
  if (others.length) skip(`left ${others.length} other modified file(s) alone: ${others.map((l) => l.slice(3)).join(", ")}`)
}

// --- 2. Back to main ---
const current = git("branch --show-current")
if (current === MAIN) {
  skip(`already on ${MAIN}`)
} else if (!DRY) {
  git(`switch ${MAIN}`)
  did(`switch from ${current} to ${MAIN}`)
} else {
  did(`switch from ${current} to ${MAIN}`)
}

// --- 3. Delete the branches previous runs left behind ---
// -d refuses to delete a branch whose work is not in main; that refusal is the
// point. --force upgrades to -D for the abandoned mid-run branches.
const branches = git("branch --format=%(refname:short)")
  .split("\n")
  .map((b) => b.trim())
  .filter((b) => b && b !== MAIN)

if (!branches.length) {
  skip("no leftover local branches")
}
for (const branch of branches) {
  if (DRY) {
    const merged = git(`branch --merged ${MAIN} --format=%(refname:short)`).split("\n").includes(branch)
    if (merged || FORCE) did(`delete branch ${branch}`)
    else skip(`branch ${branch} is not merged into ${MAIN} — needs --force`)
    continue
  }
  const deleted = git(`branch -d ${branch}`, { allowFail: true })
  if (deleted !== null) {
    did(`delete branch ${branch}`)
  } else if (FORCE) {
    git(`branch -D ${branch}`)
    did(`force-delete unmerged branch ${branch}`)
  } else {
    skip(`branch ${branch} is not merged into ${MAIN} — kept (use --force to delete)`)
  }
}

// --- 4. Generated dev-loop output ---
// .gitignore keeps .orchestrate/* out of git except README.md, so this leaves no
// diff either way — it just stops one run's reports from being read as the next
// run's. Cleared, not deleted: the boundary hook only lets agents write into an
// .orchestrate/ that already exists.
removeInside(".orchestrate", (name) => name !== "README.md")
removeInside(".lab", () => true, { removeDir: true })

// --- 5. Plans this run generated but never committed ---
// A committed plan is project history and stays. An uncommitted NNN- plan is
// debris from a run that did not finish.
const planDir = join(REPO, ".plan")
if (existsSync(planDir)) {
  const untracked = new Set(
    git("ls-files --others --exclude-standard -- .plan")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split("/").pop()),
  )
  const debris = readdirSync(planDir).filter((n) => /^\d{3}-\d{4}-\d{2}-\d{2}-.+\.md$/.test(n) && untracked.has(n))
  if (!debris.length) skip("no uncommitted plan files in .plan/")
  for (const name of debris) {
    if (!DRY) rmSync(join(planDir, name))
    did(`remove uncommitted plan .plan/${name}`)
  }
}

// --- 6. What this cannot reach ---
console.log("")
if (existsSync(join(REPO, ".env")) || existsSync(join(REPO, "backend/.env"))) {
  console.log("  note  env files left untouched (the demo needs them)")
}
console.log("  note  Linear tickets from previous runs are not reset — this script cannot")
console.log("        undo them. Move or archive them in Linear before presenting.")

const unchecked = git(`grep -c "^- \\[ \\]" ${MAIN} -- ${BACKLOG}`, { allowFail: true })
if (unchecked) console.log(`  note  backlog queue: ${unchecked.split(":").pop()} task(s) ready to run`)

console.log(`\n=== ${DRY ? "DRY RUN" : "RESET"} COMPLETE — ${actions.length} action(s), ${skipped.length} skipped\n`)

/** Empties a directory without removing the directory itself, unless removeDir. */
function removeInside(relDir, keep, { removeDir = false } = {}) {
  const dir = join(REPO, relDir)
  if (!existsSync(dir)) {
    skip(`${relDir}/ does not exist`)
    return
  }
  const entries = readdirSync(dir).filter(keep)
  if (!entries.length) {
    skip(`${relDir}/ already clean`)
  }
  for (const name of entries) {
    const target = join(dir, name)
    // A file can be locked — .lab/live.log is usually open in a `tail -f` pane
    // during the concurrency demo. Report it and move on; a stale log is not
    // worth aborting the reset over.
    if (!remove(target, { recursive: statSync(target).isDirectory() })) {
      skip(`${relDir}/${name} is in use — close whatever has it open`)
      continue
    }
    did(`remove ${relDir}/${name}`)
  }
  if (removeDir && existsSync(dir) && !readdirSync(dir).length) {
    if (remove(dir, { recursive: true })) did(`remove ${relDir}/`)
  }
}
