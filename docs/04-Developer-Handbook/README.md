# Developer Handbook

## Purpose

This handbook is the permanent engineering process reference for the FacilityOps
repository. It defines how work is planned, executed, reviewed, validated,
documented, and merged without depending on one-off chat context.

This handbook is intentionally process-focused. Product implementation details
belong in:

- `docs/01-Architecture/`
- `docs/02-Development/`
- `docs/03-API/`
- `docs/development/`

## Core Principles

- Keep one feature slice per Codex run whenever possible.
- Use Master Context v2.x as the canonical task contract.
- Keep module work on the active module branch unless explicitly redirected.
- Validate only what the scope requires, then document what was actually run.
- Update repository status documents as part of task completion.
- Capture lessons learned so repeated failures become process improvements.

## Reading Order

1. [Project Status](../development/project-status.md)
2. [Development Workflow](./development-workflow.md)
3. [Git Workflow](./git-workflow.md)
4. [Codex Workflow](./codex-workflow.md)
5. [QA Checklist](./qa-checklist.md)
6. [Documentation Standards](./documentation-standards.md)

## Handbook Map

- [Development Workflow](./development-workflow.md)
- [Git Workflow](./git-workflow.md)
- [Codex Workflow](./codex-workflow.md)
- [Code Review](./code-review.md)
- [QA Checklist](./qa-checklist.md)
- [Debugging Guide](./debugging-guide.md)
- [Documentation Standards](./documentation-standards.md)
- [Release Process](./release-process.md)
- [Coding Standards](./coding-standards.md)
- [AI Development Guide](./ai-development-guide.md)
- [Prompt Engineering](./prompt-engineering.md)
- [Repository Structure](./repository-structure.md)
- [Project Status Guide](./project-status-guide.md)
- [Architecture Decisions](./architecture-decisions.md)
- [Lessons Learned](./lessons-learned.md)
- [Common Pitfalls](./common-pitfalls.md)

## Ownership

- Repository status documents are maintained alongside feature delivery.
- Process changes should update the handbook in the same branch as the change
  that introduced the new rule.
- If a handbook rule conflicts with a newer system or repository instruction,
  update the handbook quickly so the conflict does not persist.
