"""Acceptance tests for REQ-001 — due dates and the overdue view.

These tests are written against the acceptance criteria in
``docs/requirements/REQ-001-task-due-dates.md`` and are expected to fail until the
feature is implemented (that failing run is the "red" evidence in the PR).
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import List, Tuple

import pytest

from boss_agent.cli import main


def run(argv: List[str], capsys: pytest.CaptureFixture) -> Tuple[int, str, str]:
    """Run the CLI in-process; argparse's SystemExit becomes the exit code."""
    try:
        code = main(argv)
    except SystemExit as exc:  # argparse exits for unknown or malformed options
        code = int(exc.code or 0)
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def add(capsys: pytest.CaptureFixture, data: Path, title: str, due: date = None) -> None:
    argv = ["add", title, "--data-file", str(data)]
    if due is not None:
        argv += ["--due", due.isoformat()]
    code, _, err = run(argv, capsys)
    assert code == 0, f"add failed: {err}"


def test_ac1_due_date_is_stored_and_listed(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    add(capsys, data, "Write report", date(2026, 11, 10))

    code, out, _ = run(["list", "--data-file", str(data)], capsys)

    assert code == 0
    assert "Write report" in out
    assert "(due 2026-11-10)" in out


def test_ac2_impossible_date_is_rejected_cleanly(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"

    code, _, err = run(
        ["add", "Write report", "--due", "2026-13-01", "--data-file", str(data)], capsys
    )

    assert code == 2
    assert "invalid date" in err.lower()
    assert "Traceback" not in err
    assert not data.exists(), "a rejected task must not be written to disk"


def test_ac3_only_past_due_dates_are_overdue(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    today = date.today()
    add(capsys, data, "late-task", today - timedelta(days=1))
    add(capsys, data, "due-today", today)
    add(capsys, data, "due-tomorrow", today + timedelta(days=1))
    add(capsys, data, "no-due")

    code, out, _ = run(["list", "--overdue", "--data-file", str(data)], capsys)

    assert code == 0
    assert "late-task" in out
    assert "due-today" not in out
    assert "due-tomorrow" not in out
    assert "no-due" not in out


def test_ac4_overdue_view_contains_every_late_task(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    today = date.today()
    add(capsys, data, "three-days-ago", today - timedelta(days=3))
    add(capsys, data, "five-days-ago", today - timedelta(days=5))
    add(capsys, data, "one-day-ago", today - timedelta(days=1))

    code, out, _ = run(["list", "--overdue", "--data-file", str(data)], capsys)

    assert code == 0
    for title in ("three-days-ago", "five-days-ago", "one-day-ago"):
        assert title in out


def test_ac5_tasks_without_due_dates_behave_as_before(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    add(capsys, data, "first")
    add(capsys, data, "second")

    code, out, _ = run(["list", "--data-file", str(data)], capsys)
    assert code == 0
    assert out.index("first") < out.index("second")
    assert "(due" not in out

    code, out, _ = run(["list", "--overdue", "--data-file", str(data)], capsys)
    assert code == 0
    assert "nothing overdue" in out
