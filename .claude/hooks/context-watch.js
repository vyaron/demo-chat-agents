#!/usr/bin/env node
// UserPromptSubmit hint: once the context window is close to full, injects a
// nudge to write a handoff file and start a fresh session.
//
// Context is read from the transcript's own token accounting, not from the
// file size. Every assistant line carries `message.usage`, and
// input + cache_read + cache_creation IS the context that turn was sent.
// File size is a poor proxy twice over: it overcounts (per-line uuid /
// timestamp / cwd metadata, JSON escaping, tool results truncated before they
// ever reach the model), and it never shrinks - after an auto-compact the real
// context resets while the file keeps growing, so a size-based estimate pins
// at 100% and re-injects this hint on every prompt for the rest of the
// session. Reading usage tracks compaction for free, with no boundary marker
// to detect (the transcript does not reliably write one).

import fs from 'node:fs'

const BUDGET = 600_000        // model context window
const WARN_AT = 0.80          // inject a hint once 80% full
const TAIL_BYTES = 512 * 1024 // transcripts reach tens of MB; only the tail is scanned

// Cached and uncached input both occupy the window. output_tokens do not -
// they become the next turn's input and are already counted there.
function contextOf(usage) {
  return (usage.input_tokens ?? 0)
    + (usage.cache_read_input_tokens ?? 0)
    + (usage.cache_creation_input_tokens ?? 0)
}

// Scans backwards for the newest main-thread turn that reports usage.
// `isSidechain` lines are sub-agent turns holding their own separate window -
// counting one would report a sub-agent's context as the main thread's.
function scanBackwards(text, dropFirstLine) {
  const lines = text.split('\n')
  // A tail read almost always slices its first line mid-way, so drop it rather
  // than feed a fragment to JSON.parse.
  if (dropFirstLine) lines.shift()

  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue
    let entry
    try {
      entry = JSON.parse(lines[i])
    } catch {
      continue
    }
    if (entry.isSidechain) continue
    const usage = entry.message?.usage
    if (usage) return contextOf(usage)
  }
  return null
}

function readTail(file, size) {
  const start = Math.max(0, size - TAIL_BYTES)
  const buf = Buffer.alloc(size - start)
  const fd = fs.openSync(file, 'r')
  try {
    fs.readSync(fd, buf, 0, buf.length, start)
  } finally {
    fs.closeSync(fd)
  }
  return { text: buf.toString('utf8'), truncated: start > 0 }
}

function usedTokens(file) {
  const size = fs.statSync(file).size
  const { text, truncated } = readTail(file, size)

  const fromTail = scanBackwards(text, truncated)
  if (fromTail !== null) return fromTail

  // A single turn carrying a huge tool result can be longer than the tail, in
  // which case no whole line survived the slice. Re-read in full before
  // giving up - going silent here would drop the warning on exactly the
  // oversized sessions it exists for.
  if (!truncated) return 0
  return scanBackwards(fs.readFileSync(file, 'utf8'), false) ?? 0
}

let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
  let data
  try {
    data = JSON.parse(raw || '{}')
  } catch {
    process.exit(0)
  }

  const transcript = data.transcript_path

  let used = 0
  try {
    if (transcript && fs.existsSync(transcript)) used = usedTokens(transcript)
  } catch {
    // An unreadable or half-written transcript is not worth failing a prompt over.
    process.exit(0)
  }

  const pct = used / BUDGET
  if (pct < WARN_AT) process.exit(0)

  const hint =
    `[context-watch] Context is ~${Math.round(pct * 100)}% full. ` +
    'Before continuing: finish the current step, write a short handoff ' +
    'summary to HANDOFF.md (goal, what\'s done, next steps, key files), ' +
    'then tell the user to run /clear and resume from that file.'

  // No process.exit() after this: exiting can truncate a pipe mid-write.
  // Node exits 0 on its own once the event loop drains.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: hint,
      },
    })
  )
})
