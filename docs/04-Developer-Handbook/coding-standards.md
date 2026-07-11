# Coding Standards

## General Standards

- Preserve existing repository patterns before inventing new ones.
- Keep changes minimal, explicit, and reversible.
- Prefer ASCII unless a file already requires other characters.
- Add comments only when they clarify non-obvious logic.

## Scope Standards

- Do not mix unrelated fixes into a task without approval.
- Do not introduce new dependencies without necessity and approval.
- Do not add environment variables or provider SDKs outside scope.

## Validation Standards

- Every behavior change should have matching validation evidence.
- Prefer regression tests for bugs that cross boundaries such as permissions,
  payload mapping, or serialization.

## Safety Standards

- Do not remove guardrails to satisfy a caller.
- Respect tenant scoping, RBAC, and data ownership rules.
- Treat generated files carefully and keep them out of commits unless required.
