# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms
- `org`
	- Canonical meaning: organization tenant/account boundary.
	- Use: always use `org`, not `organization`.
- `site`
	- Canonical meaning: singular site entity/resource.
	- Use: prefer singular in routes and service names.
- `geo`
	- Canonical meaning: geospatial/location context.
	- Use: use `geo`, not `geolocation` or `localization`.
- `lat` and `lng`
	- Canonical meaning: latitude and longitude values.
	- Use: use short forms only.

## Naming Alignment
- Keep this glossary aligned with naming decisions in `../.rule/naming-rules.md`.
- If a new domain term is introduced, add it here before broad usage.

## Update Rules
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
