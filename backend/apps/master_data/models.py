from django.db import models

from apps.core.models import BaseModel


class Tenant(BaseModel):
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Organization(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="organizations",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("tenant", "code"),
                name="unique_organization_code_per_tenant",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Department(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="departments",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="departments",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_department_code_per_organization",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Building(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="buildings",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="buildings",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_building_code_per_organization",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Floor(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="floors",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.CASCADE,
        related_name="floors",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    level_number = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["level_number", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=("building", "code"),
                name="unique_floor_code_per_building",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Area(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="areas",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.CASCADE,
        related_name="areas",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.CASCADE,
        related_name="areas",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("floor", "code"),
                name="unique_area_code_per_floor",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AssetType(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="asset_types",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("tenant", "code"),
                name="unique_asset_type_code_per_tenant",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Asset(BaseModel):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    building = models.ForeignKey(
        Building,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    floor = models.ForeignKey(
        Floor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    asset_type = models.ForeignKey(
        AssetType,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=100)
    serial_number = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=("tenant", "code"),
                name="unique_asset_code_per_tenant",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"
