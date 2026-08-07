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

        # FO-107: completing a project requires 100% accomplishment.
        # Do not auto-complete when percentage hits 100 — human authority.
        if self.status == self.Status.COMPLETED:
            pct = (
                Decimal("0.00")
                if self.completion_percentage is None
                else Decimal(str(self.completion_percentage))
            )
            if pct < Decimal("100.00"):
                errors["status"] = (
                    "Project cannot be marked completed until "
                    "accomplishment reaches 100%."
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


class ProjectTask(BaseModel):
    """FO-104 project task. Task codes never reuse soft-deleted sequences."""

    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        IN_PROGRESS = "in_progress", "In Progress"
        BLOCKED = "blocked", "Blocked"
        ON_HOLD = "on_hold", "On Hold"
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
        related_name="project_tasks",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    task_code = models.CharField(max_length=48, blank=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    person_in_charge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_tasks_as_pic",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)
    progress_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    sequence = models.PositiveIntegerField(default=0)
    is_milestone = models.BooleanField(default=False)

    class Meta:
        ordering = ["sequence", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("project", "task_code"),
                name="unique_task_code_per_project",
            ),
        ]

    def __str__(self):
        return self.task_code or self.name

    def apply_progress_status_sync(self):
        """Enforce FO-104 progress/status sync rules."""
        progress = self.progress_percentage
        if progress is None:
            progress = Decimal("0.00")
        else:
            progress = Decimal(str(progress))

        if progress < Decimal("0.00") or progress > Decimal("100.00"):
            raise ValidationError(
                {
                    "progress_percentage": (
                        "Progress must be a decimal between 0 and 100."
                    )
                }
            )

        if self.status == self.Status.COMPLETED:
            self.progress_percentage = Decimal("100.00")
        elif self.status == self.Status.NOT_STARTED:
            self.progress_percentage = Decimal("0.00")
        elif self.status == self.Status.CANCELLED:
            # Preserve last progress; do not force 0 or 100.
            self.progress_percentage = progress
        elif self.status == self.Status.IN_PROGRESS:
            if progress == Decimal("100.00"):
                # Prefer coerce status to completed when progress hits 100.
                self.status = self.Status.COMPLETED
                self.progress_percentage = Decimal("100.00")
            elif progress == Decimal("0.00"):
                self.progress_percentage = Decimal("1.00")
            else:
                self.progress_percentage = progress
        else:
            # blocked / on_hold: preserve progress (0-100 OK)
            self.progress_percentage = progress

    def clean(self):
        super().clean()
        errors = {}

        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Task tenant must match the project tenant."

        # Milestone: if only start provided, allow end=start (zero duration).
        if (
            self.is_milestone
            and self.planned_start
            and not self.planned_end
        ):
            self.planned_end = self.planned_start
        if (
            self.is_milestone
            and self.actual_start
            and not self.actual_end
        ):
            self.actual_end = self.actual_start

        if (
            self.planned_start
            and self.planned_end
            and self.planned_end < self.planned_start
        ):
            errors["planned_end"] = (
                "Planned end must be on or after the planned start."
            )

        if (
            self.actual_start
            and self.actual_end
            and self.actual_end < self.actual_start
        ):
            errors["actual_end"] = (
                "Actual end must be on or after the actual start."
            )

        # Reject task planned dates outside project window when BOTH project
        # planned dates are set; incomplete project schedule allows any range.
        if self.project_id:
            project = self.project
            if project.planned_start_date and project.planned_end_date:
                if self.planned_start and (
                    self.planned_start < project.planned_start_date
                    or self.planned_start > project.planned_end_date
                ):
                    errors["planned_start"] = (
                        "Task planned start must fall within the project "
                        "planned schedule."
                    )
                if self.planned_end and (
                    self.planned_end < project.planned_start_date
                    or self.planned_end > project.planned_end_date
                ):
                    errors["planned_end"] = (
                        "Task planned end must fall within the project "
                        "planned schedule."
                    )

        try:
            self.apply_progress_status_sync()
        except ValidationError as exc:
            if hasattr(exc, "message_dict"):
                errors.update(exc.message_dict)
            else:
                errors["progress_percentage"] = list(exc.messages)

        # PIC optional at create; required before in_progress / completed.
        if self.status in (self.Status.IN_PROGRESS, self.Status.COMPLETED):
            if not self.person_in_charge_id:
                errors["person_in_charge"] = (
                    "Person in charge is required before moving a task to "
                    f"{self.status}."
                )
            else:
                pic_error = self._validate_person_in_charge()
                if pic_error:
                    errors["person_in_charge"] = pic_error
        elif self.person_in_charge_id:
            pic_error = self._validate_person_in_charge()
            if pic_error:
                errors["person_in_charge"] = pic_error

        if errors:
            raise ValidationError(errors)

    def _validate_person_in_charge(self):
        """PIC must be active ProjectMember or project_manager, same tenant."""
        user = self.person_in_charge
        if user.tenant_id != self.tenant_id:
            return "Person in charge must belong to the project tenant."
        if not user.is_active:
            return "Person in charge must be an active user."

        if self.project.project_manager_id == user.id:
            return None

        is_active_member = ProjectMember.objects.filter(
            project_id=self.project_id,
            user_id=user.id,
            is_active=True,
            is_deleted=False,
        ).exists()
        if not is_active_member:
            return (
                "Person in charge must be an active project member or the "
                "project manager."
            )
        return None

    def _generate_task_code(self):
        # Include soft-deleted in sequence scan so codes are never reused.
        project = Project.objects.select_for_update().get(pk=self.project_id)
        prefix = f"{project.project_code}-T"
        latest_code = (
            ProjectTask.objects.filter(
                project_id=self.project_id,
                task_code__startswith=prefix,
            )
            .order_by("-task_code")
            .values_list("task_code", flat=True)
            .first()
        )
        if latest_code and latest_code.rsplit("-T", 1)[-1].isdigit():
            last_sequence = int(latest_code.rsplit("-T", 1)[-1])
        else:
            last_sequence = 0
        return f"{prefix}{last_sequence + 1:03d}"

    def save(self, *args, **kwargs):
        if not self.task_code:
            self.task_code = self._generate_task_code()
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectTaskChecklistItem(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_task_checklist_items",
    )
    task = models.ForeignKey(
        ProjectTask,
        on_delete=models.CASCADE,
        related_name="checklist_items",
    )
    text = models.CharField(max_length=500)
    is_completed = models.BooleanField(default=False)
    sequence = models.PositiveIntegerField(default=0)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_project_task_checklist_items",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["sequence", "created_at"]

    def __str__(self):
        return self.text[:50]

    def clean(self):
        super().clean()
        errors = {}
        if self.task_id and self.tenant_id and self.task.tenant_id != self.tenant_id:
            errors["tenant"] = "Checklist item tenant must match the task tenant."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectTaskComment(BaseModel):
    # is_internal default True — project comments are internal-only (FO-104).
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_task_comments",
    )
    task = models.ForeignKey(
        ProjectTask,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_task_comments",
    )
    body = models.TextField()
    is_internal = models.BooleanField(default=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on {self.task_id}"

    def clean(self):
        super().clean()
        errors = {}
        if self.task_id and self.tenant_id and self.task.tenant_id != self.tenant_id:
            errors["tenant"] = "Comment tenant must match the task tenant."
        if not (self.body or "").strip():
            errors["body"] = "Comment body is required."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectTaskDependency(BaseModel):
    """FO-105 finish-to-start task dependency.

    Cycle detection walks the predecessor→successor adjacency in O(V+E),
    excluding soft-deleted dependencies and soft-deleted tasks.
    """

    class DependencyType(models.TextChoices):
        FINISH_TO_START = "finish_to_start", "Finish to Start"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_task_dependencies",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="task_dependencies",
    )
    predecessor_task = models.ForeignKey(
        ProjectTask,
        on_delete=models.CASCADE,
        related_name="successor_dependencies",
    )
    successor_task = models.ForeignKey(
        ProjectTask,
        on_delete=models.CASCADE,
        related_name="predecessor_dependencies",
    )
    dependency_type = models.CharField(
        max_length=32,
        choices=DependencyType.choices,
        default=DependencyType.FINISH_TO_START,
    )

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("predecessor_task", "successor_task"),
                condition=Q(is_deleted=False),
                name="unique_active_project_task_dependency",
            ),
        ]
        indexes = [
            models.Index(fields=["predecessor_task"], name="proj_dep_pred_idx"),
            models.Index(fields=["successor_task"], name="proj_dep_succ_idx"),
            models.Index(fields=["project"], name="proj_dep_project_idx"),
        ]

    def __str__(self):
        return (
            f"{self.predecessor_task_id} -> {self.successor_task_id} "
            f"({self.dependency_type})"
        )

    def clean(self):
        super().clean()
        errors = {}

        if self.dependency_type != self.DependencyType.FINISH_TO_START:
            errors["dependency_type"] = (
                "Only finish_to_start dependencies are supported."
            )

        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Dependency tenant must match the project tenant."

        if self.project_id and getattr(self.project, "is_deleted", False):
            errors["project"] = "Cannot create dependencies on a deleted project."

        pred = self.predecessor_task if self.predecessor_task_id else None
        succ = self.successor_task if self.successor_task_id else None

        if pred and succ and pred.id == succ.id:
            errors["successor_task"] = "A task cannot depend on itself."

        if pred:
            if pred.is_deleted:
                errors["predecessor_task"] = "Predecessor task is deleted."
            elif self.project_id and pred.project_id != self.project_id:
                errors["predecessor_task"] = (
                    "Predecessor must belong to the same project."
                )
            elif self.tenant_id and pred.tenant_id != self.tenant_id:
                errors["predecessor_task"] = (
                    "Predecessor must belong to the same tenant."
                )

        if succ:
            if succ.is_deleted:
                errors["successor_task"] = "Successor task is deleted."
            elif self.project_id and succ.project_id != self.project_id:
                errors["successor_task"] = (
                    "Successor must belong to the same project."
                )
            elif self.tenant_id and succ.tenant_id != self.tenant_id:
                errors["successor_task"] = (
                    "Successor must belong to the same tenant."
                )

        if (
            not errors
            and not self.is_deleted
            and self.project_id
            and self.predecessor_task_id
            and self.successor_task_id
        ):
            # Local import avoids circular import with dependency_service.
            from .dependency_service import would_create_cycle

            if would_create_cycle(
                self.project_id,
                self.predecessor_task_id,
                self.successor_task_id,
                exclude_dependency_id=self.pk,
            ):
                errors["successor_task"] = (
                    "Adding this dependency would create a cycle."
                )

        if (
            not self.is_deleted
            and self.predecessor_task_id
            and self.successor_task_id
            and ProjectTaskDependency.objects.filter(
                predecessor_task_id=self.predecessor_task_id,
                successor_task_id=self.successor_task_id,
                is_deleted=False,
            )
            .exclude(pk=self.pk)
            .exists()
        ):
            errors["successor_task"] = (
                "This dependency already exists between these tasks."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectNote(BaseModel):
    """FO-106 project note (collaboration)."""

    class Category(models.TextChoices):
        GENERAL = "general", "General"
        MEETING = "meeting", "Meeting"
        DECISION = "decision", "Decision"
        SAFETY = "safety", "Safety"
        MATERIAL = "material", "Material"
        CONTRACTOR = "contractor", "Contractor"
        CLIENT = "client", "Client"
        OTHER = "other", "Other"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_notes",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    title = models.CharField(max_length=200)
    note = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_notes",
    )
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.GENERAL,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        errors = {}
        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Note tenant must match the project tenant."
        if not (self.note or "").strip():
            errors["note"] = "Note body is required."
        if not (self.title or "").strip():
            errors["title"] = "Title is required."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectIssue(BaseModel):
    """FO-106 project issue tracker. No auto-create of FM tickets/notifications."""

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        INVESTIGATING = "investigating", "Investigating"
        BLOCKED = "blocked", "Blocked"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    RESOLVED_STATUSES = frozenset({Status.RESOLVED, Status.CLOSED})
    REOPEN_STATUSES = frozenset({Status.OPEN, Status.INVESTIGATING, Status.BLOCKED})
    IMMUTABLE_ATTACHMENT_STATUSES = frozenset(
        {Status.RESOLVED, Status.CLOSED, Status.CANCELLED}
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_issues",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="issues",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_project_issues",
    )
    due_date = models.DateField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def apply_resolved_at(self, *, previous_status=None):
        """Set/clear resolved_at based on status transitions."""
        if self.status in self.RESOLVED_STATUSES:
            if previous_status not in self.RESOLVED_STATUSES or self.resolved_at is None:
                self.resolved_at = timezone.now()
        elif self.status in self.REOPEN_STATUSES:
            self.resolved_at = None

    def clean(self):
        super().clean()
        errors = {}

        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Issue tenant must match the project tenant."

        if not (self.title or "").strip():
            errors["title"] = "Title is required."

        if self.owner_id:
            owner_error = self._validate_owner()
            if owner_error:
                errors["owner"] = owner_error

        if errors:
            raise ValidationError(errors)

    def _validate_owner(self):
        """Owner must be same tenant; prefer active project member when set."""
        user = self.owner
        if user.tenant_id != self.tenant_id:
            return "Issue owner must belong to the project tenant."
        if not user.is_active:
            return "Issue owner must be an active user."

        if self.project.project_manager_id == user.id:
            return None

        is_active_member = ProjectMember.objects.filter(
            project_id=self.project_id,
            user_id=user.id,
            is_active=True,
            is_deleted=False,
        ).exists()
        if not is_active_member:
            return (
                "Issue owner must be an active project member or the "
                "project manager."
            )
        return None

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectProgressSnapshot(BaseModel):
    """FO-107 append-only project accomplishment snapshot."""

    class Source(models.TextChoices):
        TASK_CREATED = "task_created", "Task Created"
        TASK_PROGRESS_CHANGED = "task_progress_changed", "Task Progress Changed"
        TASK_STATUS_CHANGED = "task_status_changed", "Task Status Changed"
        TASK_CANCELLED = "task_cancelled", "Task Cancelled"
        TASK_DELETED = "task_deleted", "Task Deleted"
        TASK_RESTORED = "task_restored", "Task Restored"
        MANUAL_RECALCULATION = "manual_recalculation", "Manual Recalculation"
        MIGRATION_REBUILD = "migration_rebuild", "Migration Rebuild"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_progress_snapshots",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="progress_snapshots",
    )
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    included_task_count = models.IntegerField(default=0)
    completed_task_count = models.IntegerField(default=0)
    blocked_task_count = models.IntegerField(default=0)
    delayed_task_count = models.IntegerField(default=0)
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)
    source = models.CharField(max_length=32, choices=Source.choices, db_index=True)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_progress_snapshots_triggered",
    )
    related_task = models.ForeignKey(
        ProjectTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="progress_snapshots",
    )

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(
                fields=["project", "recorded_at"],
                name="proj_prog_snap_proj_rec_idx",
            ),
        ]

    def __str__(self):
        return f"{self.project_id} @ {self.completion_percentage}% ({self.source})"


class ProjectIssueComment(BaseModel):
    """FO-106 issue comment — mirrors ProjectTaskComment."""

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_issue_comments",
    )
    issue = models.ForeignKey(
        ProjectIssue,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_issue_comments",
    )
    body = models.TextField()
    is_internal = models.BooleanField(default=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on issue {self.issue_id}"

    def clean(self):
        super().clean()
        errors = {}
        if self.issue_id and self.tenant_id and self.issue.tenant_id != self.tenant_id:
            errors["tenant"] = "Comment tenant must match the issue tenant."
        if not (self.body or "").strip():
            errors["body"] = "Comment body is required."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProjectOperationalLink(BaseModel):
    """FO-108 project-owned link to FM ticket / maintenance WO / inspection.

    Exactly one target FK must be set. Never mutates target workflows.
    """

    class LinkType(models.TextChoices):
        FM_TICKET = "fm_ticket", "FM Ticket"
        MAINTENANCE_WORK_ORDER = "maintenance_work_order", "Maintenance Work Order"
        INSPECTION = "inspection", "Inspection"

    class Relationship(models.TextChoices):
        RELATED = "related", "Related"
        SOURCE = "source", "Source"
        EXECUTION = "execution", "Execution"
        CORRECTIVE_ACTION = "corrective_action", "Corrective Action"
        EVIDENCE = "evidence", "Evidence"
        FOLLOW_UP = "follow_up", "Follow Up"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="project_operational_links",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="operational_links",
    )
    project_task = models.ForeignKey(
        ProjectTask,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="operational_links",
    )
    link_type = models.CharField(
        max_length=32,
        choices=LinkType.choices,
        db_index=True,
    )
    fm_ticket = models.ForeignKey(
        "fm_tickets.FmTicket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="project_operational_links",
    )
    maintenance_work_order = models.ForeignKey(
        "maintenance.MaintenanceWorkOrder",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="project_operational_links",
    )
    inspection = models.ForeignKey(
        "inspection.Inspection",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="project_operational_links",
    )
    relationship = models.CharField(
        max_length=32,
        choices=Relationship.choices,
        default=Relationship.RELATED,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        Q(fm_ticket__isnull=False)
                        & Q(maintenance_work_order__isnull=True)
                        & Q(inspection__isnull=True)
                        & Q(link_type="fm_ticket")
                    )
                    | (
                        Q(fm_ticket__isnull=True)
                        & Q(maintenance_work_order__isnull=False)
                        & Q(inspection__isnull=True)
                        & Q(link_type="maintenance_work_order")
                    )
                    | (
                        Q(fm_ticket__isnull=True)
                        & Q(maintenance_work_order__isnull=True)
                        & Q(inspection__isnull=False)
                        & Q(link_type="inspection")
                    )
                ),
                name="proj_op_link_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=("project", "fm_ticket"),
                condition=Q(is_deleted=False, fm_ticket__isnull=False),
                name="unique_active_project_fm_ticket_link",
            ),
            models.UniqueConstraint(
                fields=("project", "maintenance_work_order"),
                condition=Q(is_deleted=False, maintenance_work_order__isnull=False),
                name="unique_active_project_mwo_link",
            ),
            models.UniqueConstraint(
                fields=("project", "inspection"),
                condition=Q(is_deleted=False, inspection__isnull=False),
                name="unique_active_project_inspection_link",
            ),
        ]
        indexes = [
            models.Index(fields=["project", "link_type"], name="proj_op_link_type_idx"),
            models.Index(fields=["project_task"], name="proj_op_link_task_idx"),
        ]

    def __str__(self):
        return f"{self.project_id} -> {self.link_type} ({self.relationship})"

    def target_id(self):
        if self.fm_ticket_id:
            return self.fm_ticket_id
        if self.maintenance_work_order_id:
            return self.maintenance_work_order_id
        if self.inspection_id:
            return self.inspection_id
        return None

    def clean(self):
        super().clean()
        errors = {}

        if self.project_id and self.tenant_id and self.project.tenant_id != self.tenant_id:
            errors["tenant"] = "Link tenant must match the project tenant."

        if getattr(self.project, "is_deleted", False):
            errors["project"] = "Cannot link operational records to a deleted project."

        fk_count = sum(
            [
                1 if self.fm_ticket_id else 0,
                1 if self.maintenance_work_order_id else 0,
                1 if self.inspection_id else 0,
            ]
        )
        if fk_count != 1:
            errors["link_type"] = (
                "Exactly one of fm_ticket, maintenance_work_order, or "
                "inspection must be set."
            )

        expected_type = None
        target = None
        if self.fm_ticket_id:
            expected_type = self.LinkType.FM_TICKET
            target = self.fm_ticket
        elif self.maintenance_work_order_id:
            expected_type = self.LinkType.MAINTENANCE_WORK_ORDER
            target = self.maintenance_work_order
        elif self.inspection_id:
            expected_type = self.LinkType.INSPECTION
            target = self.inspection

        if expected_type and self.link_type and self.link_type != expected_type:
            errors["link_type"] = (
                f"link_type must be '{expected_type}' for the selected target."
            )

        if target is not None:
            if getattr(target, "is_deleted", False):
                errors["link_type"] = "Cannot link to a deleted operational record."
            elif self.tenant_id and target.tenant_id != self.tenant_id:
                errors["tenant"] = "Target must belong to the same tenant as the project."

        if self.project_task_id:
            task = self.project_task
            if task.is_deleted:
                errors["project_task"] = "Cannot associate a deleted project task."
            elif self.project_id and task.project_id != self.project_id:
                errors["project_task"] = "Project task must belong to the same project."
            elif self.tenant_id and task.tenant_id != self.tenant_id:
                errors["project_task"] = "Project task must belong to the same tenant."

        if (
            not self.is_deleted
            and self.project_id
            and expected_type
            and not errors.get("link_type")
        ):
            dup_filter = {
                "project_id": self.project_id,
                "is_deleted": False,
            }
            if expected_type == self.LinkType.FM_TICKET:
                dup_filter["fm_ticket_id"] = self.fm_ticket_id
            elif expected_type == self.LinkType.MAINTENANCE_WORK_ORDER:
                dup_filter["maintenance_work_order_id"] = self.maintenance_work_order_id
            else:
                dup_filter["inspection_id"] = self.inspection_id
            if (
                ProjectOperationalLink.objects.filter(**dup_filter)
                .exclude(pk=self.pk)
                .exists()
            ):
                errors["link_type"] = (
                    "An active link already exists for this project and target."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
