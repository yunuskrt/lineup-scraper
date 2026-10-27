# Phase S06c — Collection Tools

## Status

Complete

## Goals

- **`extract/pages.py`**: `Page`, `classify`, `RefusedPageError` and the page-store path move here from `extract/inbox.py`, so the importer, link lists, progress and check share one rule for "which page is this, and where is it stored". `extract.inbox` behaves exactly as before
- **Link lists** in `extract/links.py`:
  - A list is `data/work/link-lists/<name>.json`, the full set, written by the phase that finds the links (S07, S11, S11b). Each entry has `url`, `kind`, `key`, `saveAs`, plus optional `group`, `competition` and `season` for the progress breakdown. `kind` and `key` come from `classify(url)`, never from the caller
  - `saveAs` is `<kind>-<key>.html` (`match-53491.html`, `fixture-tr1-2005.html`, `player-411295.html`), and the folder is always `data/inbox/`
  - `write_link_list(name, entries)`: each page appears once (by kind and key), the caller's order is kept, and the output is deterministic (2-space JSON, stable key order, trailing newline). A rerun with the same entries is byte-identical
  - `uv run python -m extract.links show <name>` writes `data/work/inbox-lists/<name>.md` for the user: a header with `saved/total` and a table of **only what's still to save** (link, save-as name, folder), with pages already in `data/inbox/` but not yet imported marked "in inbox, run the import"
  - `uv run python -m extract.links new <name> <url>...` makes a list by hand, for trying the tools and for hand-picked pages later
  - `uv run python -m extract.links open <name> [--count N]` (default 5) opens the next N unsaved links of a list **in the user's default browser** (`webbrowser.open`) and prints their save-as names. It never requests a page itself
- **Import log**: `extract.inbox` appends one line per inbox file it handles to `data/work/import-log.ndjson`: `at` (the run's start, UTC), `file`, `url` (or `null`), `kind`, `key`, `result` (`imported`, `duplicate`, `refused`), `reason` (refused only, the same text the report prints), `records` (the count written). Never page text or a name. This is the dashboard's history (S19)
- **Log backfill**: `uv run python -m extract.inbox --backfill-log` adds one `imported` line, with `backfilled: true` and `at` = the stored file's time, for each page in `data/pages/` that has no log line. A second run adds nothing
- **Progress**: `uv run python -m extract.progress [<name>...] [--by group|competition|season] [--json]`. For each list (all lists if none are named):
  - `total`, `inInbox` (saved, not imported), `imported` (in `data/pages/`), `parsed` (its records are in `data/raw/`) and `missing`, each a count and a percentage: `imported 23/1000 (2.3%)`
  - `--by` splits the counts by that entry field; entries without it go under `(none)`
  - `--json` prints the same as JSON, for the S19 dashboard
  - An imported page with no records in `data/raw/` is listed as "imported but not parsed" (e.g. after `data/raw/` was cleared)
- **Check**: `uv run python -m extract.check <link | kind:key>` (`match:990248`, `player:411295`, `fixture:cl-2000`). Prints:
  - which lists hold the page
  - whether it's in the inbox (the file name)
  - whether it's in the page store (the path)
  - its raw records (the partition and count)
  - its import log lines (when and with what result)
  - Exit 0 if it's imported and parsed, 1 otherwise
- **Tests** (offline, temporary folders; the 8 committed fixture pages as inbox input):
  - `test_links.py`: entries are deduplicated, `saveAs` and `kind` come from the URL, a rerun is byte-identical, an unrecognised link is refused with its reason, `show` leaves out stored pages and marks inbox ones, `open` calls the browser only for unsaved links (patched)
  - `test_progress.py`: counts and percentages at each stage (missing, in the inbox, imported, parsed), `--by`, `--json`, imported-but-not-parsed
  - `test_check.py`: both input forms, every location reported, the exit code
  - `test_inbox.py` grows: a log line for each result, the `at` shared by one run, no page text in the log, `--backfill-log` adds only missing lines and is idempotent
- **Docs**: `link-map.md` § 8, `transfermarkt-source.md` § 8 and `enrichment-guide.md` § 2 name the real commands and the two list files (`link-lists/*.json` and `inbox-lists/*.md`)

## Your part

👤 No pages to save. About 5 minutes, after `/feature test`:

1. Run `uv run python -m extract.progress` and `uv run python -m extract.check match:990248` on the pages you've already saved, and say if the output reads clearly
2. Try `uv run python -m extract.links open s06c-sample --count 1` once: it should open one Transfermarkt tab in your own browser. Close it without saving

## Decisions

Settled at `/feature load`, 2026-10-27:

1. **Language: Python**, in `extract/`, beside the importer. The S19 dashboard reads the `--json` output and the files
2. **Backfill the log: yes.** `extract.inbox --backfill-log` adds one `imported` line per stored page with no line, `at` = the stored file's time, and `backfilled: true`
3. **`open` in the browser: yes.** `webbrowser.open` hands the next unsaved links to the default browser; code never reads a response

## Out of Scope

- **Any request to Transfermarkt by code.** `open` only passes links to your browser; it doesn't read a response
- The real lists: listing pages (S07), match reports (S11) and player pages (S11b). S06c gives them `write_link_list`
- Progress by pool group against the pool's targets and floors, failures from build, gate or load, and buttons: **S19**
- Images: S18

## Notes

- Scope: everything between "a phase knows which pages it needs" and "the user can see what's saved, imported and parsed". Python only.
- Depends on: S06b (`extract.inbox`, the page store, the raw records).
- Constraints:
  - Python never writes to Postgres or the bucket, and never fetches Transfermarkt (`transfermarkt-source.md` § 8)
  - Ids join everything: a list entry, a stored page, a raw record and a log line share `kind` and `key`, never a name
  - Output names paths, ids and counts, never page text, a player name or an XI (`coding-standards-scraper.md` § Logs and errors)
  - Deterministic list files. Timestamps come from the run's start, never mid-loop
  - `data/work/` is gitignored, so lists and the log stay local, like the pages they describe
  - `mypy --strict`, no `Any`, absolute imports; files read and written as UTF-8
- Verification:
  - `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy extract`. `npm test` and `npm run lint` stay green
  - On the real store: `extract.links new s06c-sample` with the 8 saved pages plus the pilot's Italy–France report (`https://www.transfermarkt.com/spielbericht/index/spielbericht/53491`). Progress shows `imported 8/9 (88.9%)`, `show` lists only 53491, `check match:990248` exits 0 and `check match:53491` exits 1
  - Two runs of `extract.inbox` on an empty inbox add no log lines; a run with one duplicate adds one `duplicate` line

**Deviations recorded during implementation**

- **`extract/import_log.py`** holds the log line type, reader and writer, so `extract.check` reads the log without importing the importer
- **Every log line has every key:** `reason` is `null` and `backfilled` is `false` unless set, so the dashboard reads one shape
- **`--backfill-log` runs instead of an import**, not with one. Real store: 8 lines added, a second run adds 0
- **`link()` refuses a link with whitespace in it.** In the real run, zsh passed 8 links as one argument with newlines inside, and it became one entry
- **Status is one of `missing`, `inbox`, `imported`, `parsed`**, from one `Snapshot` of the inbox, the page store and `data/raw/`, shared by `show`, `open`, progress and check
- Tests share `extract/tests/saved_pages.py` (temporary data folders filled from the fixtures) through `conftest.py`; the inbox tests use it too
- `CLAUDE.md` § Commands names the new commands
- Real store, 2026-10-27: `s06c-sample` (8 saved pages plus match 53491) shows `imported 8/9 (88.9%)`; `check match:990248` exits 0, `check match:53491` exits 1; two empty imports add no log lines
- Review: `open --count` must be 1 or more; `-1` would have opened all but the last unsaved link

## History

- 2026-10-27: link lists, import log and backfill, progress and check; 201 tests
