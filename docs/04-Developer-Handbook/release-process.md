# Release Process

## Purpose

Describe the repository-level release path without tying it to one module.

## Release Strategy

- Release only reviewed and validated slices.
- Prefer predictable branch-to-merge flow over ad hoc batching.
- Keep release notes grounded in repository facts, not intent.

## Pre-Release Checklist

- Confirm merge-ready work is on the intended branch.
- Verify required validation results are current.
- Update `docs/development/project-status.md` if the release changes current
  status.
- Confirm handbook and tracker docs are not stale.

## Merge Strategy

- Prefer reviewed, task-scoped merges from the active module branch.
- Prefer a clean merge record that preserves task intent.
- If squash merge is used, ensure the final commit message still explains the
  shipped slice.

## Versioning

- If repository tags are introduced, record the release tag in
  `docs/development/project-status.md`.
- If no tags exist, state that versioning is branch-and-commit based.

## Post-Release

- Record important lessons learned.
- Capture new recurring validation or rollback steps in the handbook.
