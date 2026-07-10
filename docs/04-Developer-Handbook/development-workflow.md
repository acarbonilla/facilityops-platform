# Development Workflow

## Objective

Define the default path from approved task request to validated repository
change.

## Standard Flow

1. Read the active task request and capture the goal, scope, constraints,
   validation, and stop conditions.
2. Rebuild Master Context v2.x for the task.
3. Inspect the repository before proposing changes.
4. Confirm the active module branch and current worktree state.
5. Implement only the approved feature slice.
6. Run the required validation commands.
7. Update relevant documentation and project trackers.
8. Summarize the outcome, validation, and residual risks.

## Team Roles In The Workflow

- Sol defines the task contract, preserves continuity, and controls scope.
- Codex executes the approved slice, validates it, and reports actual results.
- Human reviewers decide whether the repository is ready for merge.

## Master Context v2.x

Master Context v2.x is the canonical task contract. It should contain:

- project
- branch
- goal
- in-scope work
- out-of-scope work
- required files
- validation commands
- definition of done
- explicit stop conditions

If the task lacks one of these, clarify it before broad implementation starts.

## Slice Discipline

- Prefer one FO task or one stabilization slice per Codex run.
- Avoid mixing unrelated fixes into the same change set.
- If unrelated local changes exist, work around them unless the task explicitly
  requires coordination.

## Cost-Saving Workflow

- Reuse existing repository context before asking Codex to rediscover it.
- Prefer targeted tests first, then broader gates required by the task.
- Do not run extra expensive validation without a clear reason.
- Keep prompts precise so Codex does not explore irrelevant areas.

## Review Handoff

- A task should reach review with scope complete, validation recorded, and
  documentation updated.
- Any skipped validation, known risk, or local limitation should be stated
  directly in the handoff.
