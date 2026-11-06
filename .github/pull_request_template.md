## Linked requirement

- Requirement: REQ-### (link to `docs/requirements/REQ-###-*.md`)
- Backlog item: B## (`docs/backlog.md`)
- Iteration: 1 / 2

## What changed and why

<!-- Two or three sentences. State the behaviour change, not the file list. -->

## Acceptance criteria covered

| AC | Test that proves it | Result |
| --- | --- | --- |
| AC1 | `tests/...::test_...` | pass |
| AC2 | `tests/...::test_...` | pass |

## Evidence

- [ ] Red run before implementation (command + output pasted or linked)
- [ ] Green run after implementation: `python -m pytest -q`
- [ ] CI workflow `ci` green
- [ ] Docs / README updated

## Review checklist (for the reviewer)

- [ ] The diff does what the requirement says, and nothing more
- [ ] Each acceptance criterion has a test
- [ ] Error paths are handled, not just the happy path
- [ ] No secrets, no debug prints, no commented-out code
- [ ] Naming and structure match the surrounding code
- [ ] The change is small enough to review in one sitting

## Merge

- Merge strategy: merge commit (`--no-ff`)
- Reviewer: @
- Author confirms tests pass locally: yes / no
