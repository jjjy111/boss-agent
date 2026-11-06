# boss-agent

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
python -m boss_agent add "Write the group report"
python -m boss_agent list
```

```
$ python -m boss_agent add "Write the group report"
added 3f9c1a7e  Write the group report

$ python -m boss_agent list
3f9c1a7e  Write the group report
```

Tasks are stored in `~/.boss-agent/tasks.json`. Point `--data-file` (or the
`BOSS_AGENT_DATA` environment variable) somewhere else to keep separate lists:

```bash
python -m boss_agent list --data-file ./tmp.json
```

Exit codes: `0` success, `2` invalid input or unreadable data file (the message goes to
stderr; the CLI never prints a traceback for user error).

## Tests

```bash
python -m pytest -q
```

Expected output on a clean checkout: `20 passed`. The suite is split into

| File | Level |
| --- | --- |
| `tests/test_models.py` | domain rules and (de)serialisation |
| `tests/test_store.py` | persistence, corruption, ordering |
| `tests/test_cli.py` | end-to-end through `main`, including error paths |

CI runs the same command on Python 3.9 and 3.11 for every push to `main` and every pull
request.

## Repository layout

```
boss_agent/          application package (models, store, CLI)
tests/               pytest suite
docs/                backlog, requirements, review records, trial write-up
.github/             CI workflow, PR and requirement templates
EVIDENCE_INDEX.md    map from each assessment requirement to its evidence
CONTRIBUTING.md      branching, commit, PR and review rules the team follows
```

## Team and roles

| Member | Role in the trial |
| --- | --- |
| Li Chenhao | Repository owner, integration and merge |
| Jiang Yu | Requirements, backlog and documentation |
| Huang Yuwen | Implementation and automated tests |
| Pan Yifei | Review and evidence |

> Names, GitHub handles and email addresses are placeholders until the team links its real
> accounts (see `docs/submission-checklist.md`).

## Further reading

- [docs/backlog.md](docs/backlog.md) — prioritised backlog with acceptance criteria
- [docs/requirements/](docs/requirements) — one file per tracked requirement
- [docs/workflow-trial.md](docs/workflow-trial.md) — what the trial produced and what we learned
- [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) — the evidence index required for submission
