# Contributing to boss-agent

This repository is the shared workspace for the group assessment. The rules below are
the team's working agreement; the trial recorded in [docs/workflow-trial.md](docs/workflow-trial.md)
was run against them.

## 1. Branching

`main` is protected in spirit: nobody pushes to it directly.

| Purpose | Branch naming | Example |
| --- | --- | --- |
| New behaviour | `feat/REQ-###-short-slug` | `feat/REQ-001-due-dates` |
| Defect fix | `fix/REQ-###-short-slug` | `fix/REQ-002-bad-date-crash` |
| Documentation only | `docs/short-slug` | `docs/workflow-trial` |
| Test or tooling only | `test/short-slug` / `chore/short-slug` | `chore/ci-pipeline` |

One branch carries one tracked requirement, one review, and one merge.

## 2. Commit messages

Conventional Commits, always with the requirement identifier when the change is
traceable to a requirement:

```
<type>(REQ-###): <imperative summary, <= 72 chars>

Why this change is needed, in one or two sentences.

Refs: REQ-###
```

Allowed types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.
The `Refs:` trailer is what makes the requirement -> commit -> test chain searchable:
`git log --grep="REQ-001"`.

## 3. Pull requests

Every branch reaches `main` through a pull request that uses
[the PR template](.github/pull_request_template.md). A PR is mergeable only when:

1. it links the tracked requirement and the backlog item it implements;
2. the acceptance tests for that requirement are in the diff;
3. `python -m pytest -q` passes locally and in the `ci` workflow;
4. one team member other than the author has reviewed the diff and either approved it
   or requested changes that are then resolved;
5. the README or docs are updated when behaviour changes.

Self-approval does not count. Review comments are answered in the PR thread, and the
fix commit references the comment (`R1`, `R2`, ...).

## 4. Definition of done

- [ ] Acceptance criteria of the requirement are each covered by at least one test.
- [ ] Tests fail before the implementation and pass after it (evidence kept).
- [ ] `python -m pytest -q` is green.
- [ ] README / docs describe any new user-facing behaviour.
- [ ] Review comments are resolved.
- [ ] The squash-or-merge decision is recorded in the PR description.

## 5. Merge policy

Merge commits (`--no-ff`) into `main`, so the branch and the review stay visible in the
history. The merge commit message records the PR number and title. Tags mark submission
points (`v0.1.0-trial` for this assessment).

## 6. Weekly rhythm used in the trial

| When | What |
| --- | --- |
| Start of iteration | Groom `docs/backlog.md`, confirm the requirement and its acceptance criteria |
| During | Small commits on a feature branch; tests written with (or before) the code |
| End of iteration | PR, review, merge, update the contribution log, 10-minute retrospective |
