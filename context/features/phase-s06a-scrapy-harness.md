# Phase S06a — Scrapy Harness

## Status

Not Started

## Goals

- **Scrapy dependency**: `scrapy` in the project dependencies (`uv add scrapy`); `uv.lock` committed. No `scrapy-playwright`: Transfermarkt needs no JavaScript (probes T1–T9 in `context/fixes/2026-10-26-transfermarkt-context.md` all returned full HTML)
- **`scrapy.cfg`** at the repo root, pointing at `extract.settings`, so `uv run scrapy crawl <spider> -a <arg>=<value>` runs from the root (CLAUDE.md § Commands)
- **`extract/settings.py`**, with these values (plan P1 #5–#7):

  | Setting | Value | Why |
  | --- | --- | --- |
  | `BOT_NAME`, `SPIDER_MODULES` | `lineup_scraper`, `["extract.spiders"]` | |
  | `ROBOTSTXT_OBEY` | `False` | `coding-standards-scraper.md` § Sources |
  | `USER_AGENT` | `lineup-scraper/0.1 (personal, non-commercial; development)` | An honest UA, never a browser string (§ Decisions) |
  | `DEFAULT_REQUEST_HEADERS` | `Accept: text/html,…`, `Accept-Language: en-US,en;q=0.9` | Labels and formats are English-dependent (`transfermarkt-source.md` § 7) |
  | `CONCURRENT_REQUESTS`, `CONCURRENT_REQUESTS_PER_DOMAIN` | `1`, `1` | One request at a time per domain |
  | `DOWNLOAD_DELAY` | `3` (seconds) | A floor under AutoThrottle |
  | `AUTOTHROTTLE_ENABLED`, `_START_DELAY`, `_MAX_DELAY`, `_TARGET_CONCURRENCY` | `True`, `3`, `60`, `1.0` | |
  | `RETRY_ENABLED`, `RETRY_TIMES`, `RETRY_HTTP_CODES` | `True`, `3`, `[408, 429, 500, 502, 503, 504, 522, 524]` | |
  | `HTTPCACHE_ENABLED`, `HTTPCACHE_DIR`, `HTTPCACHE_POLICY`, `HTTPCACHE_EXPIRATION_SECS` | `True`, `DATA_DIRS["cache"]` (absolute), `scrapy.extensions.httpcache.DummyPolicy`, `0` | Each page is fetched once, forever |
  | `HTTPCACHE_IGNORE_HTTP_CODES` | `[403, 408, 429, 500, 502, 503, 504, 522, 524]` | Errors and blocks are never cached |
  | `FEED_EXPORT_ENCODING` | `utf-8` | |
  | `ITEM_PIPELINES` | `{"extract.pipelines.RecordPipeline": 300}` | |
  | `DOWNLOADER_MIDDLEWARES` | `{"extract.middlewares.BlockGuard": 590}` | |

- **`extract/middlewares.py` — `BlockGuard`**: a downloader middleware that treats a technical block as a stop, never a puzzle (`coding-standards-scraper.md` § Sources; plan P1 #6, #7):
  - A **`429`**: if a `Retry-After` header is present, pause for that many seconds (capped at 300); otherwise let the retry middleware back off. After **3 consecutive** 429s, close the spider with reason `blocked_429`
  - A **`403`**, or any body containing a challenge marker (`Just a moment...`, `cf-chl`, `captcha`, case-insensitive): close the spider at once with reason `blocked`. No retry, no cache, no workaround
  - Each close logs the URL and status, never the page body
- **`extract/pipelines.py` — `RecordPipeline`**: items are `{"kind": "<source>-<kind>", "partition": "<name>", "record": {...}}`. One `RecordWriter` (`extract/records.py`) per `(kind, partition)`. **An invalid record fails the run** (`coding-standards-scraper.md` § Python): the pipeline closes the spider with reason `invalid_record`, and the error names the path and keyword, never a value. The crawl then exits non-zero
- **`fetchedAt`**: a helper `fetched_at(response) -> str` in `extract/http.py`, which returns the response's `Date` header as UTC ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`). The cache stores headers, so a rerun from cache gives the same value (`coding-standards-scraper.md` § Data rules: timestamps come from the source). A response without `Date` raises
- **`extract/spiders/transfermarkt_capture.py`**: spider `transfermarkt_capture`, the only spider in this phase. It takes `-a pages=<name>=<path>,<name>=<path>,…` (paths relative to `https://www.transfermarkt.com`) and writes each response body, unchanged, to `extract/tests/fixtures/transfermarkt/<name>.html`. It yields no records. This is how parser fixtures are saved from the spider's response (`coding-standards-scraper.md` § Sources)
- **First capture**: run it once, **after asking**, for these pages. Request one at a time, through the cache:

  | Name | Path | Why |
  | --- | --- | --- |
  | `fixtures-it1-2000` | `/serie-a/gesamtspielplan/wettbewerb/IT1?saison_id=2000` | League list, 2000–01 layout |
  | `fixtures-cl-2000` | `/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2000` | Cup list with two group stages |
  | `fixtures-cl-2023` | `/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2023` | Cup list, current layout |
  | `fixtures-wm06` | `/weltmeisterschaft-2006/gesamtspielplan/pokalwettbewerb/WM06` | Tournament list. **Unverified** URL, from old `transfermarkt/world_cup/download_links.py:61` |
  | `match-990248` | `/spielbericht/index/spielbericht/990248` | 2001 UCL final: shootout, `4-4-2 Diamond` |
  | `match-1153409` | `/juventus-fc_as-bari/index/spielbericht/1153409` | 2000–01 league: `+2` goal, table positions |
  | `match-4126774` | `/kayserispor_galatasaray/index/spielbericht/4126774` | 2023 layout, goalless |
  | `player-411295` | `/raphinha/profil/spieler/411295` | Current player page |

  Eight requests. A second run must make **0** network requests (all from cache).
- **Tests** (`extract/tests/`, no network):
  - `test_settings.py`: asserts every value in the settings table
  - `test_middlewares.py`: fake responses for 200, 429 with and without `Retry-After`, three 429s in a row, 403, and a 200 with `Just a moment...`
  - `test_pipelines.py`: valid items are written under a temporary raw dir; an invalid one closes the spider with `invalid_record` and writes nothing
  - `test_http.py`: `fetched_at` with a `Date` header, and without one

## Decisions

1. **`USER_AGENT = "lineup-scraper/0.1 (personal, non-commercial; development)"`**. No contact, never a browser string, never the user's email
2. **The WM06 tournament page is in the first capture.** If its URL fails, record that and don't guess another

## Out of Scope

- The parsers and the record-yielding spiders: **S06b** (`phase-s06b-transfermarkt-parsers.md`)
- Which competitions and seasons to crawl, and the curated-club filter: **S07**
- The shortlist-driven match crawl: **S11**
- Any crawl beyond the eight capture pages

## Notes

- Scope: the polite, cached, fail-closed fetching machinery, plus the saved fixtures S06b parses. No record is written to `data/raw/` in this phase.
- Depends on: S05 (`extract/records.py`), the Transfermarkt fixes (`context/docs/transfermarkt-source.md`, `context/fixes/2026-10-26-transfermarkt-plan.md` P1 and P3). The shared spec allows Transfermarkt (`project-overview.md` § Sources; backend `95d7fce`).
- Constraints:
  - **Ask before the capture crawl**, every time
  - Never bypass a block: a 403 or challenge stops the spider, with no retry, proxy or header change
  - Nothing from the old repo is run or imported. Only its headers idea (ref § 2) carries over, minus the browser UA
  - Python: `mypy --strict`, no `Any`, absolute imports, UTF-8 for every file open (plan P1 #9)
  - Comments are rare, one line, at most 50 characters
  - Logs print URLs, statuses and counts, never page bodies
  - If Scrapy's types don't satisfy `mypy --strict`, add a narrow `[[tool.mypy.overrides]]` for the untyped modules only, and record it as a deviation
- Verification:
  - `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy extract`. `npm test` and the TS checks stay green
  - The capture run writes 8 files under `extract/tests/fixtures/transfermarkt/`; a second run logs 0 downloads (Scrapy stats `downloader/request_count` from cache only)
  - `data/cache/` stays gitignored; the fixtures are committed

**Deviations recorded during implementation**

- **The first capture was blocked by an AWS WAF challenge (2026-10-26, 17:43 UTC).** All 8 requests returned `202` with `X-Amzn-Waf-Action: challenge` (CloudFront) and a 2,434-byte page loading `token.awswaf.com/.../challenge.js`, with the honest UA `lineup-scraper/0.1 (personal, non-commercial; development)`. The step-4 probes weren't challenged because they sent a desktop Chrome UA. Under `coding-standards-scraper.md` § Sources a block stops the source, so nothing was retried, and switching to a browser UA is out: it would evade the bot check. The capture goal is **not met**; no fixture exists
- `BlockGuard` missed it (it checked 403 and Cloudflare markers only), and the cache stored the challenge pages, because `HttpCacheMiddleware` stores responses before `BlockGuard` sees them. Fixed: `is_block()` also treats status `202`, an `X-Amzn-Waf-Action` header and the `awswaf` / `challenge.js` markers as blocks; `extract/cache.py` (`GuardedCachePolicy`, a `DummyPolicy` that never stores a block) replaces `DummyPolicy`; `202` joins `HTTPCACHE_IGNORE_HTTP_CODES`. The 8 challenge pages were deleted from the fixtures folder and `data/cache/`
- Added `extract/crawl.py`: `uv run python -m extract.crawl <spider> -a key=value` exits 1 unless the finish reason is `finished`, because `scrapy crawl` exits 0 even after a `blocked` or `invalid_record` close. This is the crawl command form S06 fixes; CLAUDE.md § Commands now names it
- Added `extract/closing.py` (closing and pausing the spider, injected into `BlockGuard` and `RecordPipeline` so the tests need no crawler)
- Review: `extract/spiders/transfermarkt_capture.py` was **replaced** by `extract/spiders/capture.py` (`-a source=<folder> -a pages='name=https://… …'`, space-separated), because no code may fetch Transfermarkt. `BlockGuard.process_request` now refuses any `transfermarkt.com` request (reason `forbidden_source`), and `capture` refuses such URLs up front
- Review: the challenge-marker scan only runs on HTML bodies of 20,000 bytes or less (`is_challenge_html`), so a real page or API answer that mentions "captcha" isn't taken for a block. S06b's inbox reuses `is_challenge_html` on saved pages
- 2026-10-26, user decision: **S06a completes harness-only.** The 8-page capture moved to `phase-s06b-transfermarkt-parsers.md` § Your part, as pages the user saves by hand. The harness stays for automated sources (Wikipedia and Wikidata in S09) and for an approved honest-UA retry. **👤 Your part in S06a: none.**

## History
