# FO-098 — Facility Manager Review Experience

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-05  
**Branch:** `feature/intelligent-employee-intake`  
**Previous checkpoint:** FO-097 (`dac0719…`)  
**FO-098 implementation tip:** see commits on this branch after FO-097  
**AI Platform:** FO-084–095 reused (not redesigned)  
**Next:** FO-099 — Smart Notifications and Workflow  
**PR policy:** No standalone FO-098 PR; feature remains unmerged

## 1. Objective

Give Facility Managers a guided review workspace that separates employee-submitted concerns from AI advisory recommendations and final operational classification, while preserving FO-087 accept/modify/ignore audit behavior and human decision authority.

## 2. Review layout

1. Employee Report — requester, organization, title, description, submitted images, submission time  
2. AI Recommendation — reused FO-087 panel (findings, category/priority, severity, confidence, reasoning, decision controls, comparison)  
3. Operational Classification — final category/priority/location with needs-review indicators  
4. Operational Assignment — assignment + SLA (blocked until classification complete)  
5. Actions — work order, status, escalation, comments, history  

## 3. Classification readiness

Assignment and work-order generation require:

- category ≠ `unclassified`
- priority ≠ `pending_review`
- building set

Enforced in UI helpers and backend `classification_readiness.assert_ticket_ready_for_operational_actions`.

## 4. Explicit non-goals

No FO-099–101, notification redesign, analytics redesign, prompt/provider changes, RAG, automatic decisions, merge to main.

## 5. Validation

| Gate | Result |
| --- | --- |
| FO-098 backend | passed |
| FO-087 recommendation review | passed |
| FO-096/097 regression | passed |
| Frontend suite | passed |
| TypeScript / ESLint / Build | clean |
| Django check / makemigrations --check | clean |

## 6. Confirmation

- Feature branch unmerged  
- FO-099 **not started**  
- AI remains advisory; FM retains operational authority  
