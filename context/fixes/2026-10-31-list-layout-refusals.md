# Fix — List-Layout Match Reports & Refused Files

## Status

Complete

## Goals

Some Transfermarkt match reports show the lineups as a list by position group (Goalkeeper; Defenders; Midfielders; Forwards), with no pitch graphic and no formation. The parser reads only the pitch layout, so it refuses them with "No home starters", and the refused file stays in `data/inbox/`, refused again on every import. Found 2026-10-31 on `match-1042014.html` (Liverpool – Manchester City, 2000-09-09) and `match-923131.html` (Manchester City – Chelsea, 2008-09-13), both Premier League.

Decided with you on 2026-10-31: **leave list-layout matches out of the pool** (no approximated formations in the game), and **move refused files out of the way** so they stop repeating.

- **Recognise the list layout** (`extract/parsers/transfermarkt/match.py`):
  - a report whose lineup box (`div.aufstellung-box`) holds the position-group table and no `div.formation-player-container` raises a distinct `ListLayoutError`, reason `list layout: no formation`, instead of "No home starters"
  - any other missing-starters page keeps today's error, so a broken save still reads as one
  - tested on the 2 saved pages, kept as parser fixtures in `extract/tests/fixtures/` (your saves, as `coding-standards-scraper.md` § Sources allows for Transfermarkt)
- **Leave them out of the pool** (D1): a match whose report was refused as `list layout` leaves `data/work/pool/matches.json`, and so `general.csv`, every per-type CSV and the dashboard's denominators. `data/reports/pool.md` lists each one, with its id, under "Left out: list layout"
- **Move refused files to `data/inbox/refused/`** (`extract/inbox.py`):
  - each refused file moves there after its log line is written; the next import doesn't read it, so its message isn't repeated
  - `uv run python -m extract.inbox --retry` moves every file in `refused/` back and imports it again (after a parser fix)
  - the import summary ends with one line: `refused earlier, waiting in data/inbox/refused/: N (--retry tries them again)`
  - a file you save again under the same name replaces the copy in `refused/`
- **Status and the dashboard follow the move:**
  - `extract.tracker`: a row whose file sits in `refused/` shows `error: <reason>` (today it shows `saved` while the file is in the inbox). A list-layout match has no row, since it leaves the pool
  - the dashboard's Failures tab lists the files in `refused/` with their reason and what to do (`src/dashboard/read.ts`, `failures.ts`); files at the top of `data/inbox/` stay "waiting"
- **Today's 2 files:** after the fix, one `uv run python -m extract.inbox` and `npm run status`: both move to `refused/`, both matches leave the pool (2,002 → 2,000), and the import prints the summary line only
- **Docs:**
  - `transfermarkt-source.md`: the list layout exists (the "pitch coordinates for every starter, back to 2000–01" claim gets its exception), and what the pipeline does with it
  - `match-pool-scope.md` § 4 "Out": list-layout matches
  - `collection-runbook.md` § Errors and `enrichment-guide.md` § 6: the `list layout` reason, the `refused/` folder and `--retry`
  - `CLAUDE.md` § Commands: `--retry`
  - `manual-work.md`: a row for this fix

## Your part

1. **At `/feature load`:** settle D1–D2 below (done, 2026-10-31)
2. **Approve the commit** at `/feature complete`

Nothing to save: the 2 pages are already in `data/inbox/`.

## Decisions

Settled at `/feature load`, 2026-10-31: both as proposed.

- **D1. How list-layout matches leave the pool.**
  - **Automatically (approved).** `npm run pool` reads the import log and leaves out every match whose latest refusal is `list layout`. Nothing to edit by hand, and it reverses itself if the parser ever learns the layout (`--retry`, then `npm run pool`)
  - Alternative: by hand. The importer prints the ids, and each goes into `data/curation/excluded-matches.json` with a note (`list layout, no formation`), as the curation rule says for manual decisions. Every new one needs an edit
- **D2. `data/inbox/refused/` stays local** (approved), like `data/inbox/` (gitignored). The import log keeps the history.
  - Alternative: commit it, so the refused pages are kept with the repo

## Notes

- Scope: the parser's distinct error, the pool rule, the `refused/` folder and `--retry`, the tracker and dashboard changes, the docs. Not in scope: parsing the list layout into lineups (not chosen, 2026-10-31: its formation would be an approximation from players' usual positions); refusals of other kinds beyond moving them
- How common it is: unknown. 2 of the 7 match reports saved so far, both Premier League. `data/reports/pool.md`'s count shows it as you save; if it turns out large for an era, revisit the decision (`match-pool-scope.md` § 3 floors)
- Depends on: S06b (parsers, `extract.inbox`), S07b (`npm run pool`), the Collection Tracker, S19 (dashboard)
- Constraints:
  - Never fetch Transfermarkt with code; fixtures are the pages you saved
  - Python reads and moves files and writes the log; TypeScript (`npm run pool`) reads the log. Neither writes to Postgres or the bucket
  - A curation file is never written by code (D1's automatic way reads the log, not `excluded-matches.json`)
  - Errors and logs name files, ids and reasons, never a lineup
  - Comments at most 50 characters
- Verification:
  - `uv run pytest`: the 2 fixtures raise `ListLayoutError`; a pitch-layout fixture still parses; a page missing both layouts keeps today's error; a refused file moves to `refused/` and isn't read again; `--retry` brings it back; a re-saved file replaces the old copy; the summary line
  - `npm test`: the pool leaves out list-layout matches and reports them; the dashboard lists `refused/` files
  - `npm run lint`, `npm run typecheck`, `uv run ruff check`, `uv run mypy extract`
  - on the real data: the 2 files move, the pool has 2,000 matches, `general.csv` has no rows for them, a second import prints only the summary line

**Deviations recorded during implementation**

- **A file imported at last drops its refused copy** (not in the goals): when a re-saved page or image imports, the importer deletes the copy of the same name in `refused/`, so a fixed challenge page doesn't stay counted as "refused earlier". The count is taken after the run
- **How the list layout is recognised:** the lineup box has no `div.formation-player-container` but a table cell `<b>Goalkeeper</b>`; any other missing-starters page keeps "No home starters (div.formation-player-container)"
- **The reason string is shared across languages:** `LIST_LAYOUT_REASON` in `extract/parsers/transfermarkt/match.py` and `src/pool/list-layout.ts`, `list layout: no formation`. The pool rule takes each match's latest import line, ignoring `duplicate` lines
- **`npm run pool` prints `list layout: N`**, and `pool.md`'s header counts them, beside conflicts and exclusions
- **Advice now points to `--retry`:** a parse error's "what to do" (dashboard Failures, runbook, guide) is "ask for a fix, then `--retry`", since refused files now wait in `refused/`; a list-layout refusal's is "Nothing: the match leaves the pool"
- **Real data, 2026-10-31:**
  - the first import refused both pages as `list layout: no formation` and moved them to `data/inbox/refused/` (exit 1)
  - `npm run status`: pool 2,000 matches (`list layout: 2`), no rows for `1042014` or `923131` in `general.csv` (3,350 rows: 2,000 match reports, 57 parsed by now; 953 players; 159 images), `pool.md` lists both
  - a second import printed only `refused earlier, waiting in data/inbox/refused/: 2 (--retry tries them again)` (exit 0)
- 329 Python tests (8 new) and 763 TypeScript tests (5 new) pass; ruff, mypy, typecheck, lint and format clean
- **Review fixes:** `--retry` no longer overwrites a newer save: if `data/inbox/` already holds a file of the same name, the refused copy is dropped and the newer one imports (tested). A test now proves the snapshot skips `refused/`, so such a row reads `error: <reason>`. 331 Python tests pass
- **`/feature test`:** `read.spec.ts` now checks that the dashboard lists `data/inbox/refused/` apart from the inbox. Covered in all: the parser (both fixtures, a page with neither layout), the importer (set aside, not read again, the summary line, `--retry`, a newer save winning on `--retry`, a refused copy replaced or dropped, images too), the snapshot skipping `refused/`, the pool rule (latest line wins, duplicates ignored, the report), the dashboard (refused files, list-layout advice). 331 Python tests (10 new) and 763 TypeScript tests (5 new) pass. Not unit tested, on purpose: `readListLayout` in `src/pool/main.ts` (a file read; `listLayoutIds` is tested), proved on the real data

## History
