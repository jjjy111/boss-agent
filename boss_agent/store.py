"""Persistence for boss-agent: one JSON file, read and written as a whole."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import List, Optional

from .models import Task, ValidationError


def default_data_file() -> Path:
    """Return the data file used when the user does not pass ``--data-file``."""
    override = os.environ.get("BOSS_AGENT_DATA")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".boss-agent" / "tasks.json"


class StoreError(RuntimeError):
    """Raised when the data file cannot be read or written."""


class TaskStore:
    """A tiny JSON-backed repository of tasks."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = Path(path) if path is not None else default_data_file()

    # -- reading ---------------------------------------------------------

    def all(self) -> List[Task]:
        """Return every stored task in creation order."""
        if not self.path.exists():
            return []
        try:
            text = self.path.read_text(encoding="utf-8")
        except OSError as exc:
            raise StoreError(f"cannot read {self.path}: {exc}") from exc

        try:
            raw = json.loads(text)
        except json.JSONDecodeError as exc:
            raise StoreError(f"{self.path} is not valid JSON: {exc}") from exc

        if not isinstance(raw, list):
            raise StoreError(f"{self.path} must contain a JSON list of tasks")
        return [Task.from_dict(item) for item in raw]

    # -- writing ---------------------------------------------------------

    def save(self, tasks: List[Task]) -> None:
        """Replace the stored task list atomically.

        The payload is written to a temporary file next to the target and then
        renamed over it, so an interrupted write can never leave a truncated task
        file behind: readers either see the old file or the new one.
        """
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps([task.to_dict() for task in tasks], indent=2) + "\n"

        tmp_path: Optional[Path] = None
        try:
            handle_fd, tmp_name = tempfile.mkstemp(
                dir=str(self.path.parent), prefix=f"{self.path.name}.", suffix=".tmp"
            )
            tmp_path = Path(tmp_name)
            with os.fdopen(handle_fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(str(tmp_path), str(self.path))
            tmp_path = None
        except OSError as exc:
            raise StoreError(f"cannot write {self.path}: {exc}") from exc
        finally:
            if tmp_path is not None:
                try:
                    tmp_path.unlink()
                except OSError:
                    pass

    def resolve(self, task_id: str) -> Task:
        """Find one task by exact id or by a unique id prefix."""
        if not task_id.strip():
            raise ValidationError("a task id is required")
        tasks = self.all()
        exact = [task for task in tasks if task.id == task_id]
        if exact:
            return exact[0]
        matches = [task for task in tasks if task.id.startswith(task_id)]
        if not matches:
            raise ValidationError(f"no task with id {task_id!r}")
        if len(matches) > 1:
            raise ValidationError(
                f"id {task_id!r} matches {len(matches)} tasks; use a longer prefix"
            )
        return matches[0]

    def complete(self, task_id: str) -> Task:
        """Mark a task done and persist it. Completing twice changes nothing."""
        target = self.resolve(task_id)
        completed = target.mark_done()
        if completed == target:
            return target
        tasks = [completed if task.id == target.id else task for task in self.all()]
        self.save(tasks)
        return completed

    def add(self, title: str, due: Optional[date] = None) -> Task:
        """Validate, store and return a new task."""
        task = Task(title=title, due=due)
        tasks = self.all()
        tasks.append(task)
        self.save(tasks)
        return task
