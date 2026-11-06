# Evidence index

**Submission snapshot:** tag `v0.1.0-trial` on `main` — `git describe --tags` resolves the
exact commit; the merge it contains is `6afe898`.
All paths are relative to the repository root; the commit hashes can be opened with
`git show <hash>`.

The brief asks for evidence of a shared repository, one small change carried from a tracked
requirement through implementation and testing, a reviewed change, and a record of each
member's contribution. Each row below points at the artefact that carries that evidence,
and at the part worth reading.

## 1. Repository and working agreement

| Evidence | Path / commit | What it shows |
| --- | --- | --- |
| Repository set up with an explicit working agreement | [CONTRIBUTING.md](CONTRIBUTING.md) · `7308790` | Branch naming, commit convention, one review per PR, definition of done, merge policy |
| Review and requirement templates the team actually used | [.github/](.github) | PR checklist, requirement issue template |
| CI pipeline on every push and PR | [.github/workflows/ci.yml](.github/workflows/ci.yml) · `1eaee8a` | Tests run on Python 3.9 and 3.11, not only on the author's laptop |

## 2. Tracked requirement → implementation → tests

| Evidence | Path / commit | What it shows |
| --- | --- | --- |
| Prioritised backlog with testable acceptance criteria and owners | [docs/backlog.md](docs/backlog.md) · `41084c8` | The work item (B3) that the change implements |
| Tracked requirement, AC1–AC5, constraints, out of scope | [docs/requirements/REQ-001-task-due-dates.md](docs/requirements/REQ-001-task-due-dates.md) · `055b383` | The words the review checked the code against |
| Acceptance tests written before the implementation | [tests/test_due_dates.py](tests/test_due_dates.py) · `7284baa` | One test per criterion |
| Red run: 5 failed, 20 passed | [docs/PR-001.md](docs/PR-001.md) § Evidence | The tests genuinely failed before the code existed |
| Implementation | `c89a638` · [boss_agent/models.py](boss_agent/models.py), [cli.py](boss_agent/cli.py) | The change itself |
| Green run: 25 passed, later 36 passed | [evidence/test-results.txt](evidence/test-results.txt) | Tests pass, including the original suite (no regression) |

## 3. Reviewed change

| Evidence | Path / commit | What it shows |
| --- | --- | --- |
| Pull request description with AC-to-test mapping and evidence | [docs/PR-001.md](docs/PR-001.md) · `15b2efd` | A change made reviewable |
| Review: three blocking findings with reproductions, two minor, verdict "changes requested" | [docs/reviews/PR-001-review.md](docs/reviews/PR-001-review.md) · `f5e9a42` | An independent reviewer found defects the green suite could not |
| Author's response addressing every finding, each with a test | `9ba0e3e` · [PR-001](docs/PR-001.md) § Revision after review | Review actually changed the code |
| Re-review and approval | [review](docs/reviews/PR-001-review.md) § Re-review · `acaa725` | The loop closed |
| Merge commit keeping the branch visible | `6afe898` | The change reached `main` through review, not around it |

## 4. Workflow evidence and reflection

| Evidence | Path | What it shows |
| --- | --- | --- |
| Trial record: what was trialled, timeline, what the process caught, limitations | [docs/workflow-trial.md](docs/workflow-trial.md) | The workflow was exercised end to end, not described |
| Commit graph with the branch and the merge | [evidence/git-graph.txt](evidence/git-graph.txt) | Branch → commits → review → merge is visible in history |
| What the team learned and what it will change in iteration 2 | [workflow-trial.md](docs/workflow-trial.md) § 4–5 | Reflection tied to concrete events, not generic statements |
| Contribution record with links per member | [docs/contribution-log.md](docs/contribution-log.md) | Who did what, with the artefact that proves it |

## 5. Submission items

| Evidence | Path | What it shows |
| --- | --- | --- |
| README with setup, usage and test instructions | [README.md](README.md) | An assessor can clone, run and test in two commands |
| Submission commit, release tag, assessor access | [docs/submission-checklist.md](docs/submission-checklist.md) | The items that still need the published repository URL |
| Group report section for Task 4 | [docs/report-task4-section.md](docs/report-task4-section.md) | Ready to paste into the PDF |

## Reproduce the evidence in three commands

```bash
git checkout v0.1.0-trial
python3 -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements-dev.txt && python -m pytest -q     # 36 passed
```

Then `git log --graph --oneline --decorate` for the branch/merge structure, and
`git show 7284baa` / `git show c89a638` for the red step and the implementation.

## Note on the GitHub repository

The repository is published at <https://github.com/jjjy111/boss-agent>. The branch
`feat/REQ-001-due-dates` and the merge commit `6afe898` are pushed, so the commit graph on
GitHub shows the same sequence as `evidence/git-graph.txt`.

The review itself was conducted on the branch diff and recorded in
[docs/reviews/PR-001-review.md](docs/reviews/PR-001-review.md) (author response in
[docs/PR-001.md](docs/PR-001.md)); it is not a GitHub pull-request thread, because the
branch was merged before the repository was published. Nothing above depends on GitHub:
the requirement, commits, review findings, test runs and red/green output are all in the
history and in the files listed here.
