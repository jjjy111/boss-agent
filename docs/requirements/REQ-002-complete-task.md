# REQ-002 — Complete a task

| Field | Value |
| --- | --- |
| ID | REQ-002 |
| Backlog item | [B4](../backlog.md) |
| Iteration | 2 |
| Priority | P2 |
| Owner (implementation) | Pan Yifei |
| Reviewer | Huang Yuwen |
| Status | In progress |
| Opened | 2026-11-06 |

## Problem

Tasks can be created and given due dates, but never closed. The list grows forever and an
overdue task keeps nagging even after the work is finished, so the overdue view stops being
trustworthy within a week. This is the first item of iteration 2, and the implementer role
is rotated to the member who reviewed iteration 1's change, which is one of the lessons the
team recorded in [the trial write-up](../workflow-trial.md).

## User story

> As someone who tracks work in the terminal,
> I want to mark a task as done,
> so that the overdue view only shows work that is still outstanding.

## Acceptance criteria

- **AC1 — completing marks and persists.** Given a stored task, when `done <id>` runs, then
  it exits 0, the task is stored with `done: true` and a completion timestamp, and `list`
  shows the task with the `[done]` marker.
- **AC2 — a bad id changes nothing.** Given an id that matches no task, or a prefix that
  matches more than one, when `done <id>` runs, then it exits 2, the message says which
  problem it is, and the data file is byte-for-byte unchanged.
- **AC3 — completed work stops nagging.** Given a task whose due date has passed, when it is
  completed and `list --overdue` runs, then it is not listed.
- **AC4 — old task files still load.** Given a task file written before this change (no
  `done` key), when it loads, then the task is treated as open and lists exactly as before.
- **AC5 — prefixes work and completing twice is harmless.** Given a unique id prefix, when
  `done <prefix>` runs, then that task is completed; running `done` again on the same task
  exits 0 without changing the completion timestamp.

## Non-functional constraints

- No new runtime dependency (standard library only).
- The data format stays backwards compatible in both directions: a `done` key is optional.
- Exit codes unchanged: `0` success, `2` invalid input or unreadable data file.

## Out of scope

Re-opening a completed task, deleting tasks, filtering `list` by status, and archiving
completed tasks. Each is a separate backlog item.

## Design notes

- `done` is a boolean plus `completed_at` on the domain object; both default to "open" and
  `null` when read from an older record.
- `Task` stays frozen, so completing produces a new object via `dataclasses.replace`; the
  store is still the only component that writes the file.
- Id resolution (exact id or unique prefix) lives in the store, next to the data it
  resolves against, so the CLI only has to format the outcome.

## Traceability

| Artefact | Link |
| --- | --- |
| Acceptance tests | `tests/test_complete_task.py` |
| Pull request | _to be filled once the PR exists_ |
| Review record | _GitHub review thread on the pull request_ |
