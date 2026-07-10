# Debugging Guide

## Default Debugging Order

1. Reproduce the issue with the exact failing path.
2. Capture the error source:
   - backend validation
   - permission denial
   - frontend payload
   - query serialization
   - stale state
3. Inspect the contract on both sides of the boundary.
4. Confirm whether the issue is in data, code, or environment.
5. Add or extend regression coverage when the fix is stable.

## Useful Questions

- What exact input caused the failure?
- Which layer rejected it?
- Did the repo already define the expected behavior?
- Is the bug caused by scope mismatch, not logic failure?
- Can the failure be reproduced with a smaller test case?

## Debugging Rules

- Do not loosen backend validation unless the domain model allows it.
- Prefer fixing the caller when the contract is already correct.
- Treat permissions and tenant scoping as first-class debugging concerns.
- Document the discovered failure mode in the task doc when it is reusable.
