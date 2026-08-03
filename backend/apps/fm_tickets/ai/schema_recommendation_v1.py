"""FacilityRecommendationV1 — FO-086 advisory FM recommendations (keeps FO-085 observations)."""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from .schema_v1 import (
    CrossImageFinding,
    ImageResult,
    OverallImageQuality,
    SummaryStr,
)

SCHEMA_VERSION = "1.0"
SCHEMA_NAME = "FacilityRecommendationV1"

BoundedStr = Annotated[str, StringConstraints(min_length=1, max_length=500)]
ReasoningStr = Annotated[str, StringConstraints(min_length=1, max_length=2000)]
PercentConfidence = Annotated[int, Field(ge=0, le=100)]


class FindingTitle(str, Enum):
    WATER_LEAK = "Water leak"
    BROKEN_FURNITURE = "Broken furniture"
    DAMAGED_TABLE = "Damaged table"
    BROKEN_CHAIR = "Broken chair"
    CRACKED_WALL = "Cracked wall"
    CEILING_DAMAGE = "Ceiling damage"
    ELECTRICAL_ISSUE = "Electrical issue"
    LOOSE_WIRING = "Loose wiring"
    DAMAGED_DOOR = "Damaged door"
    DAMAGED_WINDOW = "Damaged window"
    MISSING_SIGNAGE = "Missing signage"
    DIRTY_AREA = "Dirty area"
    CLOGGED_DRAIN = "Clogged drain"
    HVAC_ISSUE = "HVAC issue"
    FIRE_SAFETY_CONCERN = "Fire safety concern"
    HOUSEKEEPING_ISSUE = "Housekeeping issue"
    PEST_EVIDENCE = "Pest evidence"
    GENERAL_FACILITY_DAMAGE = "General facility damage"
    UNKNOWN = "Unknown"


class RecommendedCategory(str, Enum):
    PLUMBING = "Plumbing"
    ELECTRICAL = "Electrical"
    CARPENTRY = "Carpentry"
    CIVIL = "Civil"
    HVAC = "HVAC"
    HOUSEKEEPING = "Housekeeping"
    SAFETY = "Safety"
    PEST_CONTROL = "Pest Control"
    PAINTING = "Painting"
    GENERAL_MAINTENANCE = "General Maintenance"
    UNKNOWN = "Unknown"


class RecommendedPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class RecommendationSeverity(str, Enum):
    MINOR = "Minor"
    MODERATE = "Moderate"
    MAJOR = "Major"
    CRITICAL = "Critical"


class RecommendationFinding(BaseModel):
    title: FindingTitle
    description: BoundedStr
    confidence: PercentConfidence


class FacilityRecommendationV1(BaseModel):
    """Observations plus advisory FM recommendations — never workflow mutations."""

    schema_version: Annotated[str, StringConstraints(pattern=r"^1\.0$")]
    schema_name: Literal["FacilityRecommendationV1"] = SCHEMA_NAME
    analysis_summary: SummaryStr
    image_results: list[ImageResult] = Field(min_length=1, max_length=20)
    cross_image_findings: list[CrossImageFinding] = Field(
        default_factory=list,
        max_length=20,
    )
    overall_image_quality: OverallImageQuality
    findings: list[RecommendationFinding] = Field(min_length=1, max_length=20)
    recommended_category: RecommendedCategory
    recommended_priority: RecommendedPriority
    severity: RecommendationSeverity
    overall_confidence: PercentConfidence
    reasoning: ReasoningStr
    requires_human_review: bool
    limitations: list[
        Annotated[str, StringConstraints(min_length=1, max_length=400)]
    ] = Field(default_factory=list, max_length=20)

    @field_validator("requires_human_review")
    @classmethod
    def force_human_review(cls, value: bool) -> bool:
        return True


def validate_facility_recommendation(payload: dict) -> FacilityRecommendationV1:
    return FacilityRecommendationV1.model_validate(payload)


def facility_recommendation_json_schema() -> dict:
    """JSON schema for Gemini response_json_schema."""
    return FacilityRecommendationV1.model_json_schema()
