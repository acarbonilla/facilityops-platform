# Code Review

## Review Objective

Code review is primarily for defects, regressions, unclear assumptions, missing
validation, and unsafe scope growth.

## Review Standard

Reviews should check:

- behavior correctness
- permission and data-scope safety
- API and UI contract consistency
- migration or schema implications
- test coverage and validation evidence
- documentation impact

## Repository Review Process

1. Confirm the change matches the approved task boundary.
2. Read the validation evidence before trusting the implementation summary.
3. Inspect risky files directly when permissions, payload mapping, schema, or
   workflow logic changed.
4. Check tracker and handbook updates when the task changes process or status.
5. Approve merge only when findings are resolved or explicitly accepted.

## Findings-First Format

When performing a review:

1. List findings first, ordered by severity.
2. Include file references.
3. Keep summaries short.
4. State clearly when no findings were discovered.

## Merge Expectations

A change is not review-ready unless:

- the scope matches the task
- validation is recorded
- documentation is updated where required
- known limitations are explicit

## Code Review Checklist

- Are scope and stop conditions respected?
- Does the implementation preserve repository patterns?
- Are validation results sufficient for the risk level?
- Are docs and repository trackers current?
- Are remaining risks documented clearly enough for merge decisions?
