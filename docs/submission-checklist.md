# Submission checklist

What the brief asks for, where it is, and what still needs a human decision.
Status as of 2026-11-06, after the repository was published at
<https://github.com/jjjy111/boss-agent>.

| # | Requirement | Status | Where |
| --- | --- | --- | --- |
| 1 | One group report in PDF: project definition, comparison of approaches, project plan, workflow trial, contribution statements | **Open** — Task 4 section drafted; the other sections belong to the other members | [report-task4-section.md](report-task4-section.md) |
| 2 | Repository link with assessor access | **Done** — public repository, <https://github.com/jjjy111/boss-agent> | — |
| 3 | Submission commit or release identified | **Done** — tag `v0.1.0-trial` (resolve with `git describe --tags`); the merge it contains is `6afe898` | `git show v0.1.0-trial` |
| 4 | README with setup and test instructions | **Done** | [README.md](../README.md) |
| 5 | Evidence index: backlog, tracked requirement, reviewed change, test / automated check results | **Done** | [EVIDENCE_INDEX.md](../EVIDENCE_INDEX.md) |
| 6 | Individual contribution statements with links | **Done** | [contribution-log.md](contribution-log.md) |
| 7 | Word limit: 1,500 words per team, excluding title page, reference list and appendices | **Track** — Task 4 draft is 363 words; check the total before submission | — |
| 8 | APA 7 referencing, consistent | **Track** — one reference added with the Task 4 section; add it to the report's reference list | [report-task4-section.md](report-task4-section.md) |
| 9 | Readable tables and diagrams where they help | **Done for Task 4** — timeline, AC-to-test mapping, review findings table | [workflow-trial.md](workflow-trial.md) |

## Push the local history

The repository exists and the remote is configured; the history has not been pushed yet.
From the repository root:

```bash
git push -u origin main
git push origin feat/REQ-001-due-dates     # keeps the reviewed branch visible
git push origin --tags                      # publishes v0.1.0-trial
```

Then, on GitHub:

1. **Actions** — the `ci` workflow runs on the push to `main` (Python 3.9 and 3.11). A green
   run is the automated check evidence; link or screenshot it if the appendix allows.
2. **Releases → Draft a new release** — choose the existing tag `v0.1.0-trial`, title it
   "Iteration 1 — workflow trial", and publish. That gives the assessor a stable artifact.
3. **Settings → Collaborators** — the repository is public, so no invitation is strictly
   needed; add the assessor's GitHub account only if they ask for it.

## Note on the pull request

The review was conducted on the branch diff inside the repository and is recorded in
[the review file](reviews/PR-001-review.md), with the author's response in
[PR-001.md](PR-001.md). GitHub therefore shows the branch and the merge commit in the
commit graph, but there is no pull-request thread to open: the branch was merged before the
repository was published, and GitHub reports "no commits to compare" for a branch that is
already contained in `main`. Do not create an empty PR to fill that gap — the in-repo record
is the evidence, and the commit graph shows the same sequence.

## Before submitting

- [ ] Run the three `git push` commands above.
- [ ] Confirm the CI run on `main` is green.
- [ ] Publish the release from tag `v0.1.0-trial`.
- [ ] Add the four student IDs and the AUT emails to the report title page.
- [ ] Confirm the report is under 1,500 words and that the reference list is APA 7.
- [ ] Check that a clean clone still reports `36 passed`.
