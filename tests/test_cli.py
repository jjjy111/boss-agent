"""End-to-end tests that drive the CLI the way a user does."""

from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

import pytest

from boss_agent.cli import main


def run(argv: List[str], capsys: pytest.CaptureFixture) -> Tuple[int, str, str]:
    """Run ``main`` and return (exit code, stdout, stderr)."""
    code = main(argv)
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def test_add_then_list_shows_the_task(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    data = str(tmp_path / "tasks.json")

    code, out, err = run(["add", "Write report", "--data-file", data], capsys)
    assert (code, err) == (0, "")
    assert "Write report" in out

    code, out, _ = run(["list", "--data-file", data], capsys)
    assert code == 0
    assert "Write report" in out


def test_list_on_a_fresh_store_says_so(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    code, out, _ = run(["list", "--data-file", str(tmp_path / "tasks.json")], capsys)

    assert code == 0
    assert "no tasks yet" in out


def test_blank_title_fails_with_a_readable_message(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"

    code, out, err = run(["add", "   ", "--data-file", str(data)], capsys)

    assert code == 2
    assert "non-empty title" in err
    assert "Traceback" not in err
    assert not data.exists()


def test_corrupt_data_file_fails_with_a_readable_message(
    tmp_path: Path, capsys: pytest.CaptureFixture
) -> None:
    data = tmp_path / "tasks.json"
    data.write_text("{ oops", encoding="utf-8")

    code, _, err = run(["list", "--data-file", str(data)], capsys)

    assert code == 2
    assert str(data) in err
    assert "Traceback" not in err
