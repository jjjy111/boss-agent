# boss-agent

[![ci](https://github.com/jjjy111/boss-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/jjjy111/boss-agent/actions/workflows/ci.yml)

A small command-line task tracker, used by a team of four as the vehicle for the
collaborative-workflow trial in the group assessment. The scope is deliberately narrow:
one requirement can be carried from a tracked backlog item through implementation, tests
and review inside a short iteration.

- **Status:** iteration 1, version 0.1.0
- **Language:** Python 3.9+ · **Runtime dependencies:** none (standard library only)
- **Tests:** `pytest` · **CI:** GitHub Actions (`.github/workflows/ci.yml`)

## Setup

Requirements: Python 3.9 or newer and `git`.

```bash
git clone <this repository>
cd boss-agent
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install -r requirements-dev.txt
```

There is nothing to install for the application itself: it runs from the repository root.

## Usage

```bash
python -m boss_agent add "Write the group report" --due 2026-11-10
python -m boss_agent add "Book the room"
python -m boss_agent list
python -m boss_agent done 3f9c1a7e
python -m boss_agent list --overdue
```

```console
$ python -m boss_agent add "Write the group report" --due 2026-11-10
added 3f9c1a7e  Write the group report

$ python -m boss_agent add "Read lecture notes" --due 2026-11-01
added 85cd12b9  Read lecture notes

$ python -m boss_agent list --data-file ./tasks.json
3f9c1a7e  Write the group report  (due 2026-11-10)
85cd12b9  Read lecture notes  (due 2026-11-01)

$ python -m boss_agent done 85cd12b9 --data-file ./tasks.json
completed 85cd12b9  Read lecture notes

$ python -m boss_agent list --data-file ./tasks.json
3f9c1a7e  Write the group report  (due 2026-11-10)
85cd12b9  Read lecture notes  [done]  (due 2026-11-01)

$ python -m boss_agent list --overdue --data-file ./tasks.json
nothing overdue
```

`done` accepts a full task id or any unique prefix of it. Completed tasks keep their place
in `list` with a `[done]` marker and stop appearing in the overdue view; completing the same
task twice is a no-op.

A task is overdue when its due date is strictly before today, so a task due *today* is
still on time and a task without a due date is never overdue. The overdue view is printed
with the oldest due date first (ties broken by title) and prints `nothing overdue` when
nothing is late.

Tasks are stored in `~/.boss-agent/tasks.json`. Use `--data-file` (or the
`BOSS_AGENT_DATA` environment variable) to keep separate lists:

```bash
python -m boss_agent list --data-file ./tasks.json
```

Exit codes: `0` success, `2` invalid input or unreadable data file. Messages go to stderr
and the CLI never prints a traceback for user error.

## Tests

```bash
python -m pytest -q
```

Expected output on a clean checkout: `42 passed`.

| File | Level |
| --- | --- |
| `tests/test_models.py` | domain rules and (de)serialisation |
| `tests/test_dates.py` | the single date parser and formatter |
| `tests/test_store.py` | persistence, corruption, ordering, atomic replace |
| `tests/test_cli.py` | end-to-end through `main`, including error paths |
| `tests/test_due_dates.py` | acceptance tests for REQ-001 (AC1–AC5) |
| `tests/test_complete_task.py` | acceptance tests for REQ-002 (completing a task) |

CI runs the same command on Python 3.9 and 3.11 for every push to `main` and every pull
request.

## Repository layout

```text
boss_agent/          application package (models, dates, store, CLI)
tests/               pytest suite
docs/                backlog, requirements, review records, trial write-up
.github/             CI workflow, PR and requirement templates
EVIDENCE_INDEX.md    map from each assessment requirement to its evidence
CONTRIBUTING.md      branching, commit, PR and review rules the team follows
```

Writes are atomic: the task file is replaced via a temporary file and `os.replace`, so an
interrupted save cannot truncate the list.

## Team and roles

| Member | GitHub | Role in the trial |
| --- | --- | --- |
| Li Chenhao | `@lichenhao` (placeholder) | Repository owner, CI, integration and merge |
| Jiang Yu | `@jiangyu` (placeholder) | Requirements, backlog, PR description |
| Huang Yuwen | `@huangyuwen` (placeholder) | Implementation and automated tests |
| Pan Yifei | `@panyifei` (placeholder) | Review and evidence |

## Further reading

- [docs/backlog.md](docs/backlog.md) — prioritised backlog with acceptance criteria
- [docs/requirements/](docs/requirements) — one file per tracked requirement
- [docs/PR-001.md](docs/PR-001.md) — the change under review, with red/green evidence
- [docs/reviews/PR-001-review.md](docs/reviews/PR-001-review.md) — the review that changed it
- [docs/workflow-trial.md](docs/workflow-trial.md) — what the trial produced and what we learned
- [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) — the evidence index required for submission
