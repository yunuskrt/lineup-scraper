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
| S06c | Nothing to save. Try the link list, progress and check tools on the pages already saved | — | During S06c | Pending |
| S07 | Save one head-to-head sample (Fenerbahçe–Galatasaray), then the listing pages on S07's list: fixture lists for the Champions League, Europa League, World Cups and Euros, plus head-to-head pages or league fixture lists for the league pairs (`link-map.md` § 2) | ~94 pages with head-to-heads, ~247 without | During S07 | Pending |
| S08 | Nothing to save | — | — | — |
| S11 | Save one match report per pool match, from the list S11 writes (`match-pool-scope.md` § 1) | ~2,000, in batches of ~300 | During S11 | Pending |
| S11b | Save the profile page of every starter in the saved match reports, from the list S11b writes after each batch. Match reports show only short names (`link-map.md` § 4) | ~5,000–8,000; each player once | During S11b, in batches | Pending |
| S09 | Nothing to save: Wikipedia and Wikidata are fetched by the harness. You approve each crawl | — | During S09 | Pending |
| S15 | First, backend request R1 (`backend-requests.md`) is built in `lineup-backend`. Then approve each database load. `production` needs your explicit instruction | — | Before and during S15 | Pending |

**In all:** about 7,100–10,250 pages. At 15–20 seconds a page that is 30–55 hours, most of it the player pages. The progress tool (S06c) shows where you are at any time.

**Always yours, in every phase:** approving commits, approving every automated crawl, and the decisions a spec asks for at `/feature load`.
