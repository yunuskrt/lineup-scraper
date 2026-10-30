# Collection Tracker

## Status

Complete

## Goals

The roadmap for collecting the whole pool (`match-pool-scope.md`, ~2,000 matches): 5 CSV link lists that track every link from "to save" to "ingested", one command that keeps them up to date, and a short runbook. It doesn't finalise the database: you do that in your own time with these tools. S19's dashboard then reads the same CSVs.

- **Five CSV files in `data/inbox-lists/`**, each with the columns `#,Link,Save as,Folder,Status`; `general.csv` also has `Type` after `#` (Fixture, Match Report, Player, Crest, PlayerPhoto), added at your request on 2026-10-30:

  | File | Rows | Rows appear when |
  | --- | --- | --- |
  | `listings.csv` | Every listing page of `pool.json`: 247 | Now (written from the config) |
  | `match-reports.csv` | Every pool match, once | Its listing page is saved and parsed |
  | `players.csv` | Every starter of every saved match report, once | Their match report is saved and parsed |
  | `images.csv` | Every club crest and player photo, once | The crest: its match report is saved. The photo: its player page is saved |
  | `general.csv` | All of the above, in the order you save: the 247 listing rows first, then one block per match | As the 4 files grow |

- **One row per entity, ever.** A match, a player, a club crest and a player photo each appear once in their file and once in `general.csv`, keyed on the Transfermarkt id. They're saved once, parsed once and ingested once
- **`general.csv` order** (balanced, as you asked):
  - the 247 listing rows first
  - then match blocks, round-robin across the groups and era buckets (`match-pool-scope.md` § 1, `ERA_BUCKETS`), oldest first within a cell. Wherever you stop, the saved matches spread over every group and era
  - **a match block:** the match report row, then the rows it reveals once it's parsed: the crests of its clubs, the player pages of its 22 starters and their photos. A club or player already listed under an earlier match is not listed again
  - **the file grows:** a block holds only its match report row until that report is imported. The status command then inserts its crest, player and photo rows right under it. Rows below shift down, so `#` is a position, not an id
  - the pilot's 3 matches and every page already saved keep their place and show their real status
- **Statuses**, each with an `error: <reason>` alternative (a rule name or a count, never a value):

  | Type | Ladder |
  | --- | --- |
  | Listing page | `to save` → `saved` → `parsed` |
  | Match report | `to save` → `saved` → `parsed` → `validated` → `ingested` |
  | Player page | `to save` → `saved` → `parsed` → `validated` → `ingested` |
  | Crest, photo | `to save` → `saved` → `uploaded` → `ingested` |

  - **saved:** the file is in `data/inbox/` or `data/pages/` (images: `data/images/`)
  - **parsed:** its raw record exists (`extract.inbox` parsed it)
  - **validated:** match: in `data/dataset/` (passed the gate and the dataset schema). Player: starts in a validated match and has aliases
  - **uploaded:** its WebP is in the `LOAD_TARGET` bucket
  - **ingested:** its row is in the `LOAD_TARGET` database, with its `transfermarkt_id` (images: the row holds its key)
  - **error examples:** `error: challenge page`, `error: parse failed`, `error: gate: away slot 4 has no alias`, `error: placeholder image`
- **The status command** (name settled at `/feature load`, D2): reads `general.csv` row by row, checks each link's real state against the files, the dataset, the database and the bucket, and rewrites all 5 CSVs:
  - adds the rows revealed since the last run (match rows from newly parsed listings, player and image rows from newly parsed reports and player pages)
  - sets every row's status, always recomputed from the real state and never trusted from the CSV, so a hand edit or a mistake is corrected on the next run
  - prints counts per file and status, plus every `error` row by `#`, link id and reason
  - reads only. The database and the bucket are checked only when `.env` has `LOAD_TARGET` and the storage keys; without them, rows stop at `validated` and the output says why
  - deterministic: the same state gives byte-identical CSVs
- **Gates that say "skipping"**, so a mistake is caught and named, not done twice:
  - `extract.inbox`: for each file already stored, `<file>: already saved, skipping` (today it prints only a count, "already imported: N")
  - `extract.inbox --reparse`: re-reads only what changed since the last parse, and prints `already parsed, skipping` for the rest. A parser fix still forces a full reparse (D4)
  - `npm run images -- --upload`: `already uploaded, skipping` per key it finds in the bucket (today: a count)
  - `npm run load`: its plan already shows `same` rows; the apply output adds `already ingested, skipping: N` per table
  - `npm run build` is a whole-dataset rebuild by design; the status command shows what it validated
- **`extract.links open general --count N`:** opens the next `N` rows of `general.csv` whose status is `to save`, in your browser, as `open` does for the other lists
- **The runbook, `context/docs/collection-runbook.md`**, as short as possible: where each link type is saved, the command after each step, and when to run the status command. `enrichment-guide.md` § 2 and § 5 point to it; § 7 (the dashboard) names the 5 CSVs as its source and the status ladder as its progress
- **Docs:**
  - `CLAUDE.md` § Commands: the status command and the CSVs
  - `manual-work.md`: a row for this feature
  - `.gitignore`, if D1 keeps the CSVs local

## Your part

1. **At `/feature load`:** settle D1–D5 below
2. **Once `listings.csv` and `general.csv` exist** (Claude says when): save the **241 listing pages** still marked `to save`, into `data/inbox/`, under the names in the `Save as` column. Use `uv run python -m extract.links open general --count 10` to open them 10 at a time. After each batch, run `uv run python -m extract.inbox`, then the status command. This is the long part, a few hours in all, at your pace: the feature waits for it
3. **Once all 247 listings are `parsed`:** tell Claude. Claude checks the counts with you (listing pages parsed, pool matches, rows per file) and reads `data/reports/pool.md` for anything odd
4. **Try one match block:** save the next 2 match reports from `general.csv`, import, run the status command. Their crest, player and photo rows must appear right under them. Then save one of those player pages and its photo, import, run the status command again: those rows must move to `saved` and `parsed`, and the photo row must appear
5. **Approve the commit** at `/feature complete`

After this feature, `listings.csv` is done and `match-reports.csv` lists every pool match (~2,000). Player and image rows appear as you save match reports, in your own time.

## Decisions

Settled at `/feature load`, 2026-10-30: D1, D2, D4 and D5 as proposed; D3 the alternative.

- **D1. The CSVs stay local** (approved; gitignored, like `data/work/`). They're derived from `data/pages/`, which is local too, and the status command rebuilds them at any time. Committing them would make a commit of every status change.
  - Alternative: commit them, for a history of progress
- **D2. One command, `npm run status`** (approved). It runs the Python part (link discovery, `saved`, `parsed`, from the saved pages), then the TypeScript part (`validated` from the dataset; `uploaded` and `ingested` from the bucket and the database, read only). Python never touches Postgres or the bucket, and TypeScript fetches no source, so each part stays in its language.
  - Alternative: two commands, one per language
- **D3. Keep both** (approved, the alternative): the Markdown link lists (`data/work/inbox-lists/s07-listings.md`, `s11-match-reports.md`, `s11b-*.md`, `s18-*.md`) stay as they are, beside the CSVs. `extract.lists.*` keep writing them; the CSVs are written from the same logic, so the two never disagree.
  - Proposed instead: the CSVs replace the Markdown lists
- **D4. `--reparse` skips unchanged pages** (approved) (a page's hash against the import log). `--reparse --all` re-reads everything after a parser fix.
  - Alternative: `--reparse` stays a full re-read, with no skip messages
- **D5. The balanced order** (approved). Matches round-robin by group, then by era bucket within a group; oldest first within each group and era. The pilot's 3 matches stay at the top.
  - Alternative: round-robin by era bucket first, then group

## Notes

- Scope:
  - Python: the CSV writers in `extract/lists/`, `saved` and `parsed` statuses, the skip messages in `extract.inbox`, `open general`
  - TypeScript: `validated`, `uploaded` and `ingested` statuses (read only), the skip messages in `images --upload` and `load`
  - the runbook and the docs
- Not in scope: the dashboard (S19); saving match reports, player pages or images beyond the one-block check; any change to parsing, the stages or the schema
- Replaces the "next 100 matches" batch fix discussed on 2026-10-30: dropped in favour of this roadmap
- Depends on: S06c (link lists, import log, progress), S07 (pool), S11, S11b, S18a (the lists of each level), S14, S15, S17, S20 (`verify`)
- Sizes, for the runbook (estimates from the pilot, 2026-10-30): 247 listing pages, ~2,000 match reports, 5,000–8,000 player pages, ~5,300–8,300 images. In `ingest`: ~80,000–90,000 rows, ~40–45 MB; the bucket ~20–28 MB
- Constraints:
  - **Never fetch Transfermarkt with code:** `open` only opens your browser. Links come only from pages you saved
  - Python never writes to Postgres or the bucket; TypeScript never fetches a source
  - Key every entity on its Transfermarkt id, never on a name
  - Status checks only read: no write to any table, no upload, no delete
  - Output is deterministic: sorted, stable, byte-identical on a rerun
  - Logs and the CSVs show ids, file names, statuses and rule names, never an XI or an alias list
  - Comments at most 50 characters
- Verification:
  - `uv run pytest` and `npm test`: the CSV writers (columns, one row per id, block order, rows inserted under their match), each status from a fixture state, the skip messages, the order, determinism
  - `npm run lint`, `npm run typecheck`, `uv run ruff check`, `uv run mypy extract`
  - on the real data: the 6 saved listings and the pilot's 3 matches show `parsed` and `ingested`; then Your part 2–4

**Deviations recorded during implementation**

- **How `npm run status` is built:** `npm run --silent pool && tsx src/status/main.ts && uv run python -m extract.tracker`. The TypeScript step writes `data/work/status/remote.json`: validated match and player ids (from `data/dataset/`), gate errors (from `data/work/gate/matches.json`), uploaded image ids (keys in `data/work/images/keys.json` found in the bucket) and ingested ids (rows with a `transfermarkt_id`; an image only when the row holds its current key). Its shape is `remoteStatusSchema`, exported to `schemas/work/status-remote.schema.json` (`npm run schemas`). The Python step (`extract/tracker.py`) builds the rows from the config, the pool and the raw records, sets each status and writes the 5 CSVs. So the CSVs are rebuilt from the real state; `general.csv` isn't read back, as the spec's "never trusted" asks
- **`npm run pool` runs first**, so match rows follow the listing pages just imported
- **A gate failure is an error only when no starter is missing.** A match with a `no player` failure is waiting for its player pages and stays `parsed`
- **`saved` also covers a file still in `data/inbox/`**; the output then says how many are waiting and to run `extract.inbox`
- **Status never reads `production`**, and without a valid `.env` the bucket and the database are left unchecked: the output says which, and rows stop at `validated` (pages) or `saved` (images)
- **D4, as built:** a stored page never changes (the importer refuses different bytes for a stored id), so "unchanged" means "already has raw records". `--reparse` parses only stored pages with none (`already parsed, skipping: N (--all re-reads them)`); `--reparse --all` is the old full rebuild. Docs mentioning `--reparse` after a parser fix now say `--reparse --all`
- **Skip messages print counts where a line per item would flood:** `extract.inbox` names each file (`<file>: already saved, skipping`); the reparse, the upload (`already uploaded, skipping: N`) and the load (`already ingested, skipping: N` per table) print counts
- **A new data folder, `inbox-lists`,** in `DATA_DIRS` in both languages (their tests now list ten), gitignored (D1)
- **Within a match block:** both crests, then each starter (home XI, then away XI) with their photo right after them
- **`PoolMatch` gained an optional `date`** (already in `matches.json`), for "oldest first"
- **Real data, 2026-10-30:** `npm run status` writes 247 listing rows (6 parsed, 241 to save), 61 match rows (the pilot's 3 ingested, 58 to save), 65 players and 71 images, all ingested: 444 rows in `general.csv`. A rerun gives byte-identical files
- **Docs:** `context/docs/collection-runbook.md` (new); `enrichment-guide.md` § 1, § 2 (points to the runbook), § 5 (now "The whole pool") and § 7 (progress from the CSVs and the status ladder, with a check warning); `CLAUDE.md` § Commands; `.gitignore`. The Turkish copy of the guide in `context/docs/tr/` is now out of date (rerun `/turkish translate`)
- **`Type` column in `general.csv`** (your request, 2026-10-30): after `#`, one of Fixture, Match Report, Player, Crest, PlayerPhoto. The 4 per-type files keep the 5 columns
- 647 TypeScript tests (6 new) and 317 Python tests (25 new) pass; lint, typecheck, format, ruff and mypy clean
- **Your listing pages, 2026-10-30:** you saved 241; `extract.inbox` imported 240 and refused `fixture-euro-2019.html` ("No match rows"). Three problems came out of it, settled with you the same day:
  - **Euro 2020 is `saison_id` 2020, not 2019:** the saved page's own season menu lists it so, and Transfermarkt showed Euro 2028 for 2019. Fixed in code beside the existing Covid exception: `SEASON_ID_FIXES` in `extract/pool_config.py` (the link, and the label `2020`) and `startYear` in `src/pool/config.ts`. Its page is still to save
  - **The Europa League starts in 2009-10 on Transfermarkt:** the 9 `el-2000` … `el-2008` pages were all the current 2026-27 season (their menu ends at 2009). With your approval they were deleted from `data/pages/` and `data/raw/`, and `pool.json`'s `EL` now starts in 2009. The 9 UEFA Cup finals are left out for now, your choice (`match-pool-scope.md` § 1): 238 listing pages instead of 247, 17 `uel-finals` instead of 26
  - **4 curated clubs had no id:** Liverpool 31, Chelsea 631, Tottenham 148, Marseille 244, filled in `pool.json` with your approval from the saved listing pages (each id on 1,100+ rows under that name)
- **A guard against a fallback page** (your approval): the fixture parser refuses a list whose selected season isn't the one in its link (`Shows season 2026, not 2000: no such page`), so such a page is never stored again. The 4 saved test pages pass it; the other 237 stored pages showed their own season
- **After the fixes:** 237 of 238 listing pages parsed; the pool has **1,987 matches** (clashes 1,123, derbies 372, UCL 332, World Cup 96, Euro 58, UEL finals 17), in line with `match-pool-scope.md`'s ~2,000. `general.csv` has 2,361 rows. 648 TypeScript and 319 Python tests pass
- **The one-match-block check, 2026-10-30** (Your part 4): Euro 2020 saved first, so all 238 listing pages are parsed and the pool has 2,002 matches. Then the 2 next reports (`2854549`, Porto – Benfica, and `1041982`, Arsenal – Liverpool) went `parsed`; block 1 grew to 26 rows (the report, 2 crests, 22 players, then the photo of the player you saved, `9654`, right under him), and both crests, the player and the photo moved to `saved` / `parsed`. Block 2 has 23 rows: 2 of its starters were already listed under the pilot's 2006 World Cup final (rows 319 and 329), so they aren't listed again. `players.csv` 107 rows, `images.csv` 76, `general.csv` 2,423. The import log shows each file once
- **Review fixes:** the tracker turns the remote status's id lists into sets once (`indexed`), so each row is one lookup, not a scan of up to 8,000 ids. `npm run status` takes about 3 s on today's 2,423 rows and stays byte-identical on a rerun. 319 Python tests pass, ruff and mypy clean
- **Not as the spec wrote it:**
  - **D3, "never disagree":** the CSVs and the Markdown lists come from the same records, but a crest can carry a different `?lm=` stamp: `general.csv` takes the crest from the first match that shows the club, `s18-images` from the newest. Both name the same club id, and the importer files the image by id, so either link saves the same crest
  - **No `error: placeholder image` row:** Transfermarkt's placeholders are already dropped by the parsers (`crestUrl` / `imageUrl` is `null`), so a club or player with no image simply has no image row
- **`/feature test`:** 2 more tracker tests: a placeholder crest or photo gives no row, and the output names each `error` row by `#` and id and the files waiting in `data/inbox/`. 321 Python tests (29 new in this feature) and 648 TypeScript tests (7 new) pass; ruff, mypy, lint, typecheck and format clean. Not unit tested, on purpose: `src/status/main.ts` (file and database reads, proved on the real data) and the upload message in `src/images/main.ts`

## History
