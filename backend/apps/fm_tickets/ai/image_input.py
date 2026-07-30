"""Load and validate authorized image bytes for AI analysis (FO-085)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings

from apps.attachments.ownership import AttachmentOwnerType
from apps.attachments.storage import get_attachment_storage

from .errors import AIAnalysisError, AIErrorCode

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_MIME_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)


@dataclass(frozen=True)
class PreparedImage:
    attachment_id: str
    image_index: int
    mime_type: str
    content: bytes
    size_bytes: int


def build_minimal_ticket_context(*, ticket, prepared_images: list[PreparedImage]) -> dict:
    """Ticket context without PII, storage paths, or auth material."""
    location_parts = [
        getattr(ticket, "building_id", None)
        and getattr(getattr(ticket, "building", None), "name", None),
        getattr(ticket, "floor_id", None)
        and getattr(getattr(ticket, "floor", None), "name", None),
        getattr(ticket, "area_id", None)
        and getattr(getattr(ticket, "area", None), "name", None),
    ]
    location_label = " / ".join(part for part in location_parts if part) or ""

    return {
        "title": (ticket.title or "")[:200],
        "description": (ticket.description or "")[:2000],
        "location_label": location_label[:300],
        "category": (ticket.category or "")[:50],
        "image_count": len(prepared_images),
        "image_sequence": [
            f"{image.image_index}:{image.attachment_id}" for image in prepared_images
        ],
    }


def prepare_analysis_images(
    *,
    ticket,
    attachments,
) -> list[PreparedImage]:
    max_images = max(1, int(getattr(settings, "FACILITYOPS_GEMINI_MAX_IMAGES", 5)))
    max_total = max(
        1024,
        int(getattr(settings, "FACILITYOPS_GEMINI_MAX_TOTAL_BYTES", 15 * 1024 * 1024)),
    )
    max_single = int(getattr(settings, "ATTACHMENT_MAX_UPLOAD_BYTES", 10 * 1024 * 1024))

    if not attachments:
        raise AIAnalysisError(AIErrorCode.NO_VALID_IMAGES)

    candidates = []
    for attachment in attachments:
        if getattr(attachment, "is_deleted", False):
            continue
        if getattr(attachment, "status", None) and attachment.status != "active":
            continue
        if attachment.owner_type != AttachmentOwnerType.FM_TICKET:
            continue
        if str(attachment.owner_id) != str(ticket.id):
            raise AIAnalysisError(AIErrorCode.NO_VALID_IMAGES)
        if attachment.tenant_id != ticket.tenant_id:
            raise AIAnalysisError(AIErrorCode.NO_VALID_IMAGES)
        mime = (attachment.validated_content_type or "").lower()
        if mime not in SUPPORTED_IMAGE_MIME_TYPES:
            continue
        if attachment.size_bytes and attachment.size_bytes > max_single:
            raise AIAnalysisError(AIErrorCode.INPUT_TOO_LARGE)
        candidates.append(attachment)

    if not candidates:
        raise AIAnalysisError(AIErrorCode.NO_VALID_IMAGES)
    if len(candidates) > max_images:
        raise AIAnalysisError(AIErrorCode.IMAGE_LIMIT_EXCEEDED)

    storage = get_attachment_storage()
    prepared: list[PreparedImage] = []
    total_bytes = 0
    for index, attachment in enumerate(candidates, start=1):
        try:
            content = storage.open(attachment.storage_key)
        except Exception as exc:
            logger.warning(
                "ai.image_read_failed analysis_attachment=%s",
                attachment.id,
                exc_info=False,
            )
            raise AIAnalysisError(AIErrorCode.STORAGE_READ_FAILED) from exc

        size = len(content)
        if size <= 0:
            continue
        total_bytes += size
        if total_bytes > max_total:
            raise AIAnalysisError(AIErrorCode.INPUT_TOO_LARGE)

        prepared.append(
            PreparedImage(
                attachment_id=str(attachment.id),
                image_index=index,
                mime_type=(attachment.validated_content_type or "").lower(),
                content=content,
                size_bytes=size,
            )
        )

    if not prepared:
        raise AIAnalysisError(AIErrorCode.NO_VALID_IMAGES)
    return prepared
