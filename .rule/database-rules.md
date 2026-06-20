# Database Rules

## Purpose
- Define database source-of-truth expectations, migration behavior, and bootstrap guidance.

## Source of Truth
- `schema.sql` is a standalone bootstrap script for full setup.

## Core Tables
### org
- `id text PRIMARY KEY`
- `name text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `deleted_at timestamptz NULL`
- `data jsonb NOT NULL DEFAULT '{}'::jsonb`

## Migration Rules
- Keep migration files aligned with `schema.sql` intent.
- When schema changes are introduced, update both migration artifacts and bootstrap script.

## Standalone Bootstrap Script
- `schema.sql` creates tables and indexes needed for baseline setup.
- `schema.sql` contains idempotent seed inserts for orgs.

## Operational Notes
- Keep `schema.sql` aligned with migration intent for local full bootstrap.
- Prefer additive, reversible migration changes where practical.



