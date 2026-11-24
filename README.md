# BOSS - Agent MVP

A local job-search workbench: BOSS posting collection, role archiving, general résumé
versions, DeepSeek tailoring, A4 editing in the browser, PDF export and final confirmation.

BOSS - Agent only prepares material on the local machine. **It never sends any message to
BOSS on the user's behalf**, and never reads or uploads BOSS cookies.

## Getting started

On macOS you can double-click `启动求职Agent.command` in the project folder. You can also
run the following in the project directory:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Open <http://127.0.0.1:8000/>. The page and the daily tasks depend on this terminal
staying open.

## BOSS job collection

Collection uses the project's own Manifest V3 Chrome extension. It no longer uses
Playwright, a remote debugging port or CDP control of the browser. BOSS - Agent, BOSS and
the extension all run in the same Chrome you normally use. Chrome 137 and later no longer
loads local extensions automatically from the command line, so a one-time manual
installation is required.

To switch to the extension version for the first time:

1. In the Chrome that is running BOSS - Agent, open a new tab and go to `chrome://extensions/`.
2. Turn on **Developer mode** in the top right. Return to BOSS - Agent and click
   **Open extension folder**, then click **Load unpacked** on the extensions page and
   select the `extension` folder in Finder. This only has to be done once.
3. Return to BOSS - Agent and click **Open BOSS**, then log in in the new tab. Complete any
   security check manually and keep Chrome open.
4. Return to BOSS - Agent. The page refreshes its status automatically; once it shows
   *extension online, BOSS logged in*, click **Collect now**.

The collection task works through Hangzhou, Ningbo and Shanghai in that order, searches for
product-related roles and reads the full JD. It excludes roles whose title contains 运营,
roles that explicitly require a master's or doctoral degree, and roles that explicitly
require more than two years of experience. The extension reads the visible list pages and
the role details, and writes the results into the local SQLite database.

- Old roles that no longer appear are archived only when all three cities and the complete
  JDs have been scanned.
- Login expiry, security checks, an incomplete list or missing details are stored as a
  failed or partial run, so previously collected roles are never archived by mistake.
- Collection is triggered only by clicking **Collect now**; the application registers no
  scheduled tasks, and the computer only needs to stay awake while collecting.
- The BOSS login state is maintained by Chrome itself. The extension reaches only
  `zhipin.com` and `127.0.0.1:8000` on this machine, and never reads or uploads cookie
  content.

The BOSS page structure or security policy may change. If the page asks for verification,
collection pauses and keeps that page; complete the check and click **Collect now** again.
Please avoid running it repeatedly in a short period of time.

## DeepSeek tailored résumé

1. Add `DEEPSEEK_API_KEY` to `.env` at the project root; the file is ignored by Git.
2. In the job detail, choose a general résumé version and click
   **Generate résumé for this job**. Generating again for the same job and the same general
   version overwrites the current draft.
3. The system keeps the entire original content of the general résumé and allows only
   reordering, rewording and factually supported additions; it also stores the reasons for
   the changes, JD keyword coverage and risks.
4. Clicking **Edit tailored résumé** opens the A4 editor in a new tab. Before confirmation,
   only the text that differs from the general version is highlighted in pale yellow.
5. After clicking **Confirm changes** the highlight disappears permanently, but the draft
   remains editable, previewable and exportable. After exporting, click **Confirm PDF** to
   record that the material for this job is final.

The photo is stored locally per general résumé version. Click **Upload** on the general
résumé edit page to bind a photo; drafts generated from that version inherit it and show it
in the top right corner, and **Save as a new version** copies the photo as well. After
updating or deleting the photo, tailored résumés that have already been generated must be
exported and confirmed again.

The API key is read only by the local backend and is never returned to the browser.

## Scope

Earlier versions automatically captured the confirmed PDF, generated a greeting message and
sent both the text and the résumé image to BOSS through the Chrome extension. That delivery
pipeline has been removed: `backend/delivery.py`, the `Application`/`BossSendTask` tables,
`/api/tailored/{id}/apply`, `/send-preview`, `/send`, `/api/applications`, and the
extension's send tasks have all been deleted.

The workflow now ends at **Confirm PDF**: the material stays on the local machine, and
whether and how to send it is the user's own decision on the BOSS page. An existing
database may still contain the old `applications` and `boss_send_tasks` tables; they are no
longer read and can be ignored or dropped manually.

## Repository layout

- `backend/`: FastAPI app, SQLite, collection tasks, résumé generation and PDF endpoints
- `extension/`: local BOSS collection extension (1.3.0, no sending)
- `frontend/`: job workbench and A4 résumé editor
- `data/`: local database, collection state and generated PDFs (created automatically)
- `collector/`: the old Playwright collector, kept for historical reference only; not used
  at runtime
- `scripts/`: seed script for demonstration data
- `docs/product/`: acceptance logs for each iteration

## Two iterations

| Iteration | Delivered | Pull requests |
| --- | --- | --- |
| 1 | Collection pipeline from the Playwright prototype to the Manifest V3 extension; three-city rotation with full-JD validation; job workbench with date filter and archive view | #3 #4 #5 |
| 2 | DeepSeek tailoring with grounding checks; tailoring, PDF export and confirmation endpoints; résumé versions and photo binding; A4 editor; final confirmation | #7 #8 |

Both iterations followed the same workflow: one branch per area, a pull request for every
branch, a review from a member who did not write the code, and a merge commit only after
that review. The acceptance evidence for each iteration is kept next to the code it
describes.

## Verification

- `scripts/seed_demo_data.py` seeds six fictional roles (one archived) so the list, the
  filters and the archive view can be exercised without a real BOSS account.
- Iteration 1 acceptance log: `docs/product/测试记录-第1轮.md`.
- Iteration 2 acceptance log: `docs/product/测试记录-第2轮.md`.
- All sample data is fictional; no real résumé content is included.

## Known limitations

- Collection depends on the current BOSS page structure; a layout change requires updating
  the selectors in `extension/`.
- The city order is fixed in the code rather than configurable.
- The application assumes a single local user and has no authentication of its own.
- The two acceptance-log filenames are still in Chinese, because they were created during
  the iterations and are referenced from the pull requests.
