"""Date parsing and formatting for boss-agent.

One module owns the accepted date format, so the CLI and the store cannot disagree
about what a valid due date is (REQ-001, design note).
"""

from __future__ import annotations

from datetime import date, datetime

from .models import ValidationError

ISO_DATE_FORMAT = "%Y-%m-%d"


def parse_due(value: str) -> date:
    """Turn ``YYYY-MM-DD`` into a date, or explain why it cannot be one."""
    try:
        return datetime.strptime(value, ISO_DATE_FORMAT).date()
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"invalid date {value!r}: expected YYYY-MM-DD") from exc


def format_due(value: date) -> str:
    """Render a date the way the CLI shows it."""
    return value.isoformat()
