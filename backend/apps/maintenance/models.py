from decimal import Decimal

from apps.core.models import BaseModel
from apps.master_data.models import (
    Area,
    Asset,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .validators import collect_location_validation_errors


class MaintenanceWorkOrder(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        ASSIGNED = "assigned", "Assigned"
        IN_PROGRESS = "in_progress", "In Progress"
        ON_HOLD = "on_hold", "On Hold"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REOPENED = "reopened", "Reopened"
        CLOSED = "closed", "Closed"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="maintenance_work_orders",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="maintenance_work_orders",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_work_orders",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.PROTECT,
        related_name="maintenance_work_orders",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_work_orders",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_work_orders",
    )
    asset = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name="maintenance_work_orders",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="requested_maintenance_work_orders",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_maintenance_work_orders",
    )
    work_order_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    scheduled_start_at = models.DateTimeField(null=True, blank=True)
    scheduled_end_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_at", "-created_at"]

    def __str__(self):
        return self.work_order_number or self.title

    def clean(self):
        super().clean()

        errors = collect_location_validation_errors(self)
        requested_at = self.requested_at or timezone.now()

        if not self.asset_id:
            errors["asset"] = "Asset is required."

        if not self.requester_id:
            errors["requester"] = "Requester is required."

        if self.due_at and self.due_at < requested_at:
            errors["due_at"] = "Due date must be after the requested date."

        if self.scheduled_start_at and self.scheduled_start_at < requested_at:
            errors["scheduled_start_at"] = (
                "Scheduled start must be after the requested date."
            )

        if (
            self.scheduled_start_at
            and self.scheduled_end_at
            and self.scheduled_end_at < self.scheduled_start_at
        ):
            errors["scheduled_end_at"] = (
                "Scheduled end must be after the scheduled start."
            )

        if self.completed_at and self.status not in {
            self.Status.COMPLETED,
            self.Status.CLOSED,
        }:
            errors["completed_at"] = (
                "Completed timestamp is only valid for completed or closed work orders."
            )

        if self.closed_at and self.status != self.Status.CLOSED:
            errors["closed_at"] = (
                "Closed timestamp is only valid for closed work orders."
            )

        if self.status == self.Status.CANCELLED and not self.cancellation_reason:
            errors["cancellation_reason"] = (
                "Cancelled work orders must include a cancellation reason."
            )

        if errors:
            raise ValidationError(errors)

    def _generate_work_order_number(self):
        date_part = timezone.localdate().strftime("%Y%m%d")
        prefix = f"MWO-{date_part}-"
        latest_number = (
            self.__class__.objects.filter(work_order_number__startswith=prefix)
            .order_by("-work_order_number")
            .values_list("work_order_number", flat=True)
            .first()
        )
        if latest_number:
            last_sequence = int(latest_number.rsplit("-", 1)[-1])
        else:
            last_sequence = 0
        return f"{prefix}{last_sequence + 1:04d}"

    def save(self, *args, **kwargs):
        if not self.work_order_number:
            self.work_order_number = self._generate_work_order_number()
        self.full_clean()
        return super().save(*args, **kwargs)


class MaintenanceAssignment(BaseModel):
    class AssignmentType(models.TextChoices):
        TECHNICIAN = "technician", "Technician"
        SUPERVISOR = "supervisor", "Supervisor"
        COMBINED = "combined", "Technician and Supervisor"
        UNASSIGNED = "unassigned", "Unassigned"

    class AssignmentStatus(models.TextChoices):
        ASSIGNED = "assigned", "Assigned"
        REASSIGNED = "reassigned", "Reassigned"
        UNASSIGNED = "unassigned", "Unassigned"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        COMPLETED = "completed", "Completed"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="maintenance_assignments",
    )
    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_assignments_received",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_assignments_created",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_supervision_assignments",
    )
    previous_assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="previous_maintenance_assignments",
    )
    previous_supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="previous_maintenance_supervision_assignments",
    )
    assignment_type = models.CharField(
        max_length=24,
        choices=AssignmentType.choices,
        default=AssignmentType.TECHNICIAN,
    )
    assignment_status = models.CharField(
        max_length=24,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ASSIGNED,
        db_index=True,
    )
    reason = models.TextField(blank=True)
    note = models.TextField(blank=True)
    assigned_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_at", "-created_at"]

    def clean(self):
        super().clean()

        errors = {}
        if self.tenant_id and self.work_order_id:
            work_order_tenant_id = self.work_order.tenant_id
            if self.tenant_id != work_order_tenant_id:
                errors["tenant"] = "Assignment tenant must match the work order tenant."
        if (
            self.assigned_to_id
            and self.supervisor_id
            and self.assigned_to_id == self.supervisor_id
        ):
            errors["supervisor"] = "Technician and supervisor must be different users."
        if self.unassigned_at and self.is_active:
            errors["is_active"] = (
                "Inactive timestamp is only valid for inactive assignments."
            )
        if not self.is_active and not self.unassigned_at:
            errors["unassigned_at"] = (
                "Inactive assignments must include an unassigned timestamp."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.work_order} -> {self.assigned_to or 'Unassigned'}"


class MaintenanceTask(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_tasks",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sequence", "created_at"]

    def clean(self):
        super().clean()

        errors = {}
        if self.completed_at and self.status != self.Status.COMPLETED:
            errors["completed_at"] = (
                "Completed timestamp is only valid for completed tasks."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.work_order} task {self.sequence}"


class MaintenanceMaterial(BaseModel):
    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    task = models.ForeignKey(
        MaintenanceTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials",
    )
    name = models.CharField(max_length=150)
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("1.00")
    )
    unit = models.CharField(max_length=50, default="unit")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "created_at"]

    def __str__(self):
        return f"{self.name} x {self.quantity}"


class MaintenanceLabor(BaseModel):
    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="labor_entries",
    )
    task = models.ForeignKey(
        MaintenanceTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="labor_entries",
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_labor_entries",
    )
    description = models.TextField()
    hours = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    labor_date = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ["-labor_date", "-created_at"]

    def __str__(self):
        return f"{self.work_order} labor {self.hours}h"


class MaintenanceAttachment(BaseModel):
    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_attachments",
    )
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.file_name


class MaintenanceAISummary(BaseModel):
    work_order = models.OneToOneField(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="ai_summary",
    )
    summary = models.TextField()
    model_name = models.CharField(max_length=100, blank=True)
    source_notes = models.TextField(blank=True)
    generated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"AI summary for {self.work_order}"


class MaintenanceSupervisorApproval(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    work_order = models.OneToOneField(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="supervisor_approval",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_supervisor_approvals",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    comments = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.work_order} approval {self.status}"


class MaintenanceCompletion(BaseModel):
    work_order = models.OneToOneField(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="completion_record",
    )
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_completions",
    )
    completion_notes = models.TextField(blank=True)
    resolution_summary = models.TextField(blank=True)
    actual_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )
    downtime_minutes = models.PositiveIntegerField(null=True, blank=True)
    follow_up_required = models.BooleanField(default=False)
    completed_at = models.DateTimeField(default=timezone.now, db_index=True)

    def __str__(self):
        return f"Completion for {self.work_order}"


class MaintenanceHistory(BaseModel):
    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_history_entries",
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.work_order} {self.action}"


class MaintenanceStatusHistory(BaseModel):
    class Action(models.TextChoices):
        SUBMIT = "submit", "Submit"
        ASSIGN = "assign", "Assign"
        START = "start", "Start"
        HOLD = "hold", "Hold"
        RESUME = "resume", "Resume"
        COMPLETE = "complete", "Complete"
        CANCEL = "cancel", "Cancel"
        REOPEN = "reopen", "Reopen"
        SYSTEM = "system", "System"

    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="status_history_entries",
    )
    from_status = models.CharField(
        max_length=20,
        choices=MaintenanceWorkOrder.Status.choices,
        null=True,
        blank=True,
    )
    to_status = models.CharField(
        max_length=20,
        choices=MaintenanceWorkOrder.Status.choices,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_status_changes",
    )
    changed_at = models.DateTimeField(default=timezone.now, db_index=True)
    action = models.CharField(
        max_length=20,
        choices=Action.choices,
        default=Action.SYSTEM,
    )
    reason = models.TextField(blank=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["changed_at", "created_at"]

    def __str__(self):
        return f"{self.work_order} {self.from_status or 'none'} -> {self.to_status}"


class MaintenanceEscalation(BaseModel):
    class Level(models.TextChoices):
        LEVEL_1 = "level_1", "Level 1"
        LEVEL_2 = "level_2", "Level 2"
        LEVEL_3 = "level_3", "Level 3"
        MANAGEMENT = "management", "Management"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"
        CANCELLED = "cancelled", "Cancelled"

    class EscalationType(models.TextChoices):
        RESPONSE_WARNING = "response_warning", "Response Warning"
        RESPONSE_BREACH = "response_breach", "Response Breach"
        COMPLETION_WARNING = "completion_warning", "Completion Warning"
        COMPLETION_BREACH = "completion_breach", "Completion Breach"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="maintenance_escalations",
    )

    work_order = models.ForeignKey(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="escalations",
    )
    sla = models.ForeignKey(
        "MaintenanceSLA",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="escalations",
    )
    escalated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_escalations_created",
    )
    escalated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_escalations_received",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_escalations_resolved",
    )
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="maintenance_escalations_acknowledged",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField()
    escalation_type = models.CharField(
        max_length=32,
        choices=EscalationType.choices,
        default=EscalationType.COMPLETION_BREACH,
        db_index=True,
    )
    level = models.CharField(max_length=20, choices=Level.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        super().clean()

        errors = {}
        if (
            self.tenant_id
            and self.work_order_id
            and self.tenant_id != self.work_order.tenant_id
        ):
            errors["tenant"] = "Escalation tenant must match the work order tenant."
        if (
            self.sla_id
            and self.work_order_id
            and self.sla.work_order_id != self.work_order_id
        ):
            errors["sla"] = "Escalation SLA must belong to the work order."
        if self.resolved_at and self.is_active:
            errors["is_active"] = "Resolved escalations cannot remain active."
        if not self.is_active and not self.resolved_at:
            errors["resolved_at"] = (
                "Inactive escalations must include a resolved timestamp."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.work_order} escalation {self.level}"


class MaintenanceSLA(BaseModel):
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        WITHIN_SLA = "within_sla", "Within SLA"
        AT_RISK = "at_risk", "At Risk"
        BREACHED = "breached", "Breached"
        MET = "met", "Met"
        MISSED = "missed", "Missed"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        WARNING = "warning", "Warning"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="maintenance_sla_records",
    )

    work_order = models.OneToOneField(
        MaintenanceWorkOrder,
        on_delete=models.CASCADE,
        related_name="sla_record",
    )
    priority = models.CharField(
        max_length=20,
        choices=MaintenanceWorkOrder.Priority.choices,
        default=MaintenanceWorkOrder.Priority.MEDIUM,
    )
    response_target_minutes = models.PositiveIntegerField(default=240)
    completion_target_minutes = models.PositiveIntegerField(default=1440)
    response_due_at = models.DateTimeField(null=True, blank=True)
    resolution_due_at = models.DateTimeField(null=True, blank=True)
    first_responded_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    response_met = models.BooleanField(null=True, blank=True)
    resolution_met = models.BooleanField(null=True, blank=True)
    response_breached = models.BooleanField(default=False)
    completion_breached = models.BooleanField(default=False)
    sla_status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_APPLICABLE,
    )
    last_recalculated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"SLA for {self.work_order}"
