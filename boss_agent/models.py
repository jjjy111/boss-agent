"""Domain model for boss-agent tasks."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Dict, Mapping, Optional


class ValidationError(ValueError):
    """Raised when user input does not satisfy the domain rules."""


@dataclass(frozen=True)
class Task:
    """A single task.

    Frozen on purpose: a task is only ever changed by writing it back through
    :class:`boss_agent.store.TaskStore`, so the data file cannot drift away from
    the objects a caller is holding.
    """

    title: str
    due: Optional[date] = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not isinstance(self.title, str) or not self.title.strip():
            raise ValidationError("a task needs a non-empty title")
        if self.due is not None and not isinstance(self.due, date):
            raise ValidationError("due must be a date or None")

    def is_overdue(self, today: Optional[date] = None) -> bool:
        """Return True when the due date is strictly before ``today``.

        A task due *today* is still on time, and a task without a due date is never
        overdue. ``today`` is injectable so that tests do not depend on the clock.
        """
        if self.due is None:
            return False
        return self.due < (today or date.today())

    def to_dict(self) -> Dict[str, Any]:
        """Return the JSON-serialisable representation stored on disk."""
        return {
            "id": self.id,
            "title": self.title,
            "due": self.due.isoformat() if self.due is not None else None,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> "Task":
        """Rebuild a task from its stored representation."""
        if not isinstance(raw, Mapping):
            raise ValidationError("a stored task must be an object")
        try:
            title = raw["title"]
            task_id = raw["id"]
            created_at = datetime.fromisoformat(raw["created_at"])
            # A record written before due dates existed has no "due" key at all;
            # that means "no due date", not "corrupt record".
            due_raw = raw.get("due")
            due = date.fromisoformat(due_raw) if due_raw is not None else None
        except KeyError as exc:
            raise ValidationError(f"a stored task is missing {exc.args[0]!r}") from exc
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"a stored task has an unreadable field: {exc}") from exc

        if not isinstance(task_id, str) or not task_id:
            raise ValidationError("a stored task has no id")
        return cls(title=title, due=due, id=task_id, created_at=created_at)
