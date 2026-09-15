# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms
- `conversation`
  - Canonical meaning: one chat thread between the user and one other participant.
    The `conversations` table, the `Conversation` type, and — because the socket
    room name *is* the conversation id — the unit of broadcast.
  - Use: always `conversation`, never `chat`, `thread`, `room`, or `channel`.
    "Chat" is fine in UI copy and component names (`ChatList`, `ChatInput`); it is
    not a data or route term.
- `message`
  - Canonical meaning: one posted line of text in a conversation. The `messages`
    table and the `Message` type.
  - Use: always `message`, never `msg` in a type, field, route, or file name.
- `sender`
  - Canonical meaning: whoever posted a message, carried as the pair `sender_id`
    and `sender_name`. Both are plain text with no foreign key, so a sender need
    not be a row anywhere — that is what lets `ai` post without a migration.
  - Use: `sender_id` / `sender_name`, never `user_id`, `author`, or `from`.
    There is no `user` entity in this system.
- `content`
  - Canonical meaning: the message body text.
  - Use: `content`, never `text`, `body`, or `message` (a message *has* content).
- `ai`
  - Canonical meaning: the Claude-backed non-human participant in a conversation.
    It is the literal `@ai` mention trigger, the `sender_id` on its messages, and
    the prefix on its socket events (`ai_typing`, `ai_error`).
  - Use: always use `ai`, never `assistant`, `bot`, or `agent`. `agent` already
    means a dev-loop sub-agent in this repository and must not be overloaded.
- `typing`
  - Canonical meaning: the transient "someone is composing" signal. Never
    persisted — it exists only as the `user_typing` and `ai_typing` socket events.
  - Use: `typing`, never `composing` or `activity`.

## Derived Fields
Present on the conversation list response, computed per request rather than stored:
- `last_message` / `last_message_at` — the newest message's content and timestamp.
- `unread_count` — currently hardcoded `0`; there is no read-state tracking yet.
  Keep the name when it becomes real.

## Naming Alignment
- Keep this glossary aligned with naming decisions in `../.claude/rules/naming.md`.
- If a new domain term is introduced, add it here before broad usage.

## Update Rules
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
