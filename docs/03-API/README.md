# API

## Inspection

Base path: `/api/inspection/`

### Inspection endpoints

- `GET /api/inspection/inspections/`
  - Permissions: `inspection.view` or `inspection.manage`
  - Supports filters: `status`, `priority`, `tenant`, `organization`, `department`, `building`, `floor`, `area`, `inspection_type`, `five_s_category`, `inspector`, `supervisor`
  - Supports query helpers: `search`, `scheduled_from`, `scheduled_to`, `started_from`, `started_to`, `completed_from`, `completed_to`, `score_min`, `score_max`, `corrective_action_status`, `ordering`
- `POST /api/inspection/inspections/`
  - Permissions: `inspection.create` or `inspection.manage`
  - Payload:

```json
{
  "tenant": "<uuid>",
  "organization": "<uuid>",
  "department": "<uuid>",
  "building": "<uuid>",
  "floor": "<uuid>",
  "area": "<uuid>",
  "title": "Weekly 5S inspection",
  "inspection_type": "routine",
  "five_s_category": "shine",
  "inspection_template": "Default 5S Weekly",
  "inspector": "<uuid>",
  "supervisor": "<uuid>",
  "priority": "high",
  "scheduled_date": "2026-07-08T09:00:00+08:00",
  "remarks": "Pre-start weekly walkthrough",
  "items": [
    {
      "sequence": 1,
      "checklist_item": "Area is labeled correctly.",
      "category": "Sort",
      "expected_result": "Labels match designated storage.",
      "max_score": "5.00",
      "score": "4.00",
      "is_pass": true,
      "observation": "One shelf label slightly faded."
    }
  ]
}
```

- `GET /api/inspection/inspections/{id}/`
  - Permissions: `inspection.view` or `inspection.manage`
  - Returns detail, related items, findings, attachments, comments, assignments, history, status history, corrective actions, SLA, AI analysis, and escalations
- `PATCH /api/inspection/inspections/{id}/`
  - Permissions: `inspection.update` or `inspection.manage`
  - Accepts the core inspection fields plus optional full `items` replacement

### Nested inspection endpoints

- `GET|POST /api/inspection/inspections/{id}/items/`
  - Read permissions: `inspection.view` or `inspection.manage`
  - Write permissions: `inspection.update` or `inspection.manage`
- `GET /api/inspection/inspections/{id}/findings/`
  - Read permissions: `inspection.view` or `inspection.manage`
- `GET|POST /api/inspection/inspections/{id}/attachments/`
  - Read permissions: `inspection.view` or `inspection.manage`
  - Write permissions: `inspection.update` or `inspection.manage`
- `GET|POST /api/inspection/inspections/{id}/comments/`
  - Read permissions: `inspection.view` or `inspection.manage`
  - Write permissions: `inspection.update` or `inspection.manage`
- `GET /api/inspection/inspections/{id}/history/`
  - Read permissions: `inspection.view` or `inspection.manage`
- `GET /api/inspection/inspections/{id}/corrective-actions/`
  - Read permissions: `inspection.view` or `inspection.manage`
- `GET|POST /api/inspection/inspections/{id}/ai-analysis/`
  - Permissions: `inspection.view_ai` or `inspection.manage`

### Workflow endpoints

- `POST /api/inspection/inspections/{id}/assign/`
  - Permissions: `inspection.assign` or `inspection.manage`
  - Payload:

```json
{
  "inspector": "<uuid>",
  "supervisor": "<uuid>",
  "note": "Assign to weekly 5S rotation."
}
```

- `POST /api/inspection/inspections/{id}/start/`
  - Permissions: `inspection.update` or `inspection.manage`
- `POST /api/inspection/inspections/{id}/complete/`
  - Permissions: `inspection.complete` or `inspection.manage`
  - Validation: all checklist items must exist, all items must have scores, and all items must have pass/fail values
- `POST /api/inspection/inspections/{id}/verify/`
  - Permissions: `inspection.verify` or `inspection.manage`
  - Validation: inspection must already be completed and all corrective actions must be completed or verified
- `POST /api/inspection/inspections/{id}/cancel/`
  - Permissions: `inspection.update` or `inspection.manage`
- `POST /api/inspection/inspections/{id}/reopen/`
  - Permissions: `inspection.update` or `inspection.manage`

### Finding endpoints

- `GET /api/inspection/findings/`
- `POST /api/inspection/findings/`
- `GET /api/inspection/findings/{id}/`
- `PATCH /api/inspection/findings/{id}/`

Permissions:

- Read: `inspection.view` or `inspection.manage`
- Write: `inspection.update` or `inspection.manage`

### Corrective action endpoints

- `GET /api/inspection/corrective-actions/`
- `POST /api/inspection/corrective-actions/`
- `GET /api/inspection/corrective-actions/{id}/`
- `PATCH /api/inspection/corrective-actions/{id}/`

Permissions:

- Read: `inspection.view` or `inspection.manage`
- Write: `inspection.manage_corrective_action` or `inspection.manage`

### Common validation rules

- Tenant, organization, department, building, floor, and area relationships must remain internally consistent
- Inspector, supervisor, assignees, and corrective-action owners must belong to the same tenant as the inspection
- Scores must stay within the allowed range for the inspection or item
- Findings and attachments must reference the same parent inspection
- Corrective actions must reference findings from the same inspection
- Invalid workflow transitions return `400`
- Missing permission returns `403`
- Out-of-tenant records return empty list results or `404` on detail routes for non-global users
