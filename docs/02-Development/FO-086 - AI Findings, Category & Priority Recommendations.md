# FO-086 — AI Findings, Category & Priority Recommendations

**Status:** Implemented on `feature/fo-086-ai-recommendations` (Draft PR)  
**Date:** 2026-08-03  
**Base:** `main` @ `a5c1963…` (FO-085 + FO-082A)  
**Phase:** Phase 12A — Application Development  
**Epic:** AI-Assisted FM Ticket Analysis

## Objective

Extend the FO-085 Gemini Vision pipeline so analyses also return advisory Facilities Management recommendations: findings, recommended category, recommended priority, severity, confidence, and reasoning. Humans remain fully in control. The AI never mutates FM Ticket fields.

## Architecture

```text
get_ai_provider()
  ├── PlaceholderAIProvider (advisory scaffolding)
  └── GeminiVisionProvider
        prompt: fm_ticket_recommendation_v1
        schema: FacilityRecommendationV1
        ↓
ai_processing_service (validate + persist model_dump)
        ↓
AITicketAnalysis.result_json + serializer recommendation fields
        ↓
TicketAiAnalysisStatusPanel (collapsed recommendations)
```

## Schema — FacilityRecommendationV1 (1.0)

Path: `backend/apps/fm_tickets/ai/schema_recommendation_v1.py`

Keeps FO-085 observation fields and adds:

| Field | Notes |
| --- | --- |
| `findings[]` | title (enum), description, confidence 0–100 |
| `recommended_category` | one of Plumbing / Electrical / … / Unknown |
| `recommended_priority` | Low / Medium / High / Critical |
| `severity` | Minor / Moderate / Major / Critical |
| `overall_confidence` | 0–100 |
| `reasoning` | concise, no prompt/CoT leakage |
| `requires_human_review` | always forced `true` |

FO-085 `FacilityImageAnalysisV1` remains available for backward-compatible validation of older payloads without `findings`.

## Prompt — fm_ticket_recommendation_v1

Path: `backend/apps/fm_tickets/ai/prompts/fm_ticket_recommendation_v1.py`

- Name: `fm_ticket_recommendation`
- Version: `v1`
- Previous FO-085 prompt `fm_ticket_image_analysis_v1` retained on disk
- Gemini provider selects the recommendation prompt/schema automatically

## Safety

AI must never:

- change category / priority / status
- close tickets
- assign technicians
- generate work orders

UI states: “AI recommendations are suggestions only. Final decisions remain with the Facilities Team.”

## API

`AITicketAnalysisSerializer` exposes advisory fields from stored JSON:

`findings`, `recommended_category`, `recommended_priority`, `severity`, `confidence` (from `overall_confidence`), `reasoning`, `requires_human_review`, `prompt_version`

No API keys, prompt text, image bytes, or storage paths.

## Frontend

`TicketAiAnalysisStatusPanel` shows a **collapsed-by-default** recommendations section for internal audiences with findings, badges, confidence bars, reasoning, and human-review notice. Requesters still see lifecycle messaging only.

## Persistence / migrations

Uses existing `result_json` JSONField. **No migration required.**

## Tests

- `test_ai_recommendations.py` — schema, processing, serializer, tenant isolation
- Updated Gemini / lifecycle coverage for recommendation-shaped Gemini responses
- Frontend `ai-recommendations.test.ts` + status helper coverage

## Deferred

FO-087 human-review apply workflow, automatic ticket mutations, notifications driven by recommendations.
