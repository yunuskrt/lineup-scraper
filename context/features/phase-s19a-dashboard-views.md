# Phase S19a — Dashboard Server & Views

## Status

Complete

## Goals

A local, read-only dashboard: `npm run dashboard` serves one page on your machine. The page shows how far the pool has got, where each group and club stands against its floor, every link, every import, every failure and the size of `ingest`. S19b adds the buttons.

- **`npm run dashboard`** (`src/dashboard/main.ts`):
  - a `node:http` server bound to `127.0.0.1` only, with no framework and no new dependency
  - prints its URL and opens it in your default browser (`open` on macOS)
  - serves the page from `src/dashboard/public/` and JSON views under `/api/`
  - refuses any request whose `Host` header isn't its own `127.0.0.1:<port>` (guards against DNS rebinding)
- **Readers** (`src/dashboard/read.ts`). Each file is parsed with Zod; a missing file empties its view and names the command that writes it:
  - `data/inbox-lists/general.csv`, the only CSV needed: it holds every row of the 4 per-type files, with `Type`
  - `data/work/pool/matches.json` (groups, competition, season, date, clubs)
  - `data/curation/pool.json` (competitions, curated clubs), through `readPoolConfig`
  - `data/work/import-log.ndjson`
  - `data/work/status/remote.json` (its notes, such as "database not checked")
- **`src/dashboard/csv.ts`:** a small RFC 4180 reader that handles quoted fields, commas and quotes inside them, and a trailing newline. The tracker writes with Python's `csv` module, so an `error:` reason may be quoted
- **Match blocks** (`src/dashboard/blocks.ts`):
  - walks `general.csv` in order, and each Crest, Player and PlayerPhoto row belongs to the Match Report row above it (approved: "by their match block")
  - joins each block to its pool match by Transfermarkt id: groups, competition, season label (`seasonLabel`), era (`eraBucket`), home and away club
  - Fixture rows carry their own competition and season, from the link
- **Progress** (`src/dashboard/progress.ts`, pure):
  - for each Type, the count and share at each step of its ladder, cumulative, so `parsed` includes `validated` and `ingested`:
    - Fixture: saved, parsed
    - Match Report, Player: saved, parsed, validated, ingested
    - Crest, PlayerPhoto: saved, uploaded, ingested
  - the denominator is every known link of that Type (`23/1,000`, 2.3%), and it grows as each level reveals more
  - `error` rows are counted on their own
  - the totals for the whole pool, then the same counts broken down by group, competition, season, era and club. A match counts once in a group, competition, season or era view, and under both of its clubs in the club view
- **Coverage** (`src/dashboard/coverage.ts`, pure). The floors from `match-pool-scope.md` § 3, absorbing S16:

  | Cell | Floor |
  | --- | --- |
  | A curated club, per era bucket | ≥ 20 |
  | A league, per season | ≥ 10 |
  | A Champions League season | ≥ 7 |
  | A World Cup or Euro | ≥ 7 |

  - each cell shows ingested matches, the floor, and the pool matches in that cell
  - a cell below its floor is flagged
  - a cell whose pool is smaller than its floor is marked "can't reach": a gap in the groups, not in your saving
- **Links** (`/api/links`), approved extra: `general.csv` as a table:
  - filter by Type, Status (or any `error`), group, competition and season, plus a text search on the id and the file name
  - 100 rows a page, so 8,000+ rows stay fast
  - each link is a plain `<a target="_blank" rel="noopener">`, so it opens in your own browser. The server never requests it
- **History** (`src/dashboard/history.ts`, pure): the import log, newest first, with time, file, kind, key, result and reason. You can filter it by kind, result and date, and see a per-day count
- **Failures** (`src/dashboard/failures.ts`, pure). Each failure has a reason and a "what to do" taken from `collection-runbook.md` § Errors:
  - rows with an `error:` status (challenge page, parse error, gate rule)
  - import refusals: the latest log entry per file whose result isn't `imported`
  - rows stuck at `saved` while their file is still in `data/inbox/`: run Import
  - notes from `remote.json`, such as the database or the bucket not checked
- **Sizes** (`src/dashboard/sizes.ts` for the pure part, plus a reader), approved extra:
  - rows per content table (the 11 tables of `data-contract.md` § 2)
  - `pg_database_size` of `LOAD_TARGET`
  - bucket objects and MB, split into `crests/` and `players/`
  - each measured against the Neon Free plan's limits, kept as constants with their source and date. Postgres is 1 GB per project (Neon plans page, checked 2026-10-30); the bucket shows its size only, unless Neon states a Free limit by implementation time
  - `SELECT`s and a bucket listing only, never `production`, read on demand (a Refresh button) and cached in memory
- **The check-in warning:** a banner over every view whenever there is something to look at, with the count and the command:
  - rows at `error`
  - files waiting in `data/inbox/`
  - validated matches or players not yet ingested (a load is due)
  - images saved but not uploaded
  - `general.csv` older than the newest import-log entry or `data/dataset/manifest.json` (run `npm run status`)
- **The page** (`src/dashboard/public/index.html`, `app.js`, `style.css`):
  - plain HTML, CSS and JavaScript, with no build step and no UI library
  - progress bars are CSS
  - tabs: Progress · Coverage · Links · History · Failures · Sizes
  - light and dark themes via `prefers-color-scheme`
  - readable at laptop width
- **Docs:**
  - `enrichment-guide.md` § 7 rewritten as built: views, sources, the warning
  - `collection-runbook.md`: a line about the dashboard
  - `CLAUDE.md` § Commands: `npm run dashboard`
  - `manual-work.md`: the S19 row

## Your part

1. **After `/feature start`, once Claude says the page is up** (~10 min):
   - run `npm run dashboard` and open each tab
   - check that Progress's totals equal the counts `npm run status` prints (238 Fixture parsed, 2,002 Match Report rows, and so on)
   - find one row in Links by its id
   - check that History shows your 241 listing imports
2. **Optional:** save 2–3 more pages from `general.csv`, run `uv run python -m extract.inbox` and `npm run status`, then reload the page. The numbers must move
3. **Approve the commit** at `/feature complete`

Nothing to save from Transfermarkt for this spec.

## Decisions

Settled at `/feature load`, 2026-10-30: all three as proposed.

- **D1. A fixed port, `4319`** (approved). It fails with a clear message if the port is taken; `--port N` overrides it.
  - Alternative: any free port, printed on start
- **D2. Club views show the curated clubs only** (approved) (`pool.json` `clubs`), the ones with floors. Every other club appears only inside its match's group.
  - Alternative: every club that appears in a pool match
- **D3. Sizes are read on demand** (approved), when the Sizes tab opens and on Refresh, so the page doesn't wake the Neon compute on every load.
  - Alternative: read on every page load

## Notes

- Scope: the server, the readers, the pure view functions and the page, all read only. Not in scope: any button that runs a command (S19b); writing to any file, table or bucket; changing the CSVs or the tracker
- Depends on: the Collection Tracker (`general.csv`, `remote.json`, `npm run status`), S06c (import log), S07 (pool), S15 and S17 (Prisma client, storage client), S20
- Reuses, never duplicates:
  - `readPoolConfig` (`src/pool/config.ts`)
  - `seasonLabel` (`src/resolve/seasons.ts`)
  - `ERA_BUCKETS` and `eraBucket` (`src/score/pool-rules.ts`)
  - `createPrismaClient`, `loadEnv`
  - the storage client's listing (`src/storage/client.ts`)
- Constraints:
  - **Never fetch Transfermarkt with code:** links open in your browser by your click, and the server makes no outbound request except Postgres and the bucket
  - Read only: no write to any table, no upload, no delete; `production` is never read
  - Bound to `127.0.0.1`; no data leaves your machine
  - The page shows ids, file names, statuses, counts and rule names, never an XI or an alias list (`coding-standards-scraper.md` § Logs)
  - Every file read is Zod-parsed; types from `z.infer`; `@/` imports; comments at most 50 characters
  - The browser code is plain JS, as you asked: no framework, no bundler, no CDN library. It renders what the server computes; the counting lives in the tested TypeScript
- Sizes, for scale: today `general.csv` has 2,423 rows; the whole pool reaches ~16,000 (238 + ~2,000 + 5,000–8,000 + ~5,300–8,300)
- Verification:
  - `npm test`: the CSV reader (quotes, commas, empty file), blocks (rows under the right match, the pilot block, Fixture rows), progress (ladders cumulative, errors apart, breakdowns, a match counted under both clubs), coverage (below floor, can't reach), history filters, failures (each source, latest entry per file), sizes (share of the limit), the warning conditions, the `Host` check
  - `npm run lint`, `npm run typecheck`, `npm run format:check`
  - on the real data: totals equal `npm run status`, then Your part 1

**Deviations recorded during implementation**

- **`Host` check:** `localhost:<port>` is allowed beside `127.0.0.1:<port>`. Both are loopback names; DNS rebinding needs a foreign name, which is still refused (`403`). Any method but `GET` gets `405`: S19a is read only
- **Duplicates aren't failures:** the importer deletes a duplicate and keeps the stored copy, so there's nothing to fix. History lists them; `enrichment-guide.md` § 7 says so
- **An import refusal is a failure only while its file is still in `data/inbox/`.** Otherwise your deleted `fixture-euro-2019.html` (2026-10-30) would show forever. A leftover file whose page was imported later under another name shows as waiting in the inbox
- **"Images saved but not uploaded" counts only images under a validated or ingested match.** `npm run images` processes the dataset's clubs and players only, so any other saved image would keep the warning on for good
- **Bucket sizes:** `ObjectStore` gained `measure(prefix)` (objects and bytes, from the listing), in `src/storage/client.ts` and the memory store
- **No Free limit for Object Storage** in Neon's docs on 2026-10-30, so the bucket shows its size only. Postgres is measured against 1 GB (`pg_database_size`; the page notes that Neon's billed storage can differ)
- **Inbox files** are the suffixes `extract.inbox` picks up (`.html`, `.htm`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`)
- **Coverage cells** come from `pool.json`'s season ranges, keyed by season label, so Euro 2020 (`saison_id` 2020) lands in its cell. Playable means its Match Report row is `ingested`
- **Real data, 2026-10-30:**
  - Progress: Fixture 238/238 parsed; Match Report 5 saved, 3 ingested of 2,002; Player 66 saved, 65 ingested of 107; Crest 8 saved, 6 ingested of 10; PlayerPhoto 66 saved, 65 ingested of 66. These equal `npm run status`
  - Coverage: 287 cells, 129 below the floor and reachable, 158 can't reach
  - Failures: none
  - Sizes (`ingest`): 9.71 MB, 1.0% of 1 GB; the bucket has 71 objects, 0.26 MB
  - every tab was checked in a browser, light theme
- 715 TypeScript tests (67 new) and 321 Python tests pass; typecheck, lint, format clean
- **Your part 1, 2026-10-30:** done; you checked the tabs on the real data
- **Review fixes:** an invalid `matches.json` or `remote.json` is reported by its path, never through the `SyntaxError` that quotes the file; warnings read "label: count" ("Rows at error: 1"); two comments cut to 50 characters
- **`/feature test`:** `readSnapshot` takes its file paths (default: the real ones), so `read.spec.ts` covers the missing-file messages, invalid files reported by path (never by their text), a full read and the inbox suffix filter. 724 TypeScript tests (76 new in this feature) and 321 Python tests pass; typecheck, lint, format clean. Not unit tested, on purpose: `sizes-read.ts` and `ObjectStore.measure` against the real bucket (database and bucket reads, proved on `ingest`), `main.ts`, and the page's `app.js` (no component tests, `coding-standards.md` § Testing)

## History
