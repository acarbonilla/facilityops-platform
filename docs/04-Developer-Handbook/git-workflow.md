# Git Workflow

## Branch Model

- Use the active module branch for the approved work.
- Do not create a new branch unless the task explicitly requires it.
- Prefer branch names scoped to the module or workstream, such as
  `agent/inspection-module`.

## Module Branch Strategy

- Treat the active module branch as the working lane for that module or
  workstream.
- Keep unrelated work off the branch even when it appears easy to include.
- Finish one approved slice before starting another.

## Commit Rules

- Keep commits intentional and task-scoped.
- Do not include unrelated worktree changes.
- Prefer clear commit messages:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `refactor: ...`
- Do not amend commits unless explicitly requested.

## Staging Rules

- Stage only the files required by the task.
- Recheck `git status --short` before committing.
- Leave unrelated generated or local-only files unstaged.

## Push Rules

- Push only after required validation is complete or a conscious exception is
  documented.
- Push the current module branch to `origin`.
- If local-only files remain unstaged, mention them in the handoff.

## Merge Readiness

Before a branch is ready to merge, confirm:

- scope is complete
- validation is recorded
- docs are updated
- no unrelated files are staged

## Merge Strategy

- Prefer reviewed merges from the active module branch.
- Preserve task intent in the final merge or squash message.
- Do not merge a branch whose tracker documents or handbook updates are stale.
