# 4. Collaborative workflow trial

*Draft for the group report (Task 4). Word count: 363, excluding the heading, the table and
the reference. Paste into the report before the conclusion; add the reference to the
report's APA 7 list.*

---

The team set up a shared Git repository before writing any product code, together with a
written working agreement: branches named after a tracked requirement, one review per
change, and a merge into `main` only when the automated suite passed in CI. Two project
templates — one for requirements, one for pull requests — turned that agreement into a
checklist that could be followed without discussion. Work was organised around a
prioritised backlog, so the change chosen for the trial (due dates and an overdue view)
was a tracked item with five testable acceptance criteria rather than an improvisation.

The change itself followed a deliberately small path: five acceptance tests were committed
before the implementation and failed, the change grew to roughly 300 added lines across seven
files, about two thirds of it tests, and the suite went from five failures to thirty-six
passing tests. The pull request
described the change layer by layer and mapped each criterion to the test that proved it.
A teammate who had not written the code then reviewed the diff and requested changes on
three blocking grounds: the save path could truncate the user's task file, the
ordering criterion was asserted but not implemented, and task files written before the
change could no longer be read. Each finding came with a command that reproduced it. The
author fixed all three, added a test per finding, and the reviewer approved the revision;
the branch was merged with a merge commit, so both the branch and the review remain in the
history.

This is consistent with Bacchelli and Bird's (2013) finding that review is valued mainly
for defect detection and knowledge transfer: two of the three blocking defects were
invisible to a fully green test suite, because the tests encoded the existence of a
behaviour rather than its quality. The main lesson is therefore about test design, not
tooling. The team now requires each acceptance test to fail if the criterion's specific
wording is violated, and the review checklist asks how a change fails. A second lesson is
that non-functional constraints need tests as soon as they are written: the compatibility
requirement sat in the document for six hours without one.

**Reference**

Bacchelli, A., & Bird, C. (2013). Expectations, outcomes, and challenges of modern code
review. In *Proceedings of the 2013 International Conference on Software Engineering*
(pp. 712–721). IEEE Press.
