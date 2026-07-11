# Common Pitfalls

This document captures common implementation mistakes at the workflow and
repository-governance level.

## Scope Pitfalls

- mixing unrelated fixes into one task
- continuing past the explicit stop condition
- editing code when the task is documentation only

## Git Pitfalls

- committing generated files accidentally
- staging unrelated local changes
- amending history without approval

## Validation Pitfalls

- reporting validation that did not run
- running the wrong workspace command
- skipping targeted regression checks for permission or payload bugs

## Documentation Pitfalls

- leaving trackers stale
- putting implementation details into governance docs
- breaking relative links between docs

## AI Workflow Pitfalls

- over-broad prompts
- no Master Context v2.x structure
- assuming Codex should invent missing product decisions
- treating AI output as final authority
