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
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Category(models.TextChoices):
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
    description = models.TextField()
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

        if self.floor_id:
            if self.floor.tenant_id != self.tenant_id:
                errors["floor"] = "Floor must belong to the selected tenant."
            if self.floor.building_id != self.building_id:
                errors["floor"] = "Floor must belong to the selected building."

        if self.area_id:
            if self.area.tenant_id != self.tenant_id:
                errors["area"] = "Area must belong to the selected tenant."
            if self.area.building_id != self.building_id:
                errors["area"] = "Area must belong to the selected building."
            if self.floor_id and self.area.floor_id != self.floor_id:
                errors["area"] = "Area must belong to the selected floor."

        if self.asset_id:
            if self.asset.tenant_id != self.tenant_id:
                errors["asset"] = "Asset must belong to the selected tenant."
            if self.asset.organization_id != self.organization_id:
                errors["asset"] = "Asset must belong to the selected organization."
            if self.asset.building_id != self.building_id:
                errors["asset"] = "Asset must belong to the selected building."
            if self.floor_id and self.asset.floor_id != self.floor_id:
                errors["asset"] = "Asset must belong to the selected floor."
            if self.area_id and self.asset.area_id != self.area_id:
                errors["asset"] = "Asset must belong to the selected area."

        if self.due_at and self.due_at < reported_at:
            errors["due_at"] = "Due date must be after the reported date."

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

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self._generate_ticket_number()
        self.full_clean()
        return super().save(*args, **kwargs)


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
