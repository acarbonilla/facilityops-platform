# Codex Workflow

## Roles

### Sol Responsibilities

Sol owns orchestration quality. Sol should:

- shape the task into a usable Master Context v2.x request
- preserve continuity across runs
- keep scope strict
- decide when clarification is required
- ensure validation and documentation expectations are explicit

### Codex Responsibilities

Codex owns execution quality. Codex should:

- inspect the repository before editing
- implement only the approved slice
- preserve existing patterns
- validate the change
- report exactly what changed and what was verified

## Session Workflow

1. Reconstruct current branch and worktree state.
2. Read the exact task request and referenced files.
3. Inspect the relevant code or docs before deciding on a solution.
4. Keep user updates short, factual, and progress-oriented.
5. Apply changes directly when scope is clear.
6. Stop after the approved slice.

## One Slice Per Run

- One Codex run should ideally complete one self-contained feature or fix.
- If a task expands during execution, document the boundary and stop at the
  approved definition of done.

## Escalation

- Challenge weak assumptions early.
- Do not invent missing repository policy.
- If local state conflicts with the task, surface it instead of hiding it.
