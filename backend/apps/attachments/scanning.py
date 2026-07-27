"""Malware-scanning integration point for future providers.

FO-079 ships a fail-closed allowlist and signature checks only. This module is
the intentional extension point for a future scanning vendor. No scanning
dependency is included.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    provider: str
    detail: str = ""


class AttachmentVirusScanner:
    """Interface for malware scanning providers."""

    def scan(self, *, content: bytes, filename: str, content_type: str) -> ScanResult:
        raise NotImplementedError


class NoOpAttachmentVirusScanner(AttachmentVirusScanner):
    """Placeholder scanner used until an approved provider is integrated."""

    def scan(self, *, content: bytes, filename: str, content_type: str) -> ScanResult:
        return ScanResult(
            clean=True,
            provider="noop",
            detail="Malware scanning is not enabled; allowlist validation only.",
        )


def get_virus_scanner() -> AttachmentVirusScanner:
    return NoOpAttachmentVirusScanner()
