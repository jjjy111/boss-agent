"""Acceptance tests for REQ-002 — completing a task.

Written before the implementation, against ``docs/requirements/REQ-002-complete-task.md``.
The failing run is the "red" evidence in the pull request.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Tuple

import pytest

from boss_agent.cli import main


def run(argv: List[str], capsys: pytest.CaptureFixture) -> Tuple[int, str, str]:
    try:
        code = main(argv)
    except SystemExit as exc:  # argparse exits for unknown or malformed options
        code = int(exc.code or 0)
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def add(capsys: pytest.CaptureFixture, data: Path, title: str) -> str:
    code, out, err = run(["add", title, "--data-file", str(data)], capsys)
    assert code == 0, err
    return out.split()[1]


def stored(data: Path) -> list:
    return json.loads(data.read_text(encoding="utf-8"))


def test_ac1_completing_marks_and_persists(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    task_id = add(capsys, data, "Write report")

    code, out, err = run(["done", task_id, "--data-file", str(data)], capsys)

    assert (code, err) == (0, "")
    assert "Write report" in out
    record = stored(data)[0]
    assert record["done"] is True
    assert record["completed_at"] is not None

    code, listed, _ = run(["list", "--data-file", str(data)], capsys)
    assert code == 0
    assert "[done]" in listed


def test_ac2_unknown_id_changes_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    add(capsys, data, "Write report")
    before = data.read_bytes()

    code, _, err = run(["done", "zzzzzzzz", "--data-file", str(data)], capsys)

    assert code == 2
    assert "no task" in err.lower()
    assert "Traceback" not in err
    assert data.read_bytes() == before


def test_ac2_ambiguous_prefix_is_rejected(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    data.write_text(
        json.dumps(
            [
                {"id": "abcd1111", "title": "first", "created_at": "2026-11-01T09:00:00+00:00"},
                {"id": "abcd2222", "title": "second", "created_at": "2026-11-01T09:00:01+00:00"},
            ]
        ),
        encoding="utf-8",
    )
    before = data.read_bytes()

    code, _, err = run(["done", "abcd", "--data-file", str(data)], capsys)

    assert code == 2
    assert "matches" in err.lower()
    assert data.read_bytes() == before


def test_ac3_completed_task_is_not_overdue(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    code, out, _ = run(
        ["add", "late-task", "--due", "2026-01-05", "--data-file", str(data)], capsys
    )
    assert code == 0
    task_id = out.split()[1]

    code, _, _ = run(["done", task_id, "--data-file", str(data)], capsys)
    assert code == 0

    code, overdue, _ = run(["list", "--overdue", "--data-file", str(data)], capsys)
    assert code == 0
    assert "late-task" not in overdue
    assert "nothing overdue" in overdue


def test_ac4_task_file_without_done_key_still_loads(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    data.write_text(
        json.dumps(
            [
                {
                    "id": "aaaaaaaa",
                    "title": "old task",
                    "due": None,
                    "created_at": "2026-11-01T09:00:00+00:00",
                }
            ]
        ),
        encoding="utf-8",
    )

    code, out, _ = run(["list", "--data-file", str(data)], capsys)

    assert code == 0
    assert "old task" in out
    assert "[done]" not in out


def test_ac5_unique_prefix_works_and_second_call_is_harmless(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    task_id = add(capsys, data, "Write report")
    prefix = task_id[:4]

    code, _, err = run(["done", prefix, "--data-file", str(data)], capsys)
    assert code == 0, err
    first_timestamp = stored(data)[0]["completed_at"]

    code, _, err = run(["done", task_id, "--data-file", str(data)], capsys)
    assert code == 0, err
    assert stored(data)[0]["completed_at"] == first_timestamp


def test_ac4_done_without_timestamp_reads_as_unknown_time(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    """A hand-edited record can say done without a timestamp; that must still load (R2)."""
    data = tmp_path / "tasks.json"
    data.write_text(
        json.dumps(
            [
                {
                    "id": "bbbb1111",
                    "title": "done without a stamp",
                    "done": True,
                    "created_at": "2026-11-01T09:00:00+00:00",
                }
            ]
        ),
        encoding="utf-8",
    )

    code, out, _ = run(["list", "--data-file", str(data)], capsys)

    assert code == 0
    assert "done without a stamp  [done]" in out


def test_ac1_status_marker_sits_next_to_the_title(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    """The [done] marker comes before the due date, not after it (R3)."""
    data = tmp_path / "tasks.json"
    code, out, _ = run(
        ["add", "Write report", "--due", "2026-12-01", "--data-file", str(data)], capsys
    )
    assert code == 0
    task_id = out.split()[1]
    run(["done", task_id, "--data-file", str(data)], capsys)

    _, out, _ = run(["list", "--data-file", str(data)], capsys)

    line = next(line for line in out.splitlines() if "Write report" in line)
    assert "[done]" in line
    assert line.index("[done]") < line.index("(due")
