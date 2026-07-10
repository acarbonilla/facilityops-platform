# Documentation Standards

## Purpose

Keep repository documentation accurate, navigable, and cheap to maintain.

## Rules

- Update docs in the same task that changes behavior or process.
- Keep process docs separate from implementation docs.
- Prefer concise sections over narrative sprawl.
- Use relative links between repository documents.
- Do not claim validation that was not run.

## File Placement

- Architecture and system shape: `docs/01-Architecture/`
- Task delivery records: `docs/02-Development/`
- API contracts: `docs/03-API/`
- Process and governance: `docs/04-Developer-Handbook/`
- Repository trackers: `docs/development/`

## Style

- Use Title Case headings.
- Keep bullets flat.
- Prefer present tense for repository facts.
- Prefer exact file paths and command names.

## Ownership

- The task owner updates affected docs.
- The reviewer checks that docs reflect the actual change.
- Outdated process rules should be corrected quickly rather than worked around
  silently.
