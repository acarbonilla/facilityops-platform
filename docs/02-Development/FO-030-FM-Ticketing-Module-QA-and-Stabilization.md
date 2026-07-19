# FO-030 - FM Ticketing Module QA and Stabilization

## Task ID

FO-030

## Task Title

FM Ticketing Module QA and Stabilization

## Purpose

FO-030 validates the FM Ticketing module after FO-024 through FO-029, confirms the current backend and frontend contract behavior, records any stabilization issues, and captures the remaining environment-specific QA caveats before the next business module begins.

## Scope

- Backend FM Ticketing model validation
- Migration and seed-command validation
- RBAC and permission validation
- Ticket list, detail, create, update, comment, history, status, assignment, SLA, and escalation API validation
- Frontend lint and TypeScript validation
- Backend live startup validation
- Frontend local startup probing
- Documentation cleanup

No new major FM Ticketing features, maintenance work orders, 5S inspection, reporting, AI, notifications, attachments, analytics, or deployment changes were added.

## Validation Checklist

- [x] Backend FM Ticketing models validate successfully
- [x] FM Ticketing migrations are up to date
- [x] FM Ticketing seed command is idempotent
- [x] FM Ticketing permissions remain valid
- [x] Ticket list and detail APIs pass test coverage
- [x] Ticket create and update APIs pass test coverage
- [x] Ticket comments and history APIs pass test coverage
- [x] Ticket status workflow passes test coverage
- [x] Ticket assignment workflow passes test coverage
- [x] SLA and escalation data pass API and serializer validation
- [x] Frontend lint passes
- [x] Frontend TypeScript validation passes
- [x] Backend startup responds successfully through `/api/health/`
- [ ] Frontend local startup probe completed on the default documented port
- [x] Loading, error, empty, and unauthorized states remain covered in the current FM Ticketing component implementation
- [x] README is updated
- [x] Development documentation is updated
- [x] No new FM Ticketing features were implemented
- [x] No maintenance work order, 5S, reporting, AI, notification, attachment, or deployment work was implemented

## Commands Executed

Backend:

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_rbac
.\.venv\Scripts\python.exe manage.py seed_master_data
.\.venv\Scripts\python.exe manage.py seed_fm_tickets
.\.venv\Scripts\python.exe -m pytest
```

Backend live smoke:

```text
python manage.py runserver 127.0.0.1:8000 --noreload
GET /api/health/
```

Frontend:

```text
cd frontend
npm run lint
npx tsc --noEmit
npm run dev
```

Additional frontend probes were attempted against `/login` on ports `3000`, `3001`, and an alternate direct `next dev` invocation.

## Bugs Found

1. No FM Ticketing backend or frontend contract regressions were found in the requested validation commands.
2. Local frontend startup probing on this host was blocked by existing listeners on ports `3000` and `3001`, causing `EADDRINUSE` before a clean `next dev` smoke pass could be completed on those ports.
3. The current frontend runtime directory `.next-runtime` is shared by the same workspace, so concurrent local Next.js processes can also interfere with additional startup probes in this environment.

## Bugs Fixed

1. Updated the top-level README to reflect the actual Stage 2 / FO-030 project state instead of the outdated Stage 1 / FO-018 note.
2. Added this FO-030 QA report and refreshed the development docs index so FM Ticketing stabilization outcomes are explicit.

## Known Limitations

- The FM Ticketing module itself validated cleanly through migrations, seeds, tests, lint, and TypeScript checks.
- Browser-equivalent frontend startup validation could not be completed on the documented default port because this host already had listeners bound to `127.0.0.1:3000` and `127.0.0.1:3001`.
- The occupied ports were owned by existing local processes with PIDs `1332` and `1512` at the time of validation.
- Automated browser-style navigation through login, list, detail, create, edit, comment, status, assignment, SLA, escalation, return-to-list, and logout still benefits from one clean manual pass after stopping the conflicting local frontend processes.
- The backend test suite still emits a weak local `SECRET_KEY` warning during auth tests. This does not block FM Ticketing stabilization but should not be treated as a deployed-environment configuration.

## MVP Acceptance Result

FM Ticketing is acceptable for the current module stabilization gate.

- Backend module validation passed: models, migrations, seeds, permissions, APIs, workflow actions, SLA support, escalation support, and full pytest coverage all completed successfully.
- Frontend code validation passed: lint and TypeScript checks completed successfully.
- Backend live startup smoke passed through the health endpoint.
- Frontend dev-server smoke remains partially blocked by host-level port contention rather than by an identified FM Ticketing code defect.

The module is therefore **accepted with an environment caveat**: one clean browser-driven frontend smoke pass should still be rerun after freeing the occupied local frontend ports.

## Next Task Recommendation

Proceed to FO-031 - Maintenance Work Order Backend Foundation after:

- stopping the existing processes bound to `127.0.0.1:3000` and `127.0.0.1:3001`
- running one clean manual frontend smoke pass for login, ticket list, ticket detail, create, edit, comment, status, assignment, SLA, escalation, return-to-list, and logout
- keeping FO-031 scoped to the next module without reopening FM Ticketing feature work unless a new defect is found

## Post-delivery security reconciliation

FO-074F later confirmed a Critical tenant-isolation defect not detected by this
historical QA snapshot: `FmTicketViewSet.get_queryset()` applied filters to an
unscoped platform-wide queryset. FO-074F adds backend-authoritative tenant
scope, generic cross-tenant 404 behavior, creation/update hardening, and
focused coverage across all FM Ticket actions. The correction passes 82 FM
Ticket tests and the 611-test full backend suite with no migration or frontend
change. FO-074G records Sol's independent **APPROVED** security review at
implementation HEAD `48bde40c40c2942b59a616df623a7f47329b8715` and the user's
passed cross-tenant manual acceptance on 2026-07-19. FO-061 assignment and Work
Order generation retain their stricter no-global-bypass contract. Employee
Requester Experience and FO-075 have not started; FO-063 remains
reserved/deferred.
