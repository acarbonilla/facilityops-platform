"""FO-106 project timeline aggregation.

MVP strategy: ProjectHistory is the sole source. Note/issue/comment CRUD always
records history so those events appear. Attachment upload entries appear only
when a ProjectHistory row already exists for them (attachment framework history
is not merged in FO-106 MVP).
"""

from __future__ import annotations

from django.db.models import Q
from django.utils.dateparse import parse_date, parse_datetime

from .models import ProjectHistory

# action -> (category, icon, title template key)
_ACTION_MAP = {
    "created": ("project", "project", "Project created"),
    "updated": ("project", "project", "Project updated"),
    "deleted": ("project", "project", "Project deleted"),
    "member_added": ("project", "member", "Member added"),
    "member_removed": ("project", "member", "Member removed"),
    "task_created": ("task", "task", "Task created"),
    "task_updated": ("task", "task", "Task updated"),
    "task_deleted": ("task", "task", "Task deleted"),
    "task_progress_changed": ("task", "progress", "Task progress changed"),
    "task_status_changed": ("status", "status", "Task status changed"),
    "task_assigned": ("assignment", "assignment", "Task assigned"),
    "checklist_item_created": ("checklist", "checklist", "Checklist item added"),
    "checklist_item_updated": ("checklist", "checklist", "Checklist item updated"),
    "checklist_item_completed": ("checklist", "checklist", "Checklist item completed"),
    "checklist_item_reopened": ("checklist", "checklist", "Checklist item reopened"),
    "checklist_item_deleted": ("checklist", "checklist", "Checklist item deleted"),
    "comment_added": ("comment", "comment", "Task comment added"),
    "comment_deleted": ("comment", "comment", "Task comment deleted"),
    "dependency_created": ("dependency", "dependency", "Dependency created"),
    "dependency_removed": ("dependency", "dependency", "Dependency removed"),
    "note_created": ("note", "note", "Note created"),
    "note_updated": ("note", "note", "Note updated"),
    "note_deleted": ("note", "note", "Note deleted"),
    "issue_created": ("issue", "issue", "Issue created"),
    "issue_updated": ("issue", "issue", "Issue updated"),
    "issue_deleted": ("issue", "issue", "Issue deleted"),
    "issue_status_changed": ("status", "status", "Issue status changed"),
    "issue_comment_added": ("comment", "comment", "Issue comment added"),
    "issue_comment_deleted": ("comment", "comment", "Issue comment deleted"),
    # Attachment actions if ever written to ProjectHistory
    "attachment_uploaded": ("attachment", "attachment", "Attachment uploaded"),
    "attachment_deleted": ("attachment", "attachment", "Attachment deleted"),
    "project_accomplishment_changed": (
        "project",
        "progress",
        "Project accomplishment changed",
    ),
    "project_progress_recalculated": (
        "project",
        "progress",
        "Project progress recalculated",
    ),
    "operational_link_created": ("link", "link", "Operational link created"),
    "operational_link_updated": ("link", "link", "Operational link updated"),
    "operational_link_removed": ("link", "link", "Operational link removed"),
}

VALID_EVENT_CATEGORIES = frozenset(
    {
        "project",
        "task",
        "issue",
        "note",
        "attachment",
        "comment",
        "status",
        "assignment",
        "dependency",
        "checklist",
        "link",
    }
)


def _actor_payload(actor):
    if actor is None:
        return None
    full_name = f"{actor.first_name} {actor.last_name}".strip()
    return {
        "id": str(actor.id),
        "name": full_name or actor.email,
        "email": actor.email,
    }


def _related_object(action, metadata):
    metadata = metadata or {}
    if action.startswith("note_") or metadata.get("note_id"):
        return {
            "type": "project_note",
            "id": metadata.get("note_id"),
            "code": None,
        }
    if action.startswith("issue_") or metadata.get("issue_id"):
        return {
            "type": "project_issue",
            "id": metadata.get("issue_id"),
            "code": None,
        }
    if (
        action.startswith("task_")
        or action.startswith("checklist_")
        or action in ("comment_added", "comment_deleted")
        or metadata.get("task_id")
    ):
        return {
            "type": "project_task",
            "id": metadata.get("task_id"),
            "code": metadata.get("task_code"),
        }
    if action.startswith("dependency_") or metadata.get("dependency_id"):
        return {
            "type": "project_task_dependency",
            "id": metadata.get("dependency_id"),
            "code": None,
        }
    if action.startswith("operational_link_") or metadata.get("link_id"):
        return {
            "type": "project_operational_link",
            "id": metadata.get("link_id"),
            "code": metadata.get("link_type"),
        }
    if action.startswith("attachment_") or metadata.get("attachment_id"):
        return {
            "type": "attachment",
            "id": metadata.get("attachment_id"),
            "code": None,
        }
    if action in (
        "created",
        "updated",
        "deleted",
        "member_added",
        "member_removed",
        "project_accomplishment_changed",
        "project_progress_recalculated",
    ):
        return {
            "type": "project",
            "id": metadata.get("project_id"),
            "code": metadata.get("project_code"),
        }
    return None


def history_entry_to_timeline_dto(entry: ProjectHistory) -> dict:
    category, icon, title = _ACTION_MAP.get(
        entry.action,
        ("project", "history", entry.action.replace("_", " ").title()),
    )
    return {
        "id": str(entry.id),
        "timestamp": entry.created_at,
        "actor": _actor_payload(entry.actor),
        "event_type": entry.action,
        "category": category,
        "title": title,
        "description": entry.description,
        "related_object": _related_object(entry.action, entry.metadata),
        "icon": icon,
        "metadata": entry.metadata or {},
    }


def _parse_datetime_bound(raw):
    if not raw:
        return None
    parsed = parse_datetime(str(raw))
    if parsed:
        return parsed
    date_only = parse_date(str(raw))
    if date_only:
        from datetime import datetime, time

        from django.utils import timezone as dj_tz

        dt = datetime.combine(date_only, time.min)
        if dj_tz.is_naive(dt):
            dt = dj_tz.make_aware(dt, dj_tz.get_current_timezone())
        return dt
    return None


def build_timeline_queryset(*, project, params=None):
    """Return ProjectHistory queryset filtered for the timeline stream.

    Newest-first by default. Filters: category/event_category, event_type,
    search, actor, date_from/date_to, ordering.
    """
    params = params or {}
    queryset = (
        ProjectHistory.objects.filter(project=project, is_deleted=False)
        .select_related("actor")
        .order_by("-created_at")
    )

    category = (
        params.get("event_category")
        or params.get("category")
        or ""
    ).strip().lower()
    if category and category in VALID_EVENT_CATEGORIES:
        matching_actions = [
            action
            for action, (mapped_category, *_rest) in _ACTION_MAP.items()
            if mapped_category == category
        ]
        queryset = queryset.filter(action__in=matching_actions)

    event_type = (params.get("event_type") or params.get("action") or "").strip()
    if event_type:
        queryset = queryset.filter(action=event_type)

    actor = params.get("actor")
    if actor not in (None, ""):
        queryset = queryset.filter(actor_id=actor)

    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(description__icontains=search)
            | Q(action__icontains=search)
            | Q(actor__email__icontains=search)
            | Q(actor__first_name__icontains=search)
            | Q(actor__last_name__icontains=search)
        )

    date_from = _parse_datetime_bound(params.get("date_from"))
    date_to = _parse_datetime_bound(params.get("date_to"))
    if date_from:
        queryset = queryset.filter(created_at__gte=date_from)
    if date_to:
        # Inclusive end-of-day when date-only was provided is handled by caller
        # passing datetime; for date-only we already used midnight — bump to
        # end of day when original looked like a date.
        raw_to = str(params.get("date_to") or "")
        if parse_date(raw_to) and not parse_datetime(raw_to):
            from datetime import datetime, time

            from django.utils import timezone as dj_tz

            end = datetime.combine(parse_date(raw_to), time.max)
            if dj_tz.is_naive(end):
                end = dj_tz.make_aware(end, dj_tz.get_current_timezone())
            queryset = queryset.filter(created_at__lte=end)
        else:
            queryset = queryset.filter(created_at__lte=date_to)

    ordering = (params.get("ordering") or "-created_at").strip()
    ordering_map = {
        "created_at": "created_at",
        "-created_at": "-created_at",
        "created": "created_at",
        "-created": "-created_at",
        "timestamp": "created_at",
        "-timestamp": "-created_at",
    }
    resolved = ordering_map.get(ordering, "-created_at")
    return queryset.order_by(resolved)
