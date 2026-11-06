"""Unit tests for the task model."""

from __future__ import annotations

import pytest

from boss_agent.models import Task, ValidationError


@pytest.mark.parametrize("title", ["", "   ", "\n\t "])
def test_title_must_not_be_blank(title: str) -> None:
    with pytest.raises(ValidationError):
        Task(title=title)


def test_new_task_gets_short_id_and_utc_timestamp() -> None:
    task = Task(title="Write report")

    assert len(task.id) == 8
    assert task.created_at.tzinfo is not None
    assert task.created_at.utcoffset().total_seconds() == 0


def test_task_round_trips_through_its_stored_form() -> None:
    task = Task(title="Write report")

    assert Task.from_dict(task.to_dict()) == task


@pytest.mark.parametrize(
    "raw",
    [
        {},
        {"title": "Write report"},
        {"id": "abcd1234", "created_at": "2026-11-06T01:00:00+00:00"},
    ],
)
def test_stored_task_missing_a_field_is_rejected(raw: dict) -> None:
    with pytest.raises(ValidationError):
        Task.from_dict(raw)


def test_stored_task_with_unreadable_timestamp_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Task.from_dict({"id": "abcd1234", "title": "Write report", "created_at": "yesterday"})
