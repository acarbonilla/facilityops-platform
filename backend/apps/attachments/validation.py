"""Centralized server-side attachment upload validation."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from django.conf import settings

from .exceptions import AttachmentValidationError
from .models import Attachment

# Conservative operational-evidence allowlist (FO-079).
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "application/pdf": {".pdf"},
}

CONTENT_TYPE_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}

# Active / executable / archive content rejected by allowlist policy.
REJECTED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".msi",
    ".scr",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".sh",
    ".ps1",
    ".php",
    ".html",
    ".htm",
    ".svg",
    ".xml",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".tgz",
    ".docm",
    ".xlsm",
    ".pptm",
}

MAX_FILENAME_LENGTH = 255


@dataclass(frozen=True)
class ValidatedUpload:
    original_filename: str
    display_filename: str
    extension: str
    declared_content_type: str
    validated_content_type: str
    category: str
    size_bytes: int
    content: bytes


def get_max_upload_bytes() -> int:
    configured = getattr(settings, "ATTACHMENT_MAX_UPLOAD_BYTES", 10 * 1024 * 1024)
    try:
        value = int(configured)
    except (TypeError, ValueError):
        return 10 * 1024 * 1024
    if value < 1:
        return 10 * 1024 * 1024
    return value


def _normalize_filename(filename: str) -> str:
    if not filename or not str(filename).strip():
        raise AttachmentValidationError("Filename is required.")

    basename = os.path.basename(str(filename).replace("\\", "/")).strip()
    basename = basename.lstrip(".")
    # Neutralize path/control characters while preserving a readable label.
    basename = re.sub(r"[\x00-\x1f\x7f]", "", basename)
    basename = re.sub(r"[<>:\"|?*]", "_", basename)
    basename = re.sub(r"\s+", " ", basename).strip()

    if not basename:
        raise AttachmentValidationError("Filename is invalid.")
    if len(basename) > MAX_FILENAME_LENGTH:
        raise AttachmentValidationError("Filename is too long.")
    return basename


def _detect_content_type(content: bytes) -> str | None:
    if len(content) >= 3 and content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(content) >= 8 and content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if (
        len(content) >= 12
        and content[:4] == b"RIFF"
        and content[8:12] == b"WEBP"
    ):
        return "image/webp"
    if len(content) >= 5 and content[:5] == b"%PDF-":
        return "application/pdf"
    return None


def _resolve_category(content_type: str, requested_category: str | None) -> str:
    if content_type.startswith("image/"):
        default = Attachment.Category.IMAGE_EVIDENCE
    elif content_type == "application/pdf":
        default = Attachment.Category.DOCUMENT
    else:
        default = Attachment.Category.OTHER

    if not requested_category:
        return default

    allowed = {choice.value for choice in Attachment.Category}
    if requested_category not in allowed:
        raise AttachmentValidationError("Attachment category is not supported.")
    return requested_category


def validate_upload(
    *,
    uploaded_file,
    declared_content_type: str = "",
    category: str | None = None,
) -> ValidatedUpload:
    if uploaded_file is None:
        raise AttachmentValidationError("File is required.")

    original_name = getattr(uploaded_file, "name", "") or ""
    display_filename = _normalize_filename(original_name)
    _, ext = os.path.splitext(display_filename)
    extension = ext.lower()

    if not extension:
        raise AttachmentValidationError("File extension is required.")
    if extension in REJECTED_EXTENSIONS:
        raise AttachmentValidationError("File type is not allowed.")
    if extension not in CONTENT_TYPE_BY_EXTENSION:
        raise AttachmentValidationError("File type is not allowed.")

    content = uploaded_file.read()
    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)

    size_bytes = len(content)
    if size_bytes == 0:
        raise AttachmentValidationError("Empty files are not allowed.")
    if size_bytes > get_max_upload_bytes():
        raise AttachmentValidationError("File exceeds the maximum upload size.")

    declared = (declared_content_type or getattr(uploaded_file, "content_type", "") or "").lower().strip()
    expected_from_ext = CONTENT_TYPE_BY_EXTENSION[extension]
    detected = _detect_content_type(content)

    if detected is None:
        raise AttachmentValidationError("File content could not be validated.")
    if detected != expected_from_ext:
        raise AttachmentValidationError("File extension does not match file content.")
    if declared and declared not in ALLOWED_CONTENT_TYPES:
        raise AttachmentValidationError("Declared content type is not allowed.")
    if declared and declared != detected:
        raise AttachmentValidationError("Declared content type does not match file content.")
    if detected not in ALLOWED_CONTENT_TYPES:
        raise AttachmentValidationError("File type is not allowed.")
    if extension not in ALLOWED_CONTENT_TYPES[detected]:
        raise AttachmentValidationError("File extension is not allowed for this content type.")

    resolved_category = _resolve_category(detected, category)

    return ValidatedUpload(
        original_filename=display_filename,
        display_filename=display_filename,
        extension=extension.lstrip("."),
        declared_content_type=declared,
        validated_content_type=detected,
        category=resolved_category,
        size_bytes=size_bytes,
        content=content,
    )
