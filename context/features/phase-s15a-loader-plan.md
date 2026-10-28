# Phase S15a — Loader Plan & Dry Run

## Status

Complete

## Goals

- **`npm run load`** (`src/load/main.ts`): **a dry run by default** (decision D1). It reads `data/dataset/`, compares it with the target branch and prints what a load would change, per table, counts only. It writes nothing; `--apply` arrives in S15b and is refused here
- **Target guard**: prints the target (`LOAD_TARGET` from `.env`: `ingest`, `disposable` or `production`; `dev` is refused by the env schema, S03). `production` also needs `--target production --confirm` on the command line and `createPrismaClient(env, { allowProduction: true })`; anything less stops before a connection is opened. The connection string is never printed
- **Preflight** `src/load/preflight.ts` (decision D4), before any query; each failure stops the run and names the file or the check:
  - every file the manifest lists exists, and its sha256 matches; no match file sits outside the manifest
  - the manifest's `schemaHash` equals the sha256 of `prisma/schema.prisma`, or the dataset was built for another schema: rebuild it
  - the whole dataset passes `datasetSchema` (S04) again
  - `npm run db:check` exits 0 (run as a child process; drift stops the run)
- **Reader** `src/load/read.ts`: only `SELECT`s, keyed by the dataset's natural keys (`slug`; seasons by competition and label). It reads the stored rows of every content table the dataset touches, plus, for decision D2, the scraper's matches that are no longer in the dataset, and, for decision D3, how many game sessions each loaded match has
- **Planner** `src/load/plan.ts`, **pure** (files and stored rows in, a plan out; tested without mocks or a database). Per table: create, update, delete and unchanged counts, keyed by natural keys, following the backend seed's rules (`../lineup-backend/scripts/seed/seed.ts`, ported by hand, read never imported) and extended to every content table:
  - `competitions`, `clubs`, `players`, `matches` by slug; `seasons` by competition and label; **never deleted**
  - `clubs`, `players` and `matches` write `transfermarkt_id` (R1); `matches` write `extra_time`, `shootout_home`, `shootout_away`, `nickname`
  - `club_aliases` by club and exact alias, `player_aliases` by player and `normalized` (= `normalizeName(alias)`, `src/names/normalize.ts`): created, updated (the raw `alias` text) and deleted to match the dataset
  - `match_teams` by match and side
  - `lineups`: **a side's XI is rewritten whole** (delete 11, insert 11) when any of its rows differ (`data-contract.md` § 2.9)
  - `match_events`: **a match's events are replaced whole** when they differ (they have no natural key, § 2.10)
  - `memorability_scores` by match: created or updated (score, `signals` compared as canonical JSON, `algorithm_version`, `computed_at`)
  - **Retirements** (decision D2): the score row of a match this repo loaded (it has a `transfermarkt_id`) that's no longer in the dataset is deleted; the match stays
  - **Played XIs flagged** (decision D3): a rewritten XI or a retired match that has game sessions is counted apart, so the dry run warns before history changes meaning (§ 4)
- **Output**: one line per table (`players  65 rows: 65 create, 0 update, 0 delete, 0 same`), then retirements and played-XI warnings, as counts. Never a name, an alias or an XI
- **Tests** (Vitest, pure, no database): the planner on built datasets and stored states (empty, equal, one alias changed, one XI slot swapped, an event added, a score moved, a match that left, a played XI); every preflight failure on a temporary folder; the target guard's refusals. The reader and `main.ts` are proven by the dry run below
- **Docs:** `CLAUDE.md` § Commands (`npm run load`), `manual-work.md` row S15a, `enrichment-guide.md` § 2 step 9

## Decisions

Settled at `/feature load`, 2026-10-28 (all four as proposed):

- **D1. Plan first; the dry run is the default** (approved): the loader always computes the whole plan from a read, prints it, and writes only with `--apply` (S15b), executing that same plan. The dry run is then exact, and the planner is a pure function, testable without a database. Alternative: run the writes in a transaction and roll it back, which is exact too but can't span the per-season transactions S15b needs
- **D2. A match that leaves the dataset is retired, never deleted** (approved): its `memorability_scores` row is deleted, which takes it out of the pool (§ 4: "To take a match out of the pool"); only rows with a `transfermarkt_id`, so the mock seed's rows on `dev` are never touched. Its competition, clubs and players stay, as they must. Alternative: report it only, and retire by hand
- **D3. The loader reads `game_sessions` (match ids only)** (approved): § 4 asks the dry run to flag rewriting a played XI, which needs one `SELECT count(*) … GROUP BY match_id` on a non-content table. Reading is not writing; the restricted role in S15b gets `SELECT` on that one column. Alternative: no flag, since nobody plays `ingest` before S20
- **D4. The loader checks the dataset and the schema itself** (approved): manifest hashes, the schema hash, `datasetSchema` and `db:check` all run before the first query, so a hand-edited file or a stale schema copy never reaches the database. Alternative: trust `npm run dataset` and run `db:check` by hand

## Notes

- Scope: everything up to the write: the command, its guards, the read and the plan. S15b executes the plan in chunked transactions, adds the restricted role, and proves it on a disposable branch. The real load into `ingest` is the pilot's (S20), with your approval
- Depends on: S14 (`data/dataset/` and its manifest), R1 (done 2026-10-28, `e1230cb`), S03 (`createPrismaClient`, `LOAD_TARGET`, `db:check`)
- Your part: **nothing**. The dry run only reads; it runs against `ingest`, which has the schema and no rows
- Ported by hand from `../lineup-backend/scripts/seed/seed.ts` (`sync`: diff, then write; per-table keys; `syncLineups`) and `main.ts` (counts-only output, error formatting). Never imported
- Constraints:
  - **Never write a non-content table** (`data-contract.md` § 3); this phase writes nothing at all
  - **Never delete** a competition, season, club, player or match (§ 4)
  - Ids come from the Prisma client, never from this code (§ 1.2); rows are found by natural keys (§ 1.4)
  - **Never `production` without an explicit instruction in the prompt** (CLAUDE.md), and then only after a clean dry run
  - Logs print counts and paths, never an XI or an alias list; errors name paths, never values (§ 1.7)
  - Unit tests open no connection
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`. `npm run load` against `ingest`: preflight passes, and the plan shows every pilot row as a create (3 competitions, 3 seasons, 6 clubs, 65 players, 164 player aliases, 3 matches, 6 match teams, 66 lineup rows, 13 events, 3 scores), 0 retirements; a second dry run prints the same; the branch still has no rows

**Deviations recorded during implementation**

- **`src/load/rows.ts`** (added): every content row by natural keys, for the dataset (`wantedRows`) and the database (the reader); the planner compares the two. `computed_at` is compared as an ISO instant and `signals` as canonical JSON (sorted keys)
- **Events are compared without order** (they have no order column), and a match whose dataset events are now empty loses its stored ones
- **The committed dataset was rebuilt**: R1's schema copy (`e1230cb`) came after S14, so the manifest's `schemaHash` was stale and the preflight refused it, as D4 meant it to. Only `manifest.json` changed
- **`data/dataset/.gitkeep` restored to git**: the S14 commit (`3b74d66`) dropped it by mistake; each build writes it again
- **`--dry-run`** is accepted and changes nothing (the default); an unknown argument exits 2
- The `pg` driver prints an SSL-mode warning for a `sslmode=require` connection string: it names no value, and setting `sslmode=verify-full` in `.env` silences it
- Pilot dry run on `ingest`, 2026-10-28: 335 creates (3 competitions, 3 seasons, 6 clubs, 3 club aliases, 65 players, 164 player aliases, 3 matches, 6 match teams, 66 lineup rows, 13 events, 3 scores), 0 updates, deletes, retirements or played matches; a second run printed the same; `ingest` still holds no rows. `--apply` and a `--target` unlike `LOAD_TARGET` are refused

## History
