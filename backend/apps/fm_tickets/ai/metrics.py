"""Lightweight in-process AI analysis counters (FO-085)."""

from __future__ import annotations

from collections import Counter

_COUNTERS: Counter[str] = Counter()


def incr(metric: str, amount: int = 1) -> None:
    _COUNTERS[metric] += amount


def snapshot() -> dict[str, int]:
    return dict(_COUNTERS)


def reset() -> None:
    _COUNTERS.clear()
