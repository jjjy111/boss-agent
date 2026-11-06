"""Command-line interface for boss-agent."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional, Sequence, TextIO

from .dates import format_due, parse_due
from .models import Task, ValidationError
from .store import StoreError, TaskStore


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for the iteration-1 commands."""
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
    add.add_argument("--due", default=None, metavar="YYYY-MM-DD", help="when it is due")
    add.set_defaults(handler=_cmd_add)

    show = sub.add_parser("list", parents=[common], help="list stored tasks")
    show.add_argument(
        "--overdue",
        action="store_true",
        help="only tasks whose due date has already passed",
    )
    show.set_defaults(handler=_cmd_list)

    return parser


def _format_task(task: Task) -> str:
    line = f"{task.id}  {task.title}"
    if task.due is not None:
        line += f"  (due {format_due(task.due)})"
    return line


def _cmd_add(args: argparse.Namespace, out: TextIO, store: TaskStore) -> int:
    due = parse_due(args.due) if args.due is not None else None
    task = store.add(args.title, due=due)
    out.write(f"added {task.id}  {task.title}\n")
    return 0


def _cmd_list(args: argparse.Namespace, out: TextIO, store: TaskStore) -> int:
    tasks: List[Task] = store.all()
    if args.overdue:
        # Oldest due date first; ties broken by title, so the view is stable.
        tasks = sorted(
            (task for task in tasks if task.is_overdue()),
            key=lambda task: (task.due, task.title),
        )
        if not tasks:
            out.write("nothing overdue\n")
            return 0
    if not tasks:
        out.write("no tasks yet\n")
        return 0
    for task in tasks:
        out.write(_format_task(task) + "\n")
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
