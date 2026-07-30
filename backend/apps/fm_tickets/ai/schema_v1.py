"""FacilityImageAnalysisV1 — versioned structured image observation schema (FO-085)."""

from __future__ import annotations

from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, field_validator


SCHEMA_VERSION = "1.0"
SCHEMA_NAME = "FacilityImageAnalysisV1"

BoundedStr = Annotated[str, StringConstraints(min_length=1, max_length=500)]
SummaryStr = Annotated[str, StringConstraints(min_length=1, max_length=2000)]
Confidence = Annotated[float, Field(ge=0.0, le=1.0)]


class ImageQualityIssue(str, Enum):
    BLUR = "blur"
    LOW_LIGHT = "low_light"
    OBSTRUCTION = "obstruction"
    TOO_DISTANT = "too_distant"
    DUPLICATE_VIEW = "duplicate_view"


class HazardSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OverallImageQuality(str, Enum):
    POOR = "poor"
    LIMITED = "limited"
    ADEQUATE = "adequate"
    GOOD = "good"


class ImageQuality(BaseModel):
    usable: bool
    issues: list[ImageQualityIssue] = Field(default_factory=list, max_length=10)


class Observation(BaseModel):
    observation: BoundedStr
    evidence: BoundedStr
    region: Annotated[str, StringConstraints(max_length=100)] = ""
    confidence: Confidence


class VisibleAsset(BaseModel):
    asset_type: BoundedStr
    condition: BoundedStr
    confidence: Confidence


class VisibleHazard(BaseModel):
    hazard: BoundedStr
    severity: HazardSeverity
    evidence: BoundedStr
    confidence: Confidence


class ImageResult(BaseModel):
    attachment_id: str
    image_index: Annotated[int, Field(ge=1, le=20)]
    image_quality: ImageQuality
    observations: list[Observation] = Field(default_factory=list, max_length=25)
    visible_assets: list[VisibleAsset] = Field(default_factory=list, max_length=15)
    visible_hazards: list[VisibleHazard] = Field(default_factory=list, max_length=15)
    cannot_determine: list[
        Annotated[str, StringConstraints(min_length=1, max_length=300)]
    ] = Field(default_factory=list, max_length=20)

    @field_validator("attachment_id")
    @classmethod
    def validate_attachment_id(cls, value: str) -> str:
        try:
            UUID(str(value))
        except (TypeError, ValueError) as exc:
            raise ValueError("attachment_id must be a UUID string") from exc
        return str(value)


class CrossImageFinding(BaseModel):
    finding: BoundedStr
    supporting_image_indexes: list[Annotated[int, Field(ge=1, le=20)]] = Field(
        min_length=1,
        max_length=20,
    )
    confidence: Confidence


class FacilityImageAnalysisV1(BaseModel):
    """Objective image observations only — no workflow decisions."""

    schema_version: Annotated[str, StringConstraints(pattern=r"^1\.0$")]
    analysis_summary: SummaryStr
    image_results: list[ImageResult] = Field(min_length=1, max_length=20)
    cross_image_findings: list[CrossImageFinding] = Field(
        default_factory=list,
        max_length=20,
    )
    overall_image_quality: OverallImageQuality
    requires_human_review: bool
    limitations: list[
        Annotated[str, StringConstraints(min_length=1, max_length=400)]
    ] = Field(default_factory=list, max_length=20)

    @field_validator("requires_human_review")
    @classmethod
    def force_human_review(cls, value: bool) -> bool:
        # FO-085 always requires human review regardless of model output.
        return True


def validate_facility_image_analysis(payload: dict) -> FacilityImageAnalysisV1:
    return FacilityImageAnalysisV1.model_validate(payload)


def facility_image_analysis_json_schema() -> dict:
    """JSON schema for Gemini response_json_schema (no Python defaults relied upon)."""
    return FacilityImageAnalysisV1.model_json_schema()
