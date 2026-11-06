# REQ-000 — Task capture and listing (iteration 1 baseline)

| Field | Value |
| --- | --- |
| ID | REQ-000 |
| Backlog items | [B1, B2](../backlog.md) |
| Iteration | 1 |
| Priority | P1 |
| Owner | Huang Yuwen |
| Status | Done |

## Problem

The project needs a working vertical slice before any collaboration workflow can be
trialled: something a user can actually run, and something a test can actually assert on.
This baseline is not the assessed change; REQ-001 is.

## Acceptance criteria

- **AC1** Given no stored tasks, when `add "Write report"` runs, then the task is persisted
  and `list` shows it.
- **AC2** Given an empty or whitespace-only title, when `add ""` runs, then the command
  exits with code 2 and stores nothing.
- **AC3** Given two stored tasks, when `list` runs, then both are printed in creation order,
  one per line.
- **AC4** Given a corrupted data file, when any command runs, then the error names the file
  and exits with code 2 instead of printing a traceback.

## Implementation

Delivered in the commit `feat(REQ-000): add task capture and listing for iteration 1`
on `main`, with unit and CLI tests in `tests/`.
