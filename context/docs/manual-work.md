# Manual Work

Everything in this project that needs **you**, not code. The `todo.md` line of a phase with manual work ends in a 👤 note, and its spec has a `## Your part` section with the exact steps. This file is the overview; keep it in step with them.

**Why there's manual work at all:** Transfermarkt answers automated requests with an AWS WAF challenge (`202`, `X-Amzn-Waf-Action: challenge`, first seen 2026-10-26). This repo never gets around a block, by a fake browser User-Agent or by driving a browser with code or the Playwright MCP. So Transfermarkt pages enter the project only one way: **you open them in your own browser and save them**. Code does everything after that.

## How to save a page

1. Open the link in your normal browser and wait until the page has loaded.
2. Save it as **HTML only**, not as a web archive or a "complete" page:
   - **Chrome or Edge:** ⌘S (Ctrl+S) → Format **Webpage, HTML Only**
   - **Safari:** File → Save As → Format **Page Source**
   - **Firefox:** ⌘S (Ctrl+S) → **Web Page, HTML only**
3. Save it into **`data/inbox/`** in this repo, under the file name its link list gives (`data/work/inbox-lists/`, `link-map.md` § 8). A wrong name does no harm: the importer reads the page's own URL (`og:url`) from inside the file.
4. When a batch is saved, run `uv run python -m extract.inbox` (built in S06b). It parses every page, files it under `data/pages/`, and lists anything it couldn't use, such as a challenge page saved by mistake, so you can save that one again.

Go at a normal browsing pace. If the site shows you a check, solve it as you normally would; that's you, not code.

## Checklist

| Phase | What you do | Size | When | Status |
| --- | --- | --- | --- | --- |
| S06a | Nothing | — | — | — |
| S06b | Save the 8 parser-fixture pages listed in `features/phase-s06b-transfermarkt-parsers.md` § Your part | 8 pages, ~5 min | After `/feature start` of S06b | **Done** (2026-10-27) |
| S06c | Nothing to save. Try the progress, check and open-links commands on the pages already saved (`features/phase-s06c-collection-tools.md` § Your part) | ~5 min | After `/feature test` of S06c | **Done** (2026-10-27) |
| S07 | Save the 2002–03 Süper Lig fixture list (the pilot derby) and the Euro 2004 fixture list (verifies the Euro link). Steps: `features/phase-s07a-pool-config-listings.md` § Your part | 2 pages, ~5 min | After `/feature start` of S07a | **Done** (2026-10-27) |
| S08 | Nothing to save | — | — | — |
| S11 | Save the pilot's 2 new match reports (Italy–France 2006, the derby). Steps: `features/phase-s11-lineup-extract.md` § Your part | 2 pages, ~5 min | Before S11's real run | **Done** (2026-10-27) |
| S11b | Save the profile pages of the pilot's starters, from the list S11b writes. Steps: `features/phase-s11b-player-pages.md` § Your part | 65 pages, ~25 min | After `/feature start` of S11b | **Done** (2026-10-27) |
| S12 | Nothing to save. Optionally, nicknames in `data/curation/aliases.json` after reading `data/reports/aliases.md` | — | After S12's run | — |
| S15 | First, backend request R1 (`backend-requests.md`) is built in `lineup-backend` | — | Before S15 | Pending |
| S19 | Try the dashboard on the pilot: the views, and each button | — | During S19 | Pending |
| S20 | Approve the pilot's load into `ingest`; play the 3 matches in the app | — | During S20 | Pending |
| S18 | Save a crest per club and a photo per player, from the list S18 writes. Check each image's licence before release | One per club and player | During S18 | Pending |

**In all, for the pilot:** about 70 pages, under half an hour.

**After S20: your enrichment.** The rest of the pool is yours to save in your own time, by `enrichment-guide.md`: about 100 matches next, then the rest. The whole pool is about 2,000 match reports and 5,000–8,000 player pages (`match-pool-scope.md`); the dashboard (S19) shows what's left.

**Always yours, in every phase:** approving commits and loads, and the decisions a spec asks for at `/feature load`.
