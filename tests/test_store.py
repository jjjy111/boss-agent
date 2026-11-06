"""Tests for the JSON-file store."""

from __future__ import annotations

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
