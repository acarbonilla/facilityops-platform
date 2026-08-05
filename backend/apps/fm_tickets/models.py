from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

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


class FmTicket(BaseModel):
    class SlaStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        WITHIN_SLA = "within_sla", "Within SLA"
        AT_RISK = "at_risk", "At Risk"
        BREACHED = "breached", "Breached"
        MET = "met", "Met"
        MISSED = "missed", "Missed"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        ASSIGNED = "assigned", "Assigned"
        IN_PROGRESS = "in_progress", "In Progress"
        ON_HOLD = "on_hold", "On Hold"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    class Priority(models.TextChoices):
        PENDING_REVIEW = "pending_review", "Pending Review"
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Category(models.TextChoices):
        UNCLASSIFIED = "unclassified", "Unclassified"
        ELECTRICAL = "electrical", "Electrical"
        PLUMBING = "plumbing", "Plumbing"
        HVAC = "hvac", "HVAC"
        CIVIL = "civil", "Civil"
        SAFETY = "safety", "Safety"
        CLEANING = "cleaning", "Cleaning"
        SECURITY = "security", "Security"
        OTHER = "other", "Other"

    class Source(models.TextChoices):
        WEB = "web", "Web"
        MOBILE = "mobile", "Mobile"
        ADMIN = "admin", "Admin"
        INSPECTION = "inspection", "Inspection"
        SYSTEM = "system", "System"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="fm_tickets",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="fm_tickets",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_tickets",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.PROTECT,
        related_name="fm_tickets",
        null=True,
        blank=True,
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_tickets",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_tickets",
    )
    asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_tickets",
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="requested_fm_tickets",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_fm_tickets",
    )
    ticket_number = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        default=Category.OTHER,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.WEB,
    )
    reported_at = models.DateTimeField(default=timezone.now, db_index=True)
    due_at = models.DateTimeField(null=True, blank=True)
    response_due_at = models.DateTimeField(null=True, blank=True)
    resolution_due_at = models.DateTimeField(null=True, blank=True)
    first_responded_at = models.DateTimeField(null=True, blank=True)
    response_met = models.BooleanField(null=True, blank=True)
    resolution_met = models.BooleanField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-reported_at", "-created_at"]

    def __str__(self):
        return self.ticket_number or self.title

    def clean(self):
        super().clean()

        errors = {}
        reported_at = self.reported_at or timezone.now()

        if self.organization_id and self.organization.tenant_id != self.tenant_id:
            errors["organization"] = "Organization must belong to the selected tenant."

        if self.department_id:
            if self.department.tenant_id != self.tenant_id:
                errors["department"] = "Department must belong to the selected tenant."
            if self.department.organization_id != self.organization_id:
                errors["department"] = (
                    "Department must belong to the selected organization."
                )

        if self.building_id:
            if self.building.tenant_id != self.tenant_id:
                errors["building"] = "Building must belong to the selected tenant."
            if self.building.organization_id != self.organization_id:
                errors["building"] = (
                    "Building must belong to the selected organization."
                )
        elif self.floor_id or self.area_id or self.asset_id:
            errors["building"] = (
                "Building is required when floor, area, or asset is set."
            )

        if self.floor_id:
            if self.floor.tenant_id != self.tenant_id:
                errors["floor"] = "Floor must belong to the selected tenant."
            if self.building_id and self.floor.building_id != self.building_id:
                errors["floor"] = "Floor must belong to the selected building."

        if self.area_id:
            if self.area.tenant_id != self.tenant_id:
                errors["area"] = "Area must belong to the selected tenant."
            if self.building_id and self.area.building_id != self.building_id:
                errors["area"] = "Area must belong to the selected building."
            if self.floor_id and self.area.floor_id != self.floor_id:
                errors["area"] = "Area must belong to the selected floor."

        if self.asset_id:
            if self.asset.tenant_id != self.tenant_id:
                errors["asset"] = "Asset must belong to the selected tenant."
            if self.asset.organization_id != self.organization_id:
                errors["asset"] = "Asset must belong to the selected organization."
            if self.building_id and self.asset.building_id != self.building_id:
                errors["asset"] = "Asset must belong to the selected building."
            if self.floor_id and self.asset.floor_id != self.floor_id:
                errors["asset"] = "Asset must belong to the selected floor."
            if self.area_id and self.asset.area_id != self.area_id:
                errors["asset"] = "Asset must belong to the selected area."

        if self.due_at and self.due_at < reported_at:
            errors["due_at"] = "Due date must be after the reported date."

        if self.response_due_at and self.response_due_at < reported_at:
            errors["response_due_at"] = (
                "Response due date must be after the reported date."
            )

        if self.resolution_due_at and self.resolution_due_at < reported_at:
            errors["resolution_due_at"] = (
                "Resolution due date must be after the reported date."
            )

        if (
            self.response_due_at
            and self.resolution_due_at
            and self.resolution_due_at < self.response_due_at
        ):
            errors["resolution_due_at"] = (
                "Resolution due date must be after the response due date."
            )

        if self.first_responded_at and self.first_responded_at < reported_at:
            errors["first_responded_at"] = (
                "First response timestamp must be after the reported date."
            )

        if (
            self.status == self.Status.CLOSED
            and self.closed_at
            and not self.resolved_at
        ):
            errors["closed_at"] = "Closed tickets must have a resolved timestamp."

        if errors:
            raise ValidationError(errors)

    def _generate_ticket_number(self):
        date_part = timezone.localdate().strftime("%Y%m%d")
        prefix = f"FM-{date_part}-"
        latest_number = (
            self.__class__.objects.filter(ticket_number__startswith=prefix)
            .order_by("-ticket_number")
            .values_list("ticket_number", flat=True)
            .first()
        )
        if latest_number:
            last_sequence = int(latest_number.rsplit("-", 1)[-1])
        else:
            last_sequence = 0
        return f"{prefix}{last_sequence + 1:04d}"

    @staticmethod
    def _calculate_deadline_met(actual_at, due_at):
        if not actual_at:
            return None
        if not due_at:
            return True
        return actual_at <= due_at

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        self.response_met = self._calculate_deadline_met(
            self.first_responded_at,
            self.response_due_at,
        )
        self.resolution_met = self._calculate_deadline_met(
            self.resolved_at,
            self.resolution_due_at,
        )
        self.full_clean()
        return super().save(*args, **kwargs)


class FmTicketEscalation(BaseModel):
    class Level(models.TextChoices):
        LEVEL_1 = "level_1", "Level 1"
        LEVEL_2 = "level_2", "Level 2"
        LEVEL_3 = "level_3", "Level 3"
        MANAGEMENT = "management", "Management"

    ticket = models.ForeignKey(
        FmTicket,
        on_delete=models.CASCADE,
        related_name="escalations",
    )
    escalated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_escalations_created",
    )
    escalated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_escalations_received",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_escalations_resolved",
    )
    reason = models.TextField()
    level = models.CharField(max_length=20, choices=Level.choices)
    is_active = models.BooleanField(default=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        super().clean()

        errors = {}
        if self.resolved_at and self.is_active:
            errors["is_active"] = "Resolved escalations cannot remain active."
        if not self.is_active and not self.resolved_at:
            errors["resolved_at"] = "Inactive escalations must include a resolved timestamp."

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.ticket} escalation {self.level}"


class FmTicketComment(BaseModel):
    ticket = models.ForeignKey(
        FmTicket,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fm_ticket_comments",
    )
    body = models.TextField()
    is_internal = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket} comment by {self.author}"


class FmTicketHistory(BaseModel):
    ticket = models.ForeignKey(
        FmTicket,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_history_entries",
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket} {self.action}"


class FmTicketStatusHistory(BaseModel):
    ticket = models.ForeignKey(
        FmTicket,
        on_delete=models.CASCADE,
        related_name="status_history_entries",
    )
    from_status = models.CharField(
        max_length=20,
        choices=FmTicket.Status.choices,
        null=True,
        blank=True,
    )
    to_status = models.CharField(max_length=20, choices=FmTicket.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_status_changes",
    )
    changed_at = models.DateTimeField(default=timezone.now, db_index=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["changed_at", "created_at"]

    def __str__(self):
        return f"{self.ticket} {self.from_status or 'none'} -> {self.to_status}"


class AITicketAnalysis(BaseModel):
    """FO-084: queued FM ticket image analysis request (placeholder provider for now)."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Decision(models.TextChoices):
        ACCEPTED = "accepted", "Accepted"
        MODIFIED = "modified", "Modified"
        IGNORED = "ignored", "Ignored"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="fm_ticket_ai_analyses",
    )
    ticket = models.ForeignKey(
        FmTicket,
        on_delete=models.CASCADE,
        related_name="ai_analyses",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    queued_at = models.DateTimeField(default=timezone.now, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    model_name = models.CharField(max_length=100, blank=True, default="placeholder")
    model_version = models.CharField(max_length=50, blank=True, default="v0")
    provider = models.CharField(max_length=50, blank=True, default="placeholder", db_index=True)
    prompt_version = models.CharField(max_length=50, blank=True)
    schema_version = models.CharField(max_length=20, blank=True)
    result_json = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    error_code = models.CharField(max_length=64, blank=True, db_index=True)
    retryable = models.BooleanField(default=False)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    input_image_count = models.PositiveSmallIntegerField(null=True, blank=True)
    input_byte_count = models.PositiveIntegerField(null=True, blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_fm_ticket_ai_analyses",
    )
    # FO-087: human review decision (never mutates result_json / ticket fields here).
    decision = models.CharField(
        max_length=20,
        choices=Decision.choices,
        blank=True,
        db_index=True,
    )
    decision_recommended_category = models.CharField(max_length=100, blank=True)
    decision_recommended_priority = models.CharField(max_length=50, blank=True)
    final_category = models.CharField(max_length=50, blank=True)
    final_priority = models.CharField(max_length=20, blank=True)
    decision_at = models.DateTimeField(null=True, blank=True)
    decision_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fm_ticket_ai_recommendation_decisions",
    )

    class Meta:
        ordering = ["-queued_at", "-created_at"]
        indexes = [
            models.Index(
                fields=["tenant", "ticket", "-queued_at"],
                name="fm_ai_tenant_ticket_queued",
            ),
            models.Index(
                fields=["tenant", "status", "-queued_at"],
                name="fm_ai_tenant_status_queued",
            ),
        ]

    def __str__(self):
        return f"AI analysis {self.status} for {self.ticket_id}"


class AITicketAnalysisAttachment(BaseModel):
    """Maps authorized attachment IDs into an AITicketAnalysis job."""

    analysis = models.ForeignKey(
        AITicketAnalysis,
        on_delete=models.CASCADE,
        related_name="analysis_attachments",
    )
    attachment = models.ForeignKey(
        "attachments.Attachment",
        on_delete=models.PROTECT,
        related_name="fm_ticket_ai_analysis_links",
    )

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["analysis", "attachment"],
                name="uniq_fm_ai_analysis_attachment",
            ),
        ]

    def __str__(self):
        return f"{self.analysis_id} -> {self.attachment_id}"


class AIAdminConfig(BaseModel):
    """FO-093: global AI administration configuration (singleton row).

    Scope is platform-global in V1 (no TenantSettings store). Null provider
    fields inherit Django/env defaults. Feature flags default enabled so
    existing workflows remain available until an administrator disables them.
    """

    # Provider (blank/null inherit from Django settings / env)
    provider = models.CharField(max_length=50, blank=True, default="")
    model_name = models.CharField(max_length=100, blank=True, default="")
    enabled = models.BooleanField(null=True, blank=True)
    timeout_seconds = models.PositiveIntegerField(null=True, blank=True)
    max_images = models.PositiveSmallIntegerField(null=True, blank=True)
    max_upload_bytes = models.PositiveIntegerField(null=True, blank=True)
    retry_attempts = models.PositiveSmallIntegerField(null=True, blank=True)
    store_raw_response = models.BooleanField(null=True, blank=True)

    # Feature flags — fail safe when explicitly False
    flag_image_analysis = models.BooleanField(default=True)
    flag_recommendation_engine = models.BooleanField(default=True)
    flag_executive_dashboard = models.BooleanField(default=True)
    flag_similar_cases = models.BooleanField(default=True)
    flag_attention_center = models.BooleanField(default=True)
    flag_operational_insights = models.BooleanField(default=True)

    # Thresholds (null inherit from Django settings)
    confidence_threshold = models.FloatField(null=True, blank=True)
    health_warning_threshold = models.PositiveIntegerField(null=True, blank=True)
    health_critical_threshold = models.PositiveIntegerField(null=True, blank=True)
    attention_warning_threshold = models.PositiveIntegerField(null=True, blank=True)
    attention_critical_threshold = models.PositiveIntegerField(null=True, blank=True)
    acceptance_healthy_rate = models.FloatField(null=True, blank=True)
    override_warning_rate = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name = "AI admin config"
        verbose_name_plural = "AI admin config"

    def __str__(self):
        return f"AIAdminConfig({self.pk})"


class AIAdminAuditEntry(BaseModel):
    """FO-093: audit trail for AI governance configuration changes."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_admin_audit_entries",
    )
    actor_email = models.EmailField(blank=True, default="")
    changed_field = models.CharField(max_length=100, db_index=True)
    old_value = models.TextField(blank=True, default="")
    new_value = models.TextField(blank=True, default="")
    scope = models.CharField(max_length=20, default="global", db_index=True)
    note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["-created_at", "changed_field"],
                name="fm_ai_admin_audit_created",
            ),
        ]

    def __str__(self):
        return f"{self.changed_field} @ {self.created_at}"
