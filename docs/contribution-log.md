# Contribution record

Iteration 1 · recorded 2026-11-06 · "commit counts alone are not sufficient evidence", so
each line names the artefact and what it demonstrates.

Every claim below is verifiable from the repository:

```bash
git shortlog -sne                       # commits per author
git log --author="Huang Yuwen" --stat   # one member's changes
git show 9ba0e3e                        # any referenced commit
```

| Member | Student ID | AUT email | Commits |
| --- | --- | --- | --- |
| Li Chenhao | 25307491 | vxy5720@autuni.ac.nz | 3 |
| Jiang Yu | 25307670 | hst2037@autuni.ac.nz | 3 |
| Huang Yuwen | 25307995 | kbk4057@autuni.ac.nz | 4 |
| Pan Yifei | 25305394 | sck9192@autuni.ac.nz | 2 |

## Li Chenhao — integration and repository ownership

| Contribution | Evidence | What it demonstrates |
| --- | --- | --- |
| Set up the shared repository: contribution rules, branching model, commit convention, PR and requirement templates | `7308790` · [CONTRIBUTING.md](../CONTRIBUTING.md) · [PR template](../.github/pull_request_template.md) | Defined the process the team then followed |
| Added the CI pipeline (Python 3.9 and 3.11) and the README setup / usage / test instructions | `1eaee8a` · [ci.yml](../.github/workflows/ci.yml) · [README](../README.md) | Made "green before merge" checkable by a machine, not by trust |
| Maintained `main`, reviewed the branch state and merged the pull request with `--no-ff`, keeping the branch visible | `6afe898` (merge) | Integration: nobody pushed to `main` directly |
| Published the evidence index, this record, the trial write-up and the release tag | [EVIDENCE_INDEX.md](../EVIDENCE_INDEX.md) · [workflow-trial.md](workflow-trial.md) | Submission packaging |

## Jiang Yu — requirements and documentation

| Contribution | Evidence | What it demonstrates |
| --- | --- | --- |
| Wrote the prioritised backlog, ordered riskiest-first, with testable acceptance criteria and owners | `41084c8` · [backlog.md](backlog.md) | Turned an idea into work that can be estimated and reviewed |
| Authored REQ-001: problem, user story, AC1–AC5, non-functional constraints, out of scope, design notes | `055b383` · [REQ-001](requirements/REQ-001-task-due-dates.md) | Traceable requirement — the review later checked the code against these words |
| Wrote the PR description: per-layer change list, AC-to-test mapping, red/green evidence, self-check with the documentation item deliberately left open | `15b2efd` · [PR-001](PR-001.md) | Made the change reviewable without reading the diff first |
| Drafted the Task 4 section of the group report | [report-task4-section.md](report-task4-section.md) | The written submission |

## Huang Yuwen — implementation and tests

| Contribution | Evidence | What it demonstrates |
| --- | --- | --- |
| Built the iteration-1 baseline (Task model, JSON store, CLI) with 20 tests | `b5830ae` | A working vertical slice before the assessed change |
| Wrote five acceptance tests mapped onto AC1–AC5 *before* the implementation; kept the failing run | `7284baa` · red run quoted in [PR-001](PR-001.md) | Test-first evidence: 5 failed, 20 passed |
| Implemented `due`, `is_overdue()`, `add --due`, `list --overdue`; caught a regression the new tests missed while running the full suite | `c89a638` | Delivery: 25 passed |
| Addressed all five review findings, each with the test that proves it: atomic write, ordered view, legacy data file, `dates` module, README | `9ba0e3e` · [review](reviews/PR-001-review.md) | Response to review: 36 passed |

## Pan Yifei — review and evidence

| Contribution | Evidence | What it demonstrates |
| --- | --- | --- |
| Reviewed PR #1 against the requirement: three blocking findings (non-atomic write, AC4 not implemented, legacy data files unreadable) and two minor, each with a reproduction command | `f5e9a42` · [review](reviews/PR-001-review.md) | Review found three defects the green suite could not |
| Re-reviewed the revision, verified each fix against its new test, changed the verdict to approved | `acaa725` | A review that closes the loop rather than just raising issues |
| Kept the evidence trail: reproduced R2 and R3 from the command line, recorded exact output in the review | `docs/reviews/PR-001-review.md` | Evidence quality — the findings are reproducible, not opinions |

## Balance and what we would change

Huang Yuwen carried the majority of the implementation (four commits, including the
baseline). The others contributed requirements, review and integration, which is a
plausible split for a single small requirement, but the team agreed to rotate the
implementer in iteration 2 so that no member is a single point of failure — and to have
Pan Yifei's review load shared, since one person reviewed every diff.
