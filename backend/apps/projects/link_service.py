"""FO-108 project operational link service.

Owns create/update/soft-delete of ProjectOperationalLink. Never mutates
FM ticket / maintenance WO / inspection status or workflow fields.
"""

from __future__ import annotations

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.access_control.services import user_has_permission
from apps.fm_tickets.models import FmTicket
from apps.fm_tickets.tenant_scope import (
    scope_fm_ticket_queryset,
    uses_employee_requester_scope,
)
from apps.inspection.models import Inspection
from apps.inspection.tenant_scope import scope_queryset_to_user as scope_inspections_to_user
from apps.maintenance.models import MaintenanceWorkOrder
from apps.maintenance.tenant_scope import scope_work_orders_to_user

from .models import Project, ProjectOperationalLink, ProjectTask
from .services import _ensure_project_access, record_history
from .tenant_scope import scope_projects_to_user, user_can_access_tenant

LINK_TYPE_FM = ProjectOperationalLink.LinkType.FM_TICKET
LINK_TYPE_MWO = ProjectOperationalLink.LinkType.MAINTENANCE_WORK_ORDER
LINK_TYPE_INSPECTION = ProjectOperationalLink.LinkType.INSPECTION

_TARGET_PERMISSIONS = {
    LINK_TYPE_FM: ("fm_tickets.view", "fm_tickets.manage"),
    LINK_TYPE_MWO: ("maintenance.view", "maintenance.manage"),
    LINK_TYPE_INSPECTION: ("inspection.view", "inspection.manage"),
}


def validate_exactly_one_target(*, fm_ticket=None, maintenance_work_order=None, inspection=None):
    present = [
        name
        for name, value in (
            ("fm_ticket", fm_ticket),
            ("maintenance_work_order", maintenance_work_order),
            ("inspection", inspection),
        )
        if value is not None
    ]
    if len(present) != 1:
        raise ValidationError(
            {
                "link_type": (
                    "Exactly one of fm_ticket, maintenance_work_order, or "
                    "inspection must be provided."
                )
            }
        )
    return present[0]


def resolve_target(*, link_type=None, fm_ticket=None, maintenance_work_order=None, inspection=None):
    """Return (link_type, target_instance) after validating exactly one target."""
    field = validate_exactly_one_target(
        fm_ticket=fm_ticket,
        maintenance_work_order=maintenance_work_order,
        inspection=inspection,
    )
    if field == "fm_ticket":
        resolved_type = LINK_TYPE_FM
        target = fm_ticket
    elif field == "maintenance_work_order":
        resolved_type = LINK_TYPE_MWO
        target = maintenance_work_order
    else:
        resolved_type = LINK_TYPE_INSPECTION
        target = inspection

    if link_type and link_type != resolved_type:
        raise ValidationError(
            {
                "link_type": (
                    f"link_type must be '{resolved_type}' for the selected target."
                )
            }
        )
    if target is None or getattr(target, "is_deleted", False):
        raise ValidationError({"link_type": "Target operational record was not found."})
    return resolved_type, target


def _actor_has_any_permission(actor, codes):
    return any(user_has_permission(actor, code) for code in codes)


def user_can_view_target(actor, link_type, target) -> bool:
    """Dual-auth: tenant + module permission (+ FM employee requester scope)."""
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    if not user_can_access_tenant(actor, target.tenant_id):
        return False
    if getattr(target, "is_deleted", False):
        return False

    perms = _TARGET_PERMISSIONS.get(link_type)
    if not perms or not _actor_has_any_permission(actor, perms):
        return False

    if link_type == LINK_TYPE_FM and uses_employee_requester_scope(actor):
        return str(target.requester_id) == str(actor.id)

    return True


def _safe_target_fields(link_type, target) -> dict:
    if link_type == LINK_TYPE_FM:
        return {
            "target_id": str(target.id),
            "target_number": target.ticket_number,
            "target_title": target.title,
            "target_status": target.status,
        }
    if link_type == LINK_TYPE_MWO:
        return {
            "target_id": str(target.id),
            "target_number": target.work_order_number,
            "target_title": target.title,
            "target_status": target.status,
        }
    return {
        "target_id": str(target.id),
        "target_number": target.inspection_number,
        "target_title": target.title,
        "target_status": target.status,
    }


def resolve_target_from_link(link: ProjectOperationalLink):
    if link.link_type == LINK_TYPE_FM:
        return link.fm_ticket
    if link.link_type == LINK_TYPE_MWO:
        return link.maintenance_work_order
    if link.link_type == LINK_TYPE_INSPECTION:
        return link.inspection
    return None


def build_safe_summary(actor, link: ProjectOperationalLink) -> dict:
    """Serialize a link with dual-auth target redaction."""
    target = resolve_target_from_link(link)
    base = {
        "id": str(link.id),
        "project_id": str(link.project_id),
        "link_type": link.link_type,
        "relationship": link.relationship,
        "notes": link.notes,
        "project_task_id": (
            str(link.project_task_id) if link.project_task_id else None
        ),
        "created_at": link.created_at,
        "updated_at": link.updated_at,
    }
    if target is None or not user_can_view_target(actor, link.link_type, target):
        return {**base, "target_accessible": False}

    return {
        **base,
        "target_accessible": True,
        **_safe_target_fields(link.link_type, target),
        "fm_ticket_id": str(link.fm_ticket_id) if link.fm_ticket_id else None,
        "maintenance_work_order_id": (
            str(link.maintenance_work_order_id)
            if link.maintenance_work_order_id
            else None
        ),
        "inspection_id": str(link.inspection_id) if link.inspection_id else None,
    }


def active_links_for_project(project):
    return (
        ProjectOperationalLink.objects.filter(
            project=project,
            is_deleted=False,
            project__is_deleted=False,
        )
        .select_related(
            "project",
            "project_task",
            "fm_ticket",
            "maintenance_work_order",
            "inspection",
            "tenant",
        )
        .order_by("-created_at")
    )


def list_links(*, project, actor):
    _ensure_project_access(actor=actor, project=project)
    links = list(active_links_for_project(project))
    return [build_safe_summary(actor, link) for link in links]


def _history_metadata(link, **extra):
    payload = {
        "link_id": str(link.id),
        "link_type": link.link_type,
        "relationship": link.relationship,
        "target_id": str(link.target_id()) if link.target_id() else None,
        "project_task_id": (
            str(link.project_task_id) if link.project_task_id else None
        ),
    }
    payload.update(extra)
    return payload


def _safe_history_description(action_label, link):
    """Timeline-safe description — no private target notes/content."""
    number = None
    target = resolve_target_from_link(link)
    if target is not None:
        if link.link_type == LINK_TYPE_FM:
            number = getattr(target, "ticket_number", None)
        elif link.link_type == LINK_TYPE_MWO:
            number = getattr(target, "work_order_number", None)
        else:
            number = getattr(target, "inspection_number", None)
    label = number or str(link.target_id() or "")
    return (
        f"Operational link {action_label}: {link.link_type} "
        f"({label}) as {link.relationship}."
    )


@transaction.atomic
def create_link(
    *,
    project,
    actor,
    link_type=None,
    fm_ticket=None,
    maintenance_work_order=None,
    inspection=None,
    relationship=None,
    notes="",
    project_task=None,
):
    """Create an operational link. Does not mutate the target."""
    _ensure_project_access(actor=actor, project=project)

    resolved_type, target = resolve_target(
        link_type=link_type,
        fm_ticket=fm_ticket,
        maintenance_work_order=maintenance_work_order,
        inspection=inspection,
    )

    if target.tenant_id != project.tenant_id:
        raise ValidationError(
            {"tenant": "Target must belong to the same tenant as the project."}
        )

    if not user_can_view_target(actor, resolved_type, target):
        raise PermissionDenied("You cannot link an operational record you cannot view.")

    if project_task is not None:
        if project_task.is_deleted or project_task.project_id != project.id:
            raise ValidationError(
                {"project_task": "Project task must belong to this project."}
            )

    relationship = relationship or ProjectOperationalLink.Relationship.RELATED
    actor_id = str(actor.id) if actor else None

    link = ProjectOperationalLink(
        tenant=project.tenant,
        project=project,
        project_task=project_task,
        link_type=resolved_type,
        fm_ticket=target if resolved_type == LINK_TYPE_FM else None,
        maintenance_work_order=target if resolved_type == LINK_TYPE_MWO else None,
        inspection=target if resolved_type == LINK_TYPE_INSPECTION else None,
        relationship=relationship,
        notes=notes or "",
        created_by=actor_id,
        updated_by=actor_id,
    )
    link.save()

    record_history(
        project=project,
        action="operational_link_created",
        description=_safe_history_description("created", link),
        actor=actor,
        metadata=_history_metadata(link),
    )
    return link


@transaction.atomic
def update_link(*, link, actor, data):
    """Update relationship / notes / project_task only — never the target."""
    project = link.project
    _ensure_project_access(actor=actor, project=project)

    if link.is_deleted:
        raise ValidationError({"link": "Link is already deleted."})

    forbidden = {
        "fm_ticket",
        "maintenance_work_order",
        "inspection",
        "link_type",
        "project",
        "tenant",
    }
    illegal = forbidden.intersection(data.keys())
    if illegal:
        raise ValidationError(
            {field: "Target and link_type cannot be changed." for field in illegal}
        )

    allowed = {}
    if "relationship" in data:
        allowed["relationship"] = data["relationship"]
    if "notes" in data:
        allowed["notes"] = data["notes"] if data["notes"] is not None else ""
    if "project_task" in data:
        task = data["project_task"]
        if task is not None:
            if task.is_deleted or task.project_id != project.id:
                raise ValidationError(
                    {"project_task": "Project task must belong to this project."}
                )
        allowed["project_task"] = task

    changes = {}
    for field, value in allowed.items():
        previous = getattr(link, field)
        if previous != value:
            changes[field] = {
                "from": str(getattr(previous, "id", previous))
                if previous is not None
                else None,
                "to": str(getattr(value, "id", value)) if value is not None else None,
            }
            setattr(link, field, value)

    if not changes:
        return link

    actor_id = str(actor.id) if actor else None
    link.updated_by = actor_id
    link.save()

    record_history(
        project=project,
        action="operational_link_updated",
        description=_safe_history_description("updated", link),
        actor=actor,
        metadata=_history_metadata(link, changes=changes),
    )
    return link


@transaction.atomic
def soft_delete_link(*, link, actor):
    project = link.project
    _ensure_project_access(actor=actor, project=project)

    if link.is_deleted:
        raise ValidationError({"link": "Link is already deleted."})

    actor_id = str(actor.id) if actor else None
    link.is_deleted = True
    link.deleted_at = timezone.now()
    link.deleted_by = actor_id
    link.updated_by = actor_id
    link.save(
        update_fields=(
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "updated_by",
            "updated_at",
        )
    )
    record_history(
        project=project,
        action="operational_link_removed",
        description=_safe_history_description("removed", link),
        actor=actor,
        metadata=_history_metadata(link),
    )
    return link


def assert_task_has_no_active_operational_links(task: ProjectTask):
    """Block soft-delete when active operational links reference the task."""
    links = ProjectOperationalLink.objects.filter(
        project_task_id=task.id,
        is_deleted=False,
        project__is_deleted=False,
    )
    link_ids = list(links.values_list("id", flat=True))
    if not link_ids:
        return

    details = list(
        links.values(
            "id",
            "link_type",
            "relationship",
            "fm_ticket_id",
            "maintenance_work_order_id",
            "inspection_id",
        )
    )
    raise ValidationError(
        {
            "task": (
                "Cannot delete task while active operational links reference it "
                f"({len(link_ids)}). Remove or reassign links first."
            ),
            "operational_link_count": len(link_ids),
            "operational_link_ids": [str(i) for i in link_ids],
            "operational_links": [
                {
                    "id": str(row["id"]),
                    "link_type": row["link_type"],
                    "relationship": row["relationship"],
                    "fm_ticket_id": (
                        str(row["fm_ticket_id"]) if row["fm_ticket_id"] else None
                    ),
                    "maintenance_work_order_id": (
                        str(row["maintenance_work_order_id"])
                        if row["maintenance_work_order_id"]
                        else None
                    ),
                    "inspection_id": (
                        str(row["inspection_id"]) if row["inspection_id"] else None
                    ),
                }
                for row in details
            ],
        }
    )


def _already_linked_target_ids(project, link_type):
    qs = ProjectOperationalLink.objects.filter(
        project=project,
        link_type=link_type,
        is_deleted=False,
    )
    if link_type == LINK_TYPE_FM:
        return set(
            qs.exclude(fm_ticket_id=None).values_list("fm_ticket_id", flat=True)
        )
    if link_type == LINK_TYPE_MWO:
        return set(
            qs.exclude(maintenance_work_order_id=None).values_list(
                "maintenance_work_order_id", flat=True
            )
        )
    return set(
        qs.exclude(inspection_id=None).values_list("inspection_id", flat=True)
    )


def link_options(*, project, actor, link_type, search="", page_size=None):
    """Search linkable targets scoped by tenant + permission; exclude linked."""
    _ensure_project_access(actor=actor, project=project)

    if link_type not in (LINK_TYPE_FM, LINK_TYPE_MWO, LINK_TYPE_INSPECTION):
        raise ValidationError(
            {
                "type": (
                    "type must be fm_ticket, maintenance_work_order, or inspection."
                )
            }
        )

    perms = _TARGET_PERMISSIONS[link_type]
    if not _actor_has_any_permission(actor, perms):
        raise PermissionDenied("You cannot search operational records of this type.")

    # Employee requester scope cannot use project link-options for FM (internal).
    if link_type == LINK_TYPE_FM and uses_employee_requester_scope(actor):
        return FmTicket.objects.none()

    linked_ids = _already_linked_target_ids(project, link_type)
    search = (search or "").strip()

    if link_type == LINK_TYPE_FM:
        qs = FmTicket.objects.filter(
            tenant_id=project.tenant_id,
            is_deleted=False,
        )
        qs = scope_fm_ticket_queryset(qs, actor).exclude(id__in=linked_ids)
        if search:
            qs = qs.filter(
                Q(ticket_number__icontains=search) | Q(title__icontains=search)
            )
        return qs.order_by("-created_at")

    if link_type == LINK_TYPE_MWO:
        qs = MaintenanceWorkOrder.objects.filter(
            tenant_id=project.tenant_id,
            is_deleted=False,
        )
        qs = scope_work_orders_to_user(qs, actor).exclude(id__in=linked_ids)
        if search:
            qs = qs.filter(
                Q(work_order_number__icontains=search) | Q(title__icontains=search)
            )
        return qs.order_by("-created_at")

    qs = Inspection.objects.filter(
        tenant_id=project.tenant_id,
        is_deleted=False,
    )
    qs = scope_inspections_to_user(qs, actor).exclude(id__in=linked_ids)
    if search:
        qs = qs.filter(
            Q(inspection_number__icontains=search) | Q(title__icontains=search)
        )
    return qs.order_by("-created_at")


def serialize_link_option(link_type, target) -> dict:
    fields = _safe_target_fields(link_type, target)
    return {
        "id": fields["target_id"],
        "number": fields["target_number"],
        "title": fields["target_title"],
        "status": fields["target_status"],
        "type": link_type,
    }


def reverse_project_summaries_for_target(actor, link_type, target) -> list:
    """Projects linked to a target that the actor can view (projects.view)."""
    if target is None or getattr(target, "is_deleted", False):
        return []

    if link_type == LINK_TYPE_FM and uses_employee_requester_scope(actor):
        return []

    if not _actor_has_any_permission(
        actor, ("projects.view", "projects.manage", "projects.links.view")
    ):
        return []

    filter_kwargs = {
        "link_type": link_type,
        "is_deleted": False,
        "project__is_deleted": False,
    }
    if link_type == LINK_TYPE_FM:
        filter_kwargs["fm_ticket_id"] = target.id
    elif link_type == LINK_TYPE_MWO:
        filter_kwargs["maintenance_work_order_id"] = target.id
    elif link_type == LINK_TYPE_INSPECTION:
        filter_kwargs["inspection_id"] = target.id
    else:
        return []

    links = (
        ProjectOperationalLink.objects.filter(**filter_kwargs)
        .select_related("project")
        .order_by("-created_at")
    )

    visible_projects = {
        str(p.id): p
        for p in scope_projects_to_user(
            Project.objects.filter(is_deleted=False),
            actor,
        )
    }

    summaries = []
    for link in links:
        project = visible_projects.get(str(link.project_id))
        if project is None:
            continue
        summaries.append(
            {
                "id": str(project.id),
                "project_code": project.project_code,
                "name": project.name,
                "status": project.status,
                "link_id": str(link.id),
                "relationship": link.relationship,
                "link_type": link.link_type,
            }
        )
    return summaries
