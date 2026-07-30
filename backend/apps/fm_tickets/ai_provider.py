"""Pluggable AI provider adapters for FM ticket image analysis.

FO-084 ships a placeholder provider so the queue → worker → persistence pipeline
can be verified without binding controllers to a concrete model vendor.
Swap in Gemini (or another provider) later by implementing AIProvider.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AIProviderResult:
    model_name: str
    model_version: str
    result_json: dict


class AIProvider(Protocol):
    def analyze(self, *, ticket, attachments) -> AIProviderResult:
        """Return structured analysis output for the given ticket and attachments."""


class PlaceholderAIProvider:
    """Deterministic placeholder used until a real vision provider is wired."""

    MODEL_NAME = "placeholder"
    MODEL_VERSION = "v0"

    def analyze(self, *, ticket, attachments) -> AIProviderResult:
        attachment_ids = [str(attachment.id) for attachment in attachments]
        return AIProviderResult(
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            result_json={
                "provider": self.MODEL_NAME,
                "version": self.MODEL_VERSION,
                "ticket_id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "attachment_ids": attachment_ids,
                "attachment_count": len(attachment_ids),
                "summary": (
                    "Placeholder AI analysis completed. "
                    "Real recommendations are deferred to later tasks."
                ),
                "recommendations": [],
                "priority_prediction": None,
                "category_prediction": None,
            },
        )


def get_ai_provider() -> AIProvider:
    """Factory hook for swapping providers without changing queue/worker code."""
    return PlaceholderAIProvider()
