# Prioritised backlog

Owner: Jiang Yu. Last groomed: 2026-11-06 (iteration 1 planning).
Every item is small enough to finish inside one short iteration. Items are ordered by
priority, and within an iteration the riskiest item goes first so that bad news arrives
early.

Legend: **P1** must ship in iteration 1 · **P2** should ship in iteration 2 ·
**P3** backlog, only if capacity allows.

## Iteration 1

| ID | Pri | Item | Acceptance criteria (testable) | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| B1 | P1 | Capture a task from the command line | Given no stored tasks, when I run `add "Write report"`, then the task is stored and `list` shows it; given an empty title, when I run `add ""`, then the command fails with a readable message and stores nothing | Huang Yuwen | Done (REQ-000, baseline) |
| B2 | P1 | List stored tasks | Given two stored tasks, when I run `list`, then both appear, oldest first, one per line | Huang Yuwen | Done (REQ-000, baseline) |
| B3 | P1 | Task due dates and an overdue view | See [REQ-001](requirements/REQ-001-task-due-dates.md) — AC1–AC5 | Huang Yuwen | Done (REQ-001, merge `6afe898`) |
| B4 | P2 | Complete a task | See [REQ-002](requirements/REQ-002-complete-task.md) — AC1–AC5 | Pan Yifei | In progress (REQ-002) |
| B5 | P2 | Search tasks by keyword | Given tasks "write report" and "book room", when I run `list --search report`, then only the first is shown; matching is case-insensitive | Pan Yifei | Iteration 2 |
| B6 | P2 | Export tasks to Markdown | Given stored tasks, when I run `export --format md`, then a Markdown table with title, due date and status is printed and is valid Markdown | Pan Yifei | Iteration 2 |
| B7 | P3 | Recurring tasks | Given a weekly task, when it is completed, then the next occurrence is created one week later | — | Backlog |

## Iteration 2 candidates (not yet accepted)

B4 and B5 are committed scope for iteration 2; B6 is stretch. The team reviews this table
at the start of iteration 2 and re-prioritises against what iteration 1 actually cost.

## Explicitly out of scope

Accounts, authentication, cloud sync, a GUI, notifications and multi-user conflict
resolution. Each is either outside the two short iterations or would turn a one-week
change into a multi-week one.

## How this backlog is maintained

- This file is the source of truth; GitHub Issues mirror the items for the review flow.
- An item is only "Ready" when every acceptance criterion is testable and the owner is
  named. "In review" means a PR exists and links the item.
- Anything that grows past one iteration is split, not extended.
