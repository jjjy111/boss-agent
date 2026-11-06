# Submission checklist

What the brief asks for, where it is, and what still needs a human decision.
Status as of 2026-11-06, after the repository was published at
<https://github.com/jjjy111/boss-agent>.

| # | Requirement | Status | Where |
| --- | --- | --- | --- |
| 1 | One group report in PDF: project definition, comparison of approaches, project plan, workflow trial, contribution statements | **Open** — Task 4 section drafted; the other sections belong to the other members | [report-task4-section.md](report-task4-section.md) |
| 2 | Repository link with assessor access | **Done** — public repository, <https://github.com/jjjy111/boss-agent> | — |
| 2a | A reviewed change visible on GitHub (Task 4) | **Done** — pull request #1, approved by a reviewer with write access, checks green on 3.9 and 3.11 | <https://github.com/jjjy111/boss-agent/pull/1> |
| 3 | Submission commit or release identified | **Done** — tag `v0.1.0-trial` (resolve with `git describe --tags`); the merge it contains is `6afe898` | `git show v0.1.0-trial` |
| 4 | README with setup and test instructions | **Done** | [README.md](../README.md) |
| 5 | Evidence index: backlog, tracked requirement, reviewed change, test / automated check results | **Done** | [EVIDENCE_INDEX.md](../EVIDENCE_INDEX.md) |
| 6 | Individual contribution statements with links | **Done** | [contribution-log.md](contribution-log.md) |
| 7 | Word limit: 1,500 words per team, excluding title page, reference list and appendices | **Track** — Task 4 draft is 363 words; check the total before submission | — |
| 8 | APA 7 referencing, consistent | **Track** — one reference added with the Task 4 section; add it to the report's reference list | [report-task4-section.md](report-task4-section.md) |
| 9 | Readable tables and diagrams where they help | **Done for Task 4** — timeline, AC-to-test mapping, review findings table | [workflow-trial.md](workflow-trial.md) |

## Published

Pushed over SSH to <https://github.com/jjjy111/boss-agent>:

| Ref | State |
| --- | --- |
| `main` | pushed, tracks `origin/main` |
| `feat/REQ-001-due-dates` | pushed, so the reviewed branch is visible next to the merge |
| `v0.1.0-trial` | pushed |

CI runs on every push to `main`. The first run failed in `setup-python` for the Python 3.9
matrix entry only (`ubuntu-latest` is 24.04 and has no prebuilt 3.9); the matrix was pinned
to `ubuntu-22.04` for 3.9 in `989375a`, and the [following run](https://github.com/jjjy111/boss-agent/actions/runs/42173055266)
is green for both 3.9 and 3.11. That failed-then-fixed pair is also a useful artefact: it
shows the pipeline actually gates the work.

Still to do on GitHub:

1. **Releases → Draft a new release** — choose the existing tag `v0.1.0-trial`, title it
   "Iteration 1 — workflow trial", and publish. That gives the assessor a stable artifact.
2. **Settings → Collaborators** — the repository is public, so no invitation is strictly
   needed; add the assessor's GitHub account only if they ask for it.

## Note on the pull requests

Pull request #1 (REQ-002, completing a task) is the first pull request carried through the
GitHub review flow: open → review → approval → merge commit. It is the live version of the
in-repo review record used in iteration 1.

## Note on iteration 1's review

The review was conducted on the branch diff inside the repository and is recorded in
[the review file](reviews/PR-001-review.md), with the author's response in
[PR-001.md](PR-001.md). GitHub therefore shows the branch and the merge commit in the
commit graph, but there is no pull-request thread to open: the branch was merged before the
repository was published, and GitHub reports "no commits to compare" for a branch that is
already contained in `main`. Do not create an empty PR to fill that gap — the in-repo record
is the evidence, and the commit graph shows the same sequence.

## Before submitting

- [x] Push `main`, the reviewed branch and the tag.
- [x] Confirm the CI run on `main` is green (3.9 and 3.11).
- [ ] Publish the release from tag `v0.1.0-trial`.
- [ ] Add the four student IDs and the AUT emails to the report title page.
- [ ] Confirm the report is under 1,500 words and that the reference list is APA 7.
- [ ] Check that a clean clone still reports `36 passed`.
