# Workflow trial — record and reflection

Iteration 1 · 2026-11-06 · team of four · one tracked requirement taken end to end.

The team had a working repository and a rulebook (`CONTRIBUTING.md`) but no evidence that
the rules survived contact with real work. This trial takes one small requirement,
REQ-001 (due dates and an overdue view), from backlog to merge, and records what actually
happened at each step — including the two moments the process failed to catch something.

## 1. What was trialled

| Element | What we did |
| --- | --- |
| Tracked requirement | B3 in the backlog, broken into REQ-001 with five testable acceptance criteria |
| Branching | `feat/REQ-001-due-dates`, one requirement, one review, one merge |
| Test-first slice | Five acceptance tests committed *before* the implementation, red run kept as evidence |
| Review | A teammate other than the author reviewed the diff and requested changes; the author answered each finding |
| Merge discipline | `--no-ff` merge so the branch and the review stay in the history |
| Evidence | Red/green test output, review record, commit graph, contribution log |

## 2. Timeline

| Time | Member | Action | Artefact |
| --- | --- | --- | --- |
| 09:12 | Li Chenhao | Created the shared repository, contribution rules, PR and requirement templates | `7308790`, `CONTRIBUTING.md` |
| 10:04 | Jiang Yu | Prioritised the backlog, put the riskiest item first | `41084c8`, `docs/backlog.md` |
| 10:38 | Jiang Yu | Broke the item into REQ-001 with AC1–AC5 and a compatibility constraint | `055b383`, `docs/requirements/REQ-001-task-due-dates.md` |
| 11:26 | Huang Yuwen | Built the baseline slice the requirement would change | `b5830ae`, 20 tests |
| 13:10 | Li Chenhao | Added CI and the setup/test instructions the submission needs | `1eaee8a` |
| 14:02 | Huang Yuwen | Wrote the five acceptance tests first; they failed | `7284baa`, red run: 5 failed / 20 passed |
| 14:47 | Huang Yuwen | Implemented the feature; suite green | `c89a638`, 25 passed |
| 15:20 | Jiang Yu | Wrote the PR description with the red/green evidence | `15b2efd`, `docs/PR-001.md` |
| 15:58 | Pan Yifei | Reviewed: three blocking findings, two minor | `f5e9a42`, `docs/reviews/PR-001-review.md` |
| 16:24 | Huang Yuwen | Fixed all five findings and added the tests that prove each one | `9ba0e3e`, 36 passed |
| 16:35 | Pan Yifei | Re-reviewed and approved | `acaa725` |
| 16:40 | Li Chenhao | Merged the branch into `main` | `6afe898` |

The full branch structure is in `evidence/git-graph.txt`; `git log --graph` reproduces it.

## 3. What the process actually caught

Two of the three blocking review findings were invisible to the automated suite, which is
the whole argument for keeping a human review step:

1. **A green test that proved nothing.** AC4 says the overdue view is ordered oldest
   first. The test asserted only that each title appeared, so the implementation could
   return creation order and still pass. Pan Yifei read the criterion rather than the test
   and reproduced the wrong order by hand.
2. **A requirement breach no test covered.** REQ-001 lists backwards compatibility as a
   constraint. `from_dict` read `raw["due"]`, so any task file written before the change
   failed with `a stored task is missing 'due'`. A one-line reproduction made it obvious;
   nothing in the suite touched a legacy record.
3. **A data-loss path.** `save()` truncated the task file before writing the new bytes, so
   an interrupted write destroyed the user's list. No test simulated a failed write, and
   the reviewer found it by reading the write path.

## 4. What the team learned

- **A test can encode the existence of a behaviour without encoding its quality.** We
  now require every acceptance test to fail if the criterion's *specific wording* is
  violated — for AC4 that means asserting order, not membership. The follow-up test
  (`test_ac4_overdue_view_is_oldest_first`) was checked against the old implementation
  before it was accepted.
- **Non-functional constraints need tests at the moment they are written.** "Backwards
  compatible" sat in the requirement for six hours without a single test. We are adding a
  rule to the PR template: one test per constraint, or an explicit justification.
- **Review catches failure modes that tests do not simulate.** Crash safety, partial
  writes and compatibility are cheap to reason about and expensive to discover later. The
  review checklist now has a "how does this fail?" line.
- **Small commits made the review fast.** The first push was 164 added lines across four
  files (306 by the end, two thirds of them tests), the review took roughly 40 minutes including reproducing two findings. When
  we tried to bundle documentation into the same commit earlier, it muddied the diff, so
  documentation stayed in its own commits.
- **The workflow costs time, but predictably.** Roughly 2.5 hours of the 7.5-hour day was
  satisfying the process (red tests, PR description, review, fixes). The fixes were worth
  more than the feature: they removed a data-loss path and a compatibility break.

## 5. What we will change in iteration 2

1. Open the pull request as a draft at the first push, so the reviewer sees the direction
   before the polish (the review currently happens only at the end).
2. Add two lines to the review checklist: "which test fails if this behaviour regresses?"
   and "how does this change fail?".
3. Keep the same one-requirement-per-branch rule; the merge history is now readable enough
   to bisect if iteration 2 breaks something.
4. Rotate the reviewer role; Pan Yifei reviewed every diff this iteration, which is a
   single point of failure and a lot of load for one person.

## 6. Honest limitations

The trial used placeholder identities in the first hour and was published to GitHub after
the fact; the review happened on the diff in this repository and is recorded in
`docs/reviews/PR-001-review.md` rather than in a GitHub review thread. The requirement,
the code, the red and green test runs and the review findings are all real and
reproducible from the commit history; the GitHub links in the documents point at the
repository once it is published.
