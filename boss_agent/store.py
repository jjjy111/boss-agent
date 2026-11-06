"""Persistence for boss-agent: one JSON file, read and written as a whole."""

from __future__ import annotations

import json
import os
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
        """Write every task to disk, replacing the previous contents."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps([task.to_dict() for task in tasks], indent=2)
        try:
            self.path.write_text(payload + "\n", encoding="utf-8")
        except OSError as exc:
            raise StoreError(f"cannot write {self.path}: {exc}") from exc

    def add(self, title: str, due: Optional[date] = None) -> Task:
        """Validate, store and return a new task."""
        task = Task(title=title, due=due)
        tasks = self.all()
        tasks.append(task)
        self.save(tasks)
        return task
