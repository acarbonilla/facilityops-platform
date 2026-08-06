from decimal import Decimal

from apps.core.models import BaseModel
from apps.master_data.models import Building, Organization, Tenant
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Project(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In Progress"
        ON_HOLD = "on_hold", "On Hold"
        DELAYED = "delayed", "Delayed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="projects",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="projects",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    project_code = models.CharField(max_length=32, blank=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_projects",
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
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    actual_start_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)
    completion_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("tenant", "project_code"),
                name="unique_project_code_per_tenant",
            ),
        ]

    def __str__(self):
        return self.project_code or self.name

    def clean(self):
        super().clean()
        errors = {}

        if self.organization_id and self.organization.tenant_id != self.tenant_id:
            errors["organization"] = "Organization must belong to the selected tenant."

        if self.building_id:
            if self.building.tenant_id != self.tenant_id:
                errors["building"] = "Building must belong to the selected tenant."
            elif (
                self.organization_id
                and self.building.organization_id != self.organization_id
            ):
                errors["building"] = (
                    "Building must belong to the selected organization."
                )

        if self.project_manager_id:
            if self.project_manager.tenant_id != self.tenant_id:
                errors["project_manager"] = (
                    "Project manager must belong to the selected tenant."
                )
            elif not self.project_manager.is_active:
                errors["project_manager"] = "Project manager must be an active user."

        if (
            self.planned_start_date
            and self.planned_end_date
            and self.planned_end_date < self.planned_start_date
        ):
            errors["planned_end_date"] = (
                "Planned end date must be on or after the planned start date."
            )

        if (
            self.actual_start_date
            and self.actual_end_date
            and self.actual_end_date < self.actual_start_date
        ):
            errors["actual_end_date"] = (
                "Actual end date must be on or after the actual start date."
            )

        if errors:
            raise ValidationError(errors)

    def _generate_project_code(self):
        year = timezone.localdate().strftime("%Y")
        prefix = f"PRJ-{year}-"
        latest_code = (
            self.__class__.objects.filter(
                tenant_id=self.tenant_id,
                project_code__startswith=prefix,
            )
            .order_by("-project_code")
            .values_list("project_code", flat=True)
            .first()
        )
        if latest_code:
            last_sequence = int(latest_code.rsplit("-", 1)[-1])
        else:
            last_sequence = 0
        return f"{prefix}{last_sequence + 1:04d}"

    def save(self, *args, **kwargs):
        if not self.project_code:
            self.project_code = self._generate_project_code()
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectMember(BaseModel):
    class Role(models.TextChoices):
        PROJECT_MANAGER = "project_manager", "Project Manager"
        MEMBER = "member", "Member"
        VIEWER = "viewer", "Viewer"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_members",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_memberships_added",
    )

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("project", "user"),
                condition=Q(is_deleted=False),
                name="unique_project_member_when_not_deleted",
            ),
        ]

    def __str__(self):
        return f"{self.user} on {self.project} ({self.role})"

    def clean(self):
        super().clean()
        errors = {}

        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Member tenant must match the project tenant."

        if self.user_id and self.tenant_id and self.user.tenant_id != self.tenant_id:
            errors["user"] = "User must belong to the project tenant."

        if self.user_id and not self.user.is_active:
            errors["user"] = "Inactive users cannot be assigned as project members."

        if (
            self.project_id
            and self.user_id
            and not self.is_deleted
            and ProjectMember.objects.filter(
                project_id=self.project_id,
                user_id=self.user_id,
                is_deleted=False,
            )
            .exclude(pk=self.pk)
            .exists()
        ):
            errors["user"] = "User is already a member of this project."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectHistory(BaseModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_history_entries",
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.project} {self.action}"
