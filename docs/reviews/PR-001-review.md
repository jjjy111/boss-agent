# Review of pull request #1 — due dates and the overdue view

| Field | Value |
| --- | --- |
| PR | [#1](https://github.com/OWNER/boss-agent/pull/1) — `feat(REQ-001): store due dates and add the overdue view` |
| Author | Huang Yuwen |
| Reviewer | Pan Yifei |
| Reviewed | 2026-11-06, 15:58 |
| Verdict | **Approved** — changes requested at first pass, addressed in `9ba0e3e` |

## Summary

The change is well scoped and the red/green evidence is exactly what the team agreed to
produce. The domain model is a good place for `is_overdue`, and the injectable `today`
keeps the tests off the wall clock. I could reproduce the whole feature from the PR
description.

Three things block approval: the write path can destroy the user's task file, AC4 is not
actually implemented even though its test is green, and a data file written before this
change can no longer be read — which contradicts the compatibility constraint in REQ-001.
Two minor points are about consistency and documentation.

## Findings

| ID | Severity | Location | Finding | Status |
| --- | --- | --- | --- | --- |
| R1 | Major | `boss_agent/store.py:54-60` | `save()` overwrites the task file in place; an interruption mid-write leaves a truncated file and every stored task is lost | Resolved in `9ba0e3e` |
| R2 | Major | `boss_agent/cli.py:69-82` | `list --overdue` returns creation order, not oldest-due-first as AC4 requires; the AC4 test only asserts that the titles appear, so the gap is invisible | Resolved in `9ba0e3e` |
| R3 | Major | `boss_agent/models.py:63` | `from_dict` reads `raw["due"]`; records written before this change have no `due` key and now raise `a stored task is missing 'due'`, so existing task files stop loading | Resolved in `9ba0e3e` |
| R4 | Minor | `boss_agent/cli.py:47-52` | Date parsing sits in the CLI, but the requirement's design note says parsing is centralised in one module so the CLI and the store cannot disagree | Resolved in `9ba0e3e` |
| R5 | Minor | `README.md:57` | README still says `20 passed` and documents neither `--due` nor `--overdue` | Resolved in `9ba0e3e` |

## R1 — the write path is not crash-safe (major)

```python
# boss_agent/store.py
def save(self, tasks: List[Task]) -> None:
    self.path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps([task.to_dict() for task in tasks], indent=2)
    try:
        self.path.write_text(payload + "\n", encoding="utf-8")   # truncates first
    except OSError as exc:
        raise StoreError(f"cannot write {self.path}: {exc}") from exc
```

`write_text` truncates the target before the new bytes are on disk. A power loss, a full
disk or a `Ctrl-C` in between leaves a half-written JSON file, and `load()` then refuses
to start — the user's whole list is gone. The store already treats a corrupt file as a
`StoreError`, so this is the one failure mode where the tool destroys data rather than
reporting a problem.

Suggestion: serialise to a temporary file in the same directory, flush, then
`os.replace()` it onto the target, which is atomic on POSIX and on Windows.

## R2 — AC4 is asserted, not implemented (major)

REQ-001 AC4 says the overdue view is ordered with the oldest due date first. The code
filters and prints in stored order:

```console
$ python -m boss_agent list --overdue --data-file /tmp/order.json
123cb03e  three-days-ago  (due 2026-11-03)
b04a3ff0  five-days-ago  (due 2026-11-01)   <- should be first
98da12ec  one-day-ago  (due 2026-11-05)
```

The test `test_ac4_overdue_view_contains_every_late_task` passes because it only checks
`title in out`. That is the more important finding: the test would stay green through a
regression of the very behaviour the criterion describes. Please sort by
`(due, title)` and assert the order in the test, not just the membership.

## R3 — pre-existing task files no longer load (major)

```console
$ cat /tmp/legacy.json
[{"id": "aaaaaaaa", "title": "old task", "created_at": "2026-11-01T09:00:00+00:00"}]
$ python -m boss_agent list --data-file /tmp/legacy.json
error: a stored task is missing 'due'          # exit code 2
```

REQ-001 lists backwards compatibility of the data file as a non-functional constraint, so
this is a requirement breach rather than a design preference. `raw.get("due")` treats a
missing key as "no due date", which is what a record written by the previous version
means. A regression test with such a record should be added.

## R4 — one parser, one place (minor)

`_parse_due` lives in `cli.py`. It is the only thing that knows the accepted date format,
so `strptime` semantics are now part of the CLI rather than the domain. Moving it to
`boss_agent/dates.py` (with `parse_due` and a `format_due` used by the list output) gives
one place to test and matches the design note the team agreed in REQ-001.

## R5 — documentation lags the code (minor)

`README.md` still advertises `20 passed` and has no `--due` or `--overdue` example. The
definition of done in `CONTRIBUTING.md` requires the README to describe new user-facing
behaviour.

## What I verified

- Ran the suite on the branch: `25 passed`, including the five acceptance tests.
- Ran the manual commands from the PR description; output matched.
- Confirmed the red evidence is real by reading `tests/test_due_dates.py` against the
  pre-implementation code.
- Reproduced R2 and R3 with the commands quoted above.

## Reviewer checklist

| Item | Result |
| --- | --- |
| Diff matches the requirement, nothing more | pass |
| Every acceptance criterion has a test | pass in count, **fail in strength** (R2) |
| Error paths handled | pass (invalid date, unreadable file) |
| No secrets, debug output or dead code | pass |
| Naming and structure match the surrounding code | pass, with the R4 exception |
| Small enough to review in one sitting | pass (164 added lines) |

## Required before approval

1. R1 — atomic replace in `TaskStore.save`, plus a test that a failed write leaves the
   previous file intact.
2. R2 — sort the overdue view by due date and assert the order in the AC4 test.
3. R3 — read `due` with `raw.get`, plus a regression test for a pre-change record.
4. R4, R5 — extract `boss_agent/dates.py`; update the README.

I will re-review the follow-up commit the same day.

## Re-review (2026-11-06, 16:35)

The follow-up commit `refactor(REQ-001): address the review findings R1-R5` addresses all
five findings in one pass, and each fix comes with a test that would fail without it.

- **R1** — `save()` now uses a temporary file, `fsync` and `os.replace`. The new test
  replaces `os.replace` with a failing stub and asserts that the previous file is byte
  identical afterwards and no temporary file is left behind. That is the right shape of
  test: it fails on the old code and passes on the new one.
- **R2** — the view is sorted by `(due, title)`; `test_ac4_overdue_view_is_oldest_first`
  now asserts the exact order and a second test covers the tie-break. I re-ran my own
  reproduction from the first pass and the output is now `five-days-ago`, `three-days-ago`,
  `one-day-ago`.
- **R3** — `raw.get("due")` plus a regression test that loads a record without the key.
  The `/tmp/legacy.json` file from my first pass now lists correctly.
- **R4** — `boss_agent/dates.py` owns parsing and formatting, with seven cases including a
  leap day and five rejected inputs.
- **R5** — README documents both new flags, the ordering rules, the exit codes and the
  current count.

Verified on the branch: `36 passed`. Manual run of `add --due`, `list`, `list --overdue`
and the invalid-date path all behave as documented. Nothing new was added that the
requirement does not ask for.

**Verdict: approved for merge.**
