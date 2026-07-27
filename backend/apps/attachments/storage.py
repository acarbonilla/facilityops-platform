"""Provider-neutral attachment storage abstraction."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage

from .exceptions import AttachmentStorageError

logger = logging.getLogger(__name__)


class AttachmentStorageBackend(ABC):
    """Storage operations used by the attachment service layer."""

    @abstractmethod
    def save(self, storage_key: str, content: bytes) -> str:
        raise NotImplementedError

    @abstractmethod
    def open(self, storage_key: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        raise NotImplementedError


class LocalAttachmentStorage(AttachmentStorageBackend):
    """Private local filesystem storage for development and default deployments."""

    def __init__(self, root=None):
        self.root = Path(root or settings.ATTACHMENT_STORAGE_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)
        self._storage = FileSystemStorage(location=str(self.root))

    def save(self, storage_key: str, content: bytes) -> str:
        try:
            name = self._storage.save(storage_key, ContentFile(content))
            return name
        except Exception as exc:
            logger.exception("attachment.storage.save_failed key=%s", storage_key)
            raise AttachmentStorageError("Unable to store attachment.") from exc

    def open(self, storage_key: str) -> bytes:
        try:
            if not self._storage.exists(storage_key):
                raise AttachmentStorageError("Stored attachment is missing.")
            with self._storage.open(storage_key, "rb") as handle:
                return handle.read()
        except AttachmentStorageError:
            raise
        except Exception as exc:
            logger.exception("attachment.storage.open_failed key=%s", storage_key)
            raise AttachmentStorageError("Unable to read attachment.") from exc

    def exists(self, storage_key: str) -> bool:
        try:
            return self._storage.exists(storage_key)
        except Exception:
            return False

    def delete(self, storage_key: str) -> None:
        try:
            if self._storage.exists(storage_key):
                self._storage.delete(storage_key)
        except Exception as exc:
            logger.exception("attachment.storage.delete_failed key=%s", storage_key)
            raise AttachmentStorageError("Unable to delete attachment.") from exc


class S3CompatibleAttachmentStorage(AttachmentStorageBackend):
    """Placeholder for future private object-storage integration.

    FO-079 does not implement S3 I/O. Configuration is accepted so production
    environments can select the backend without code changes later.
    """

    def __init__(self):
        raise AttachmentStorageError(
            "S3 attachment storage is configured but not implemented in FO-079."
        )

    def save(self, storage_key: str, content: bytes) -> str:
        raise AttachmentStorageError("S3 attachment storage is not implemented.")

    def open(self, storage_key: str) -> bytes:
        raise AttachmentStorageError("S3 attachment storage is not implemented.")

    def exists(self, storage_key: str) -> bool:
        return False

    def delete(self, storage_key: str) -> None:
        raise AttachmentStorageError("S3 attachment storage is not implemented.")


def get_attachment_storage() -> AttachmentStorageBackend:
    backend = getattr(settings, "ATTACHMENT_STORAGE_BACKEND", "local").lower()
    if backend == "local":
        return LocalAttachmentStorage()
    if backend in {"s3", "s3_compatible"}:
        return S3CompatibleAttachmentStorage()
    raise AttachmentStorageError("Unsupported attachment storage backend.")
