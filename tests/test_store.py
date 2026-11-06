"""Tests for the JSON-file store."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from boss_agent.models import ValidationError
from boss_agent.store import StoreError, TaskStore


def test_missing_file_reads_as_empty(tmp_path: Path) -> None:
    assert TaskStore(tmp_path / "tasks.json").all() == []


def test_added_task_is_persisted(tmp_path: Path) -> None:
    store = TaskStore(tmp_path / "tasks.json")
    task = store.add("Write report")

    reopened = TaskStore(tmp_path / "tasks.json")
    assert [stored.id for stored in reopened.all()] == [task.id]
    assert reopened.all()[0].title == "Write report"


def test_tasks_keep_creation_order(tmp_path: Path) -> None:
    store = TaskStore(tmp_path / "tasks.json")
    store.add("first")
    store.add("second")
    store.add("third")

    assert [task.title for task in store.all()] == ["first", "second", "third"]


def test_blank_title_is_rejected_before_anything_is_written(tmp_path: Path) -> None:
    path = tmp_path / "tasks.json"

    with pytest.raises(ValidationError):
        TaskStore(path).add("   ")

    assert not path.exists()


def test_missing_parent_directory_is_created(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "dir" / "tasks.json"
    TaskStore(path).add("Write report")

    assert path.exists()


def test_corrupt_json_raises_store_error(tmp_path: Path) -> None:
    path = tmp_path / "tasks.json"
    path.write_text("{ this is not json", encoding="utf-8")

    with pytest.raises(StoreError):
        TaskStore(path).all()


def test_json_that_is_not_a_list_raises_store_error(tmp_path: Path) -> None:
    path = tmp_path / "tasks.json"
    path.write_text('{"tasks": []}', encoding="utf-8")

    with pytest.raises(StoreError):
        TaskStore(path).all()


def test_record_written_before_due_dates_existed_still_loads(tmp_path: Path) -> None:
    """A pre-change task file has no "due" key at all (REQ-001 compatibility)."""
    path = tmp_path / "tasks.json"
    path.write_text(
        json.dumps(
            [
                {
                    "id": "aaaaaaaa",
                    "title": "old task",
                    "created_at": "2026-11-01T09:00:00+00:00",
                }
            ]
        ),
        encoding="utf-8",
    )

    tasks = TaskStore(path).all()

    assert [task.title for task in tasks] == ["old task"]
    assert tasks[0].due is None


def test_failed_write_leaves_the_previous_file_intact(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A write that fails half way must not destroy the tasks already stored (R1)."""
    store = TaskStore(tmp_path / "tasks.json")
    store.add("first")
    before = store.path.read_text(encoding="utf-8")

    def explode(*args: object, **kwargs: object) -> None:
        raise OSError("no space left on device")

    monkeypatch.setattr(os, "replace", explode)

    with pytest.raises(StoreError):
        store.add("second")

    assert store.path.read_text(encoding="utf-8") == before
    assert [path.name for path in tmp_path.iterdir()] == ["tasks.json"]
