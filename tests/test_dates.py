"""Tests for the one module that owns the date format (REQ-001, R4)."""

from __future__ import annotations

from datetime import date

import pytest

from boss_agent.dates import format_due, parse_due
from boss_agent.models import ValidationError


def test_parse_due_accepts_an_iso_date() -> None:
    assert parse_due("2026-11-10") == date(2026, 11, 10)


def test_parse_due_accepts_a_leap_day() -> None:
    assert parse_due("2028-02-29") == date(2028, 2, 29)


@pytest.mark.parametrize(
    "value",
    ["2026-13-01", "2026-02-30", "10/11/2026", "tomorrow", ""],
)
def test_parse_due_rejects_anything_else(value: str) -> None:
    with pytest.raises(ValidationError, match="invalid date"):
        parse_due(value)


def test_format_due_is_iso_8601() -> None:
    assert format_due(date(2026, 1, 5)) == "2026-01-05"
