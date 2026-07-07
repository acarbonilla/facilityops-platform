from decimal import Decimal

from apps.core.models import BaseModel
from apps.master_data.models import Area, Building, Department, Floor, Organization, Tenant
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .validators import collect_location_validation_errors, validate_score_range


class Inspection(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        VERIFIED = "verified", "Verified"
        CANCELLED = "cancelled", "Cancelled"
        REOPENED = "reopened", "Reopened"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class InspectionType(models.TextChoices):
        ROUTINE = "routine", "Routine"
        AUDIT = "audit", "Audit"
        SPOT_CHECK = "spot_check", "Spot Check"
        FOLLOW_UP = "follow_up", "Follow Up"

    class FiveSCategory(models.TextChoices):
        SORT = "sort", "Sort"
        SET_IN_ORDER = "set_in_order", "Set In Order"
        SHINE = "shine", "Shine"
        STANDARDIZE = "standardize", "Standardize"
        SUSTAIN = "sustain", "Sustain"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspections",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.PROTECT,
        related_name="inspections",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspections",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspections",
    )
    inspection_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    inspection_type = models.CharField(
        max_length=32,
        choices=InspectionType.choices,
        default=InspectionType.ROUTINE,
        db_index=True,
    )
    five_s_category = models.CharField(
        max_length=32,
        choices=FiveSCategory.choices,
        default=FiveSCategory.SUSTAIN,
        db_index=True,
    )
    inspection_template = models.CharField(max_length=150, blank=True)
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_inspections",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_inspections",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    scheduled_date = models.DateTimeField(null=True, blank=True, db_index=True)
    started_date = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)
    verified_date = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    remarks = models.TextField(blank=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]

    def __str__(self):
        return self.inspection_number or self.title

    def clean(self):
        super().clean()

        errors = collect_location_validation_errors(self)

        if self.inspector_id and self.inspector.tenant_id != self.tenant_id:
            errors["inspector"] = "Inspector must belong to the selected tenant."

        if self.supervisor_id and self.supervisor.tenant_id != self.tenant_id:
            errors["supervisor"] = "Supervisor must belong to the selected tenant."

        if (
            self.inspector_id
            and self.supervisor_id
            and self.inspector_id == self.supervisor_id
        ):
            errors["supervisor"] = "Inspector and supervisor must be different users."

        if (
            self.started_date
            and self.completed_date
            and self.completed_date < self.started_date
        ):
            errors["completed_date"] = "Completed date must be after the started date."

        if self.completed_date and self.status not in {
            self.Status.COMPLETED,
            self.Status.VERIFIED,
        }:
            errors["completed_date"] = (
                "Completed date is only valid for completed or verified inspections."
            )

        if self.verified_date and self.status != self.Status.VERIFIED:
            errors["verified_date"] = (
                "Verified date is only valid for verified inspections."
            )

        if self.status == self.Status.VERIFIED and not self.completed_date:
            errors["completed_date"] = "Verified inspections must have a completed date."

        if self.score is not None:
            try:
                validate_score_range(self.score)
            except ValidationError as exception:
                errors.update(exception.message_dict)

        if errors:
            raise ValidationError(errors)

    def _generate_inspection_number(self):
        date_part = timezone.localdate().strftime("%Y%m%d")
        prefix = f"INSP-{date_part}-"
        latest_number = (
            self.__class__.objects.filter(inspection_number__startswith=prefix)
            .order_by("-inspection_number")
            .values_list("inspection_number", flat=True)
            .first()
        )
        if latest_number:
            last_sequence = int(latest_number.rsplit("-", 1)[-1])
        else:
            last_sequence = 0
        return f"{prefix}{last_sequence + 1:04d}"

    def save(self, *args, **kwargs):
        if not self.inspection_number:
            self.inspection_number = self._generate_inspection_number()
        self.full_clean()
        return super().save(*args, **kwargs)


class InspectionItem(BaseModel):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="items",
    )
    sequence = models.PositiveIntegerField(default=1)
    checklist_item = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    expected_result = models.TextField(blank=True)
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5.00"),
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    is_pass = models.BooleanField(null=True, blank=True)
    observation = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["sequence", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("inspection", "sequence"),
                name="unique_inspection_item_sequence",
            )
        ]

    def __str__(self):
        return f"{self.inspection} item {self.sequence}"

    def clean(self):
        super().clean()
        errors = {}

        if self.max_score <= Decimal("0.00"):
            errors["max_score"] = "Max score must be greater than zero."

        if self.score is not None and (self.score < Decimal("0.00") or self.score > self.max_score):
            errors["score"] = "Score must be between 0 and the max score."

        if self.is_pass is None and self.score is not None:
            errors["is_pass"] = "Pass / fail must be set when a score is provided."

        if errors:
            raise ValidationError(errors)


class InspectionFinding(BaseModel):
    class FindingType(models.TextChoices):
        NON_CONFORMANCE = "non_conformance", "Non-Conformance"
        OBSERVATION = "observation", "Observation"
        IMPROVEMENT = "improvement", "Improvement"
        HAZARD = "hazard", "Hazard"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        VERIFIED = "verified", "Verified"

    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="findings",
    )
    item = models.ForeignKey(
        InspectionItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="findings",
    )
    finding_type = models.CharField(max_length=32, choices=FindingType.choices)
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM,
        db_index=True,
    )
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    recommendation = models.TextField(blank=True)
    ai_recommendation = models.TextField(blank=True)
    photo_path = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.inspection} finding {self.severity}"

    def clean(self):
        super().clean()
        if self.item_id and self.item.inspection_id != self.inspection_id:
            raise ValidationError({"item": "Finding item must belong to the inspection."})


class InspectionAttachment(BaseModel):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    finding = models.ForeignKey(
        InspectionFinding,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_attachments",
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

    def clean(self):
        super().clean()
        if self.finding_id and self.finding.inspection_id != self.inspection_id:
            raise ValidationError(
                {"finding": "Attachment finding must belong to the inspection."}
            )


class InspectionComment(BaseModel):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inspection_comments",
    )
    body = models.TextField()
    is_internal = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.inspection} comment by {self.author}"


class InspectionAssignment(BaseModel):
    class Role(models.TextChoices):
        INSPECTOR = "inspector", "Inspector"
        SUPERVISOR = "supervisor", "Supervisor"
        VERIFIER = "verifier", "Verifier"

    class AssignmentStatus(models.TextChoices):
        ASSIGNED = "assigned", "Assigned"
        REASSIGNED = "reassigned", "Reassigned"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inspection_assignments",
    )
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_assignments_received",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_assignments_created",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.INSPECTOR,
    )
    assignment_status = models.CharField(
        max_length=20,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ASSIGNED,
        db_index=True,
    )
    note = models.TextField(blank=True)
    assigned_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_at", "-created_at"]

    def __str__(self):
        return f"{self.inspection} -> {self.assigned_to or 'Unassigned'}"

    def clean(self):
        super().clean()
        errors = {}

        if self.tenant_id and self.inspection_id and self.tenant_id != self.inspection.tenant_id:
            errors["tenant"] = "Assignment tenant must match the inspection tenant."

        if self.assigned_to_id and self.assigned_to.tenant_id != self.inspection.tenant_id:
            errors["assigned_to"] = "Assigned user must belong to the inspection tenant."

        if self.unassigned_at and self.is_active:
            errors["is_active"] = "Inactive timestamp is only valid for inactive assignments."

        if not self.is_active and not self.unassigned_at:
            errors["unassigned_at"] = (
                "Inactive assignments must include an unassigned timestamp."
            )

        if errors:
            raise ValidationError(errors)


class InspectionHistory(BaseModel):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_history_entries",
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.inspection} {self.action}"


class InspectionStatusHistory(BaseModel):
    class Action(models.TextChoices):
        SCHEDULE = "schedule", "Schedule"
        ASSIGN = "assign", "Assign"
        START = "start", "Start"
        COMPLETE = "complete", "Complete"
        VERIFY = "verify", "Verify"
        CANCEL = "cancel", "Cancel"
        REOPEN = "reopen", "Reopen"
        SYSTEM = "system", "System"

    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="status_history_entries",
    )
    from_status = models.CharField(
        max_length=20,
        choices=Inspection.Status.choices,
        null=True,
        blank=True,
    )
    to_status = models.CharField(
        max_length=20,
        choices=Inspection.Status.choices,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_status_changes",
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
        return f"{self.inspection} {self.from_status or 'none'} -> {self.to_status}"


class InspectionAIAnalysis(BaseModel):
    inspection = models.OneToOneField(
        Inspection,
        on_delete=models.CASCADE,
        related_name="ai_analysis",
    )
    summary = models.TextField(blank=True)
    analysis = models.TextField(blank=True)
    recommendation_summary = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    source_notes = models.TextField(blank=True)
    generated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"AI analysis for {self.inspection}"


class InspectionCorrectiveAction(BaseModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        VERIFIED = "verified", "Verified"
        CANCELLED = "cancelled", "Cancelled"
        OVERDUE = "overdue", "Overdue"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"
        NOT_REQUIRED = "not_required", "Not Required"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inspection_corrective_actions",
    )
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="corrective_actions",
    )
    finding = models.ForeignKey(
        InspectionFinding,
        on_delete=models.CASCADE,
        related_name="corrective_actions",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_corrective_actions",
    )
    due_date = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    completion_date = models.DateTimeField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["due_date", "created_at"]

    def __str__(self):
        return f"{self.inspection} corrective action"

    def clean(self):
        super().clean()
        errors = {}

        if self.tenant_id and self.inspection_id and self.tenant_id != self.inspection.tenant_id:
            errors["tenant"] = (
                "Corrective action tenant must match the inspection tenant."
            )

        if self.finding_id and self.finding.inspection_id != self.inspection_id:
            errors["finding"] = "Finding must belong to the inspection."

        if self.assigned_to_id and self.assigned_to.tenant_id != self.inspection.tenant_id:
            errors["assigned_to"] = "Assigned user must belong to the inspection tenant."

        if self.completion_date and self.status not in {
            self.Status.COMPLETED,
            self.Status.VERIFIED,
        }:
            errors["completion_date"] = (
                "Completion date is only valid for completed or verified actions."
            )

        if self.status == self.Status.VERIFIED and self.verification_status != self.VerificationStatus.VERIFIED:
            errors["verification_status"] = (
                "Verified actions must have verified verification status."
            )

        if self.verification_status == self.VerificationStatus.VERIFIED and not self.completion_date:
            errors["completion_date"] = (
                "Verified corrective actions must have a completion date."
            )

        if errors:
            raise ValidationError(errors)


class InspectionSLA(BaseModel):
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        WITHIN_SLA = "within_sla", "Within SLA"
        AT_RISK = "at_risk", "At Risk"
        BREACHED = "breached", "Breached"
        MET = "met", "Met"
        MISSED = "missed", "Missed"
        VERIFIED = "verified", "Verified"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inspection_sla_records",
    )
    inspection = models.OneToOneField(
        Inspection,
        on_delete=models.CASCADE,
        related_name="sla_record",
    )
    target_minutes = models.PositiveIntegerField(default=1440)
    warning_minutes = models.PositiveIntegerField(default=240)
    due_at = models.DateTimeField(null=True, blank=True)
    verification_due_at = models.DateTimeField(null=True, blank=True)
    completion_met = models.BooleanField(null=True, blank=True)
    verification_met = models.BooleanField(null=True, blank=True)
    completion_breached = models.BooleanField(default=False)
    verification_breached = models.BooleanField(default=False)
    sla_status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_APPLICABLE,
        db_index=True,
    )
    last_recalculated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"SLA for {self.inspection}"


class InspectionEscalation(BaseModel):
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
        SCHEDULE_BREACH = "schedule_breach", "Schedule Breach"
        COMPLETION_BREACH = "completion_breach", "Completion Breach"
        VERIFICATION_BREACH = "verification_breach", "Verification Breach"
        CORRECTIVE_ACTION_OVERDUE = "corrective_action_overdue", "Corrective Action Overdue"
        MANUAL = "manual", "Manual"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inspection_escalations",
    )
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name="escalations",
    )
    sla = models.ForeignKey(
        InspectionSLA,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="escalations",
    )
    corrective_action = models.ForeignKey(
        InspectionCorrectiveAction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escalations",
    )
    escalated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_escalations_created",
    )
    escalated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_escalations_received",
    )
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_escalations_acknowledged",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inspection_escalations_resolved",
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

    def __str__(self):
        return f"{self.inspection} escalation {self.level}"

    def clean(self):
        super().clean()
        errors = {}

        if self.tenant_id and self.inspection_id and self.tenant_id != self.inspection.tenant_id:
            errors["tenant"] = "Escalation tenant must match the inspection tenant."

        if self.sla_id and self.sla.inspection_id != self.inspection_id:
            errors["sla"] = "Escalation SLA must belong to the inspection."

        if self.corrective_action_id and self.corrective_action.inspection_id != self.inspection_id:
            errors["corrective_action"] = (
                "Escalation corrective action must belong to the inspection."
            )

        if self.resolved_at and self.is_active:
            errors["is_active"] = "Resolved escalations cannot remain active."

        if not self.is_active and not self.resolved_at:
            errors["resolved_at"] = (
                "Inactive escalations must include a resolved timestamp."
            )

        if errors:
            raise ValidationError(errors)
