# System Architecture

## Purpose
- Provide a concise architecture reference for service boundaries, ownership, and major flows.

## System Overview
- This document should describe the primary runtime components and how they interact.

## Recommended Sections
- `Context`
	- What problem the system solves and key constraints.
- `Primary Components`
	- Main services/modules and their responsibilities.
- `Data Flow`
	- Request and event flow between components.
- `Auth and Org Boundaries`
	- Where authentication and organization scoping are enforced.
- `External Dependencies`
	- Third-party services and integration points.
- `Operational Concerns`
	- Logging, monitoring, retries, and failure handling.
- `Change Log`
	- Date-stamped notes for major architecture updates.

## External Dependencies
- Supabase — the datastore behind every conversation and message.
- Anthropic (Claude Messages API, via `@anthropic-ai/sdk`) — reached from
	`backend/src/lib/ai.ts` on the message-send path. It is invoked **only** when an
	inbound socket `send_message` contains an `@ai` mention, and only after that
	message is already persisted and broadcast, so an Anthropic outage can never
	block or roll back ordinary chat. Failures are logged server-side and surfaced
	to the room as an `ai_error` event; nothing is persisted for them.
	- Credential: `ANTHROPIC_API_KEY`, read from the gitignored `backend/.env`.
	- Cost bounds: last 20 messages of history, `max_tokens` 1024, `effort: low`,
		one reply per triggering message. No rate limit in v1.

## Update Triggers
- Update this file when API routes, auth boundaries, org boundaries, or major component ownership changes.

## Change Log
- 2026-08-31 — Added Anthropic as an external dependency on the socket
	`send_message` path (`@ai` mention replies). New server→client socket events
	`ai_typing` and `ai_error`; no new HTTP route and no schema change.

