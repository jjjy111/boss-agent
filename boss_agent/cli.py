"""Command-line interface for boss-agent."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional, Sequence, TextIO

from .models import Task, ValidationError
from .store import StoreError, TaskStore


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for the two iteration-1 commands."""
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--data-file",
        type=Path,
        default=None,
        help="task file to use (default: $BOSS_AGENT_DATA or ~/.boss-agent/tasks.json)",
    )

    parser = argparse.ArgumentParser(
        prog="boss-agent",
        description="A small command-line task tracker.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", parents=[common], help="capture a task")
    add.add_argument("title", help="what needs doing")
    add.set_defaults(handler=_cmd_add)

    show = sub.add_parser("list", parents=[common], help="list stored tasks")
    show.set_defaults(handler=_cmd_list)

    return parser


def _print_task(out: TextIO, task: Task) -> None:
    out.write(f"{task.id}  {task.title}\n")


def _cmd_add(args: argparse.Namespace, out: TextIO, store: TaskStore) -> int:
    task = store.add(args.title)
    out.write(f"added {task.id}  {task.title}\n")
    return 0


def _cmd_list(args: argparse.Namespace, out: TextIO, store: TaskStore) -> int:
    tasks: List[Task] = store.all()
    if not tasks:
        out.write("no tasks yet\n")
        return 0
    for task in tasks:
        _print_task(out, task)
    return 0


def main(
    argv: Optional[Sequence[str]] = None,
    out: Optional[TextIO] = None,
    err: Optional[TextIO] = None,
) -> int:
    """Run the CLI and return the process exit code."""
    out = out if out is not None else sys.stdout
    err = err if err is not None else sys.stderr

    parser = build_parser()
    args = parser.parse_args(argv)
    store = TaskStore(args.data_file)

    try:
        return int(args.handler(args, out, store))
    except ValidationError as exc:
        err.write(f"error: {exc}\n")
        return 2
    except StoreError as exc:
        err.write(f"error: {exc}\n")
        return 2
