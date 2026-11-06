# REQ-001 — Task due dates and an overdue view

| Field | Value |
| --- | --- |
| ID | REQ-001 |
| Backlog item | [B3](../backlog.md) |
| Iteration | 1 |
| Priority | P1 |
| Owner (implementation) | Huang Yuwen |
| Reviewer | Pan Yifei |
| Status | In review |
| Opened | 2026-11-06 |

## Problem

`boss-agent` can capture and list tasks, but every task looks equally urgent. A user
cannot tell what is late, so the list stops being a decision aid after about five items.
The team picked this requirement for the workflow trial because it is small, has a clear
user-visible outcome, and touches every layer of the code (model, storage, CLI, tests).

## User story

> As someone tracking work in the terminal,
> I want to attach a due date to a task and ask for the overdue ones,
> so that I know what I am already late on without reading the whole list.

## Acceptance criteria

Each criterion is written so that it can be turned directly into an automated test.

- **AC1 — a due date is stored and shown.** Given a task is added with `--due 2026-11-10`,
  when it is listed, then the stored task carries that date and the line shows it in ISO
  form (`YYYY-MM-DD`).
- **AC2 — an impossible date is rejected cleanly.** Given `--due 2026-13-01` (or any value
  that is not a real calendar date), when the command runs, then it exits with code 2, the
  message says the date is invalid, nothing is written to the data file, and no Python
  traceback is printed.
- **AC3 — only genuinely late tasks are overdue.** Given tasks due yesterday, today,
  tomorrow, and one with no due date, when `list --overdue` runs, then only the task due
  yesterday is printed. A task due *today* is not overdue.
- **AC4 — the overdue view is ordered by urgency.** Given three overdue tasks with
  different due dates, when `list --overdue` runs, then they are printed with the oldest
  due date first (ties broken by title).
- **AC5 — existing behaviour is unchanged.** Given tasks without a due date, when `list`
  runs, then they are still shown, in creation order, exactly as before, and they never
  appear in the overdue view.

## Non-functional constraints

- No new runtime dependency: the implementation must work with the Python 3.9+ standard
  library only (test tooling may use `pytest`).
- The data file format stays backwards compatible: task records written before this change
  (no `due` key) must still load.
- Command line interface stays `boss-agent <command> [options]` with exit code 0 on
  success, 2 on invalid input.

## Out of scope

Reminders and notifications, time-of-day precision, time zones (dates are naive local
dates), editing or clearing a due date after creation, and completing tasks (that is B4 in
iteration 2).

## Design notes

- `due` is a `datetime.date` on the domain object and an ISO string in JSON, so the stored
  file stays human-readable and diffable.
- Parsing is centralised in one function (`boss_agent.dates.parse_due`) so that the CLI and
  the storage layer cannot disagree about what a valid date is.
- "Overdue" is a derived property, computed against an injectable `today`, which keeps the
  tests independent of the machine clock.

## Traceability

| Artefact | Link |
| --- | --- |
| Acceptance tests | `tests/test_due_dates.py` |
| Pull request | [#1](https://github.com/OWNER/boss-agent/pull/1) |
| Review record | [PR-001 review](../reviews/PR-001-review.md) |
| Merge commit | recorded in [EVIDENCE_INDEX.md](../../EVIDENCE_INDEX.md) |

> The PR link becomes valid once the repository is published under the team's GitHub
> organisation; the local history and the review record in this repository are the
> evidence used for the assessment.
