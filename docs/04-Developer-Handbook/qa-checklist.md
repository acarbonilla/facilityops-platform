# QA Checklist

## Purpose

Use this checklist before handing work off for merge or release.

## Core Checks

- Scope matches the approved task.
- Required backend validation ran.
- Required frontend validation ran.
- Documentation updates are complete.
- No unrelated files are staged.
- Known risks or unrun checks are disclosed.

## Backend QA

- `manage.py check` when backend behavior changes
- migration safety validation when models may be affected
- targeted or full test execution as required by the task

## Frontend QA

- lint
- build or type-level validation as required
- targeted manual smoke checks when user-facing flows changed

## Documentation QA

- links resolve
- status trackers updated when required
- wording matches what was actually implemented
- no false claims about validation or completed scope
