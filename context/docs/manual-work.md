# Manual Work

Everything in this project that needs **you**, not code. The `todo.md` line of a phase with manual work ends in a 👤 note, and its spec has a `## Your part` section with the exact steps. This file is the overview; keep it in step with them.

**Why there's manual work at all:** Transfermarkt answers automated requests with an AWS WAF challenge (`202`, `X-Amzn-Waf-Action: challenge`, first seen 2026-10-26). This repo never gets around a block, by a fake browser User-Agent or by driving a browser with code or the Playwright MCP. So Transfermarkt pages enter the project only one way: **you open them in your own browser and save them**. Code does everything after that.

## How to save a page

1. Open the link in your normal browser and wait until the page has loaded.
2. Save it as **HTML only**, not as a web archive or a "complete" page:
   - **Chrome or Edge:** ⌘S (Ctrl+S) → Format **Webpage, HTML Only**
   - **Safari:** File → Save As → Format **Page Source**
   - **Firefox:** ⌘S (Ctrl+S) → **Web Page, HTML only**
3. Save it into **`data/inbox/`** in this repo. Any file name is fine: the importer reads the page's own URL (`og:url`) from inside the file.
4. When a batch is saved, run `uv run python -m extract.inbox` (built in S06b). It parses every page, files it under `data/pages/`, and lists anything it couldn't use, such as a challenge page saved by mistake, so you can save that one again.

Go at a normal browsing pace. If the site shows you a check, solve it as you normally would; that's you, not code.

## Checklist

| Phase | What you do | Size | When | Status |
| --- | --- | --- | --- | --- |
| S06a | Nothing | — | — | — |
| S06b | Save the 8 parser-fixture pages listed in `features/phase-s06b-transfermarkt-parsers.md` § Your part | 8 pages, ~5 min | After `/feature start` of S06b | **Done** (2026-10-27) |
| S07 | Save the fixture-list pages S07 generates as a list: one page per competition-season | ~250 pages (7 leagues × 26 seasons, plus UCL, UEL, World Cups and Euros) | During S07; the list may come in batches | Pending |
| S08 | Possibly save player pages, only for players whose names clash. S08 decides whether any are needed | Unknown, likely small | During S08 | Pending |
| S09 | Nothing to save: Wikipedia and Wikidata are fetched by the harness. You approve each crawl | — | During S09 | Pending |
| S11 | Save the match-report pages for the shortlist, from a list S11 generates | First batch ~300; at most ~3,600 over time (`match-pool-scope.md` § 3) | During S11, in batches | Pending |
| S15 | Approve each database load. `production` needs your explicit instruction | — | During S15 | Pending |

**Always yours, in every phase:** approving commits, approving every automated crawl, and the decisions a spec asks for at `/feature load`.
