# Naming

Applies to API routes, domain entities, services, files, and data fields.

- Use **singular** for the entity itself — types, files, services, and fields:
  `Message`, `Conversation`, `message.service`, `sender_id`, `conversation_id`.
- Use **plural** only for an HTTP collection segment, and nest a child collection
  under its parent's id — matching the routes that exist:
  `/api/conversations`, `/api/conversations/:id/messages`.
- Use the canonical short term, never a synonym:
  - `conversation` — not `chat`, `thread`, `room`, or `channel` (in data and routes;
    `Chat*` is still fine in UI component names)
  - `message` — not `msg`
  - `sender_id` / `sender_name` — not `user_id`, `author`, or `from`
  - `ai` — not `assistant`, `bot`, or `agent`
- Keep route and file names aligned with the domain name they serve.
- Do not introduce a second word for a concept that already has one. Canonical
  terms live in `.doc/glossary.md`; document a new shared term there before
  using it broadly.
