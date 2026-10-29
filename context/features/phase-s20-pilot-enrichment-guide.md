# Phase S20 — Pilot & Enrichment Guide

## Status

Complete

## Goals

- **`npm run build`** (D3): runs the TypeScript stages in order, `pool` → `resolve` → `lineups` → `aliases` → `scores` → `gate` → `images` → `dataset`, each as its own `npm run <stage>`, one at a time, stopping at the first that fails and naming it. No new logic: the stages stay the source of truth. S19's **Build** button calls it
- **`npm run verify`** (D4), `src/verify/` (read-only, against `LOAD_TARGET`, behind the loader's target guard): proves what the backend will serve, from the database itself, for every match loaded with a `transfermarkt_id`:
  - the selector (`data-contract.md` § 9.1): a `memorability_scores` row at or above its threshold (45 for `world_cup`, `euro`, `ucl`; 60 otherwise)
  - completeness (§ 9.2): 2 `match_teams` rows, both with a formation, each with 11 `lineups` rows
  - play time (§ 9.3), for **both** sides: every slot's `position` is `positionForSlot(formation, slot)`, every starter has a `player_aliases` row
  - the `sides` block parses with `sideSignalsBlockSchema`
  - every `player_aliases.normalized` equals `normalizeName(alias)` (§ 5's guard, for the rows the scraper wrote)
  - every `crest_key` and `image_key` names an object in the target's bucket
  - the row counts equal `data/dataset/manifest.json`
  - prints counts and the rule each failing match breaks, by slug; never an XI or an alias. Exits 1 on any failure
- **The rehearsal**, on the pilot, from the saved pages alone:
  1. `uv run python -m extract.inbox --reparse`, then `npm run build`
  2. `data/dataset/` comes out byte-identical to the committed one (`git diff --exit-code data/dataset/`)
- **The pilot load into `ingest`** (👤 approval):
  1. `npm run load`: the dry run, counts only (about 335 changes)
  2. `npm run load -- --apply`
  3. a second `npm run load` plans 0 changes, and a second `--apply` writes nothing
  4. `npm run verify` passes on all 3 matches
- **The play test** (👤, D1, D2): the 3 matches played in the web app against a local backend on `ingest`; what you find (a real name the matcher refused, a wrong face, a wrong slot) is fixed in `data/curation/`, rebuilt, reloaded and re-verified
- **`context/docs/enrichment-guide.md` finalised:**
  - Status: from "a plan" to the verified method
  - every command as actually run on the pilot, with `npm run build` and `npm run verify` in the loop
  - § 4 the pilot as built: the 2002–03 derby, 65 players, 71 images
  - a new section on playing new matches: the backend on `ingest` (D2)
  - the times the pilot took per step
  - how to pick the next ~100 matches from the link lists
  - the dashboard marked as S19, built after S20: the terminal commands until then
- **Docs:**
  - `CLAUDE.md` § Commands: `npm run build`, `npm run verify`
  - `manual-work.md` row S20
  - `backend-requests.md` R2 status, once built

## Your part

1. **Before the play test, build backend request R2 "Image URLs"** in `lineup-backend` (`backend-requests.md` § R2; D1). It's a backend phase in its own branch, never part of this repo's branch. No migration: an `ASSET_BASE_URL` env var, with keys turned into `crestUrl` and `imageUrl`
2. **Approve the pilot load into `ingest`**, after reading the dry run's counts. It's the first real write to `ingest`'s tables. Claude runs `npm run load -- --apply` only after you say so
3. **Point your local backend at `ingest` to play** (D2), in `lineup-backend`'s `.env`:
   - `DATABASE_URL`: `ingest`'s connection string, copied from the Neon console; never pasted into the chat
   - `ASSET_BASE_URL`: `https://br-steep-paper-b1z0rlqq.storage.c-5.eu-central-1.aws.neon.tech/images`

   Start the backend and the web app as usual. Don't run the backend's e2e suites while it points at `ingest`. Afterwards, set `DATABASE_URL` back to `dev`
4. **Play the 3 matches**, about 20 minutes:
   - solo, each side of each match: 6 XIs
   - one duel between two browser windows

   Name what goes wrong: a real name the game refused, a wrong photo or crest, a player in the wrong slot. Claude fixes it in `data/curation/` and reloads, with your approval each time
5. **Read the finished `enrichment-guide.md`** once, and say what's unclear

## Decisions

Settled at `/feature load`, 2026-10-29, all four as proposed.

- **D1. R2 before the play test** (approved). The images are the part of the pilot not yet seen in the app, and R2 needs no migration.
  - Alternative: play without images (both URLs `null`), and check images once R2 lands. S20 then completes without proving the images in the app
- **D2. Play on `ingest` itself** (approved). The local backend points at `ingest`; `ingest` then holds only the 3 real matches, so the selector serves only the pilot.
  - Your games write accounts, sessions and guesses into `ingest`. The scraper never touches those tables, so its loads are unaffected
  - From then on, a load that rewrites the XI of a played match is flagged by the dry run, as it would be in `production`
  - `dev` keeps the mock seed and the backend's tests (`data-contract.md` § 10)
  - Alternative: a throwaway branch from `ingest` after each load, deleted after play. It keeps `ingest` content-only, but needs its own connection string and its own `ASSET_BASE_URL` each time
- **D3. One `npm run build`** (approved). It chains the 8 stages, so the guide and S19's Build button have one command, and a failure names its stage.
  - Alternative: the guide lists the 8 commands, and S19 chains them itself
- **D4. A reusable `npm run verify`** (approved). After every load you make during enrichment, it proves the backend's play-time rules from the database itself, not from the dataset. The dataset schema already checks them before a load; `verify` catches what only the database shows: a partial load, an old row, a missing object.
  - Alternative: Claude runs the same checks once, as read-only SQL through the Neon MCP, and records the result here. Nothing is left for your later loads

## Notes

- Scope:
  - TypeScript: `npm run build` and `npm run verify`
  - the rehearsal, the load and the play test on the pilot
  - the guide and the docs

  No Python change, no schema change, no new stage. Backend R2 is built in `lineup-backend`, not here
- Depends on:
  - every earlier phase (S01–S18)
  - R2 (backend) before the play test, per D1
- Pilot (`enrichment-guide.md` § 4), as the dataset holds it now:

  | Match | Competition, season |
  | --- | --- |
  | Bayern Munich – Valencia | `champions-league/2000-01` |
  | Italy – France | `world-cup/2006` |
  | Fenerbahçe – Galatasaray | `super-lig/2002-03` |

  Totals: 3 matches, 6 clubs, 65 players (66 places), 164 aliases, 13 events, 6 crests, 65 photos
- Constraints:
  - **Load only into `ingest`**, and only after your approval; never `production` (`CLAUDE.md`)
  - `verify` only reads: no write to any table, no upload, no delete
  - Write only the content tables (`data-contract.md` § 3). Your games write the gameplay tables, through the backend, never through the scraper
  - A rerun writes nothing (`data-contract.md` § 1.5)
  - Logs print counts, slugs and rule names, never an XI, an alias or a connection string (`coding-standards-scraper.md` § Logs)
  - A fix found in play goes in `data/curation/`, never in code (§ Data rules). No LLM supplies a name or an alias
  - `verify` ports nothing new by hand: it uses this repo's copies of `positionForSlot`, `normalizeName`, `sideSignalsBlockSchema` and the pool thresholds (S04, S10)
  - `project-overview.md` is not edited here (`backend-requests.md` § Shared spec changes)
- Verification:
  - `npm test` covers `build`'s order and stop-at-failure, and each `verify` rule on an in-memory dataset, passing and failing; `npm run lint`, `npm run typecheck`, `uv run pytest`
  - the rehearsal: byte-identical `data/dataset/`
  - the load into `ingest`, then a rerun with 0 changes
  - `npm run verify` on `ingest`
  - your play test

**Deviations recorded during implementation**

- **`npm run build`** is `src/build/` (`BUILD_STAGES`, `runStages`): each stage as `npm run --silent <stage>`, its output streamed; on a failure it prints the stage and that the later ones didn't run, and exits 1
- **What `verify` reads:** the database rows of the dataset's slugs, plus every match with a `transfermarkt_id` and a score row. So a served match that has left the dataset is flagged ("served but not in the dataset"), and clubs and players kept from a retired match never break the counts. The counts compared with the manifest are those of the dataset's own rows, not whole tables
- **`verify` also runs the loader's preflight** (manifest, schema hash, dataset schema) before reading, and refuses `--apply`. It takes the loader's `--target` and `--confirm`, so `production` needs both, as for a load
- **`openTargetStore`** (`src/load/images.ts`): the storage env, S17's guard and the client in one helper, now shared by `npm run load`'s bucket check and `verify`; the load's behaviour is unchanged
- 637 TypeScript tests (14 new) and 292 Python tests pass; lint, typecheck and format clean
- **Rehearsal, 2026-10-29:** `extract.inbox --reparse` (6 fixture lists, 5 match reports, 66 player pages, under 1 s), then `npm run build`: all 8 stages passed in about 6 s, the gate passed 3 of 3, and `git diff --exit-code data/dataset/` found no change
- **Dry run on `ingest`, 2026-10-29:** "images: all 71 in the bucket", then 335 creates, 0 updates, 0 deletes, 0 played matches affected. `npm run verify` on the still-empty branch exits 1 with 86 failures (every dataset row missing, every count 0), as it should
- **Pilot load into `ingest`, 2026-10-29** (Your part 2, with your approval): `npm run load -- --apply` wrote 335 rows in 5 transactions (parents, players 1–65, one per competition season) in about 9 s. A second dry run planned 0 changes, a second `--apply` wrote 0 rows, and `npm run verify` passed: all 3 matches servable and playable, every count equal to the manifest, 71 keys found in the bucket
- **The guide, finalised before the play test:** § 2 is now the terminal loop (15 steps, with `npm run build`, `npm run images -- --upload`, `npm run verify`) and the pilot's times; § 5 the next ~100 matches; § 6 adds build, load and verify failures; § 7 the dashboard, marked not built; § 8 playing on `ingest`. The derby is Fenerbahçe – Galatasaray of 6 November 2002. Saving times come from `manual-work.md`'s pilot rows; the command times from this run
- **R2 built in `lineup-backend`, 2026-10-29** (Your part 1, by a backend session from `r2-image-urls.md`): `f5ad59d` on `main`. `backend-requests.md` marks R2 Done; `data-contract.md` is the regenerated copy (§ 2.3, 2.5, 2.12, 11: keys are sent as `<ASSET_BASE_URL>/<key>`, no leading `/`). Its check on `ingest` left one guest user and one quit solo session there, gameplay rows the scraper never reads. The backend's `.env` stays on `ingest` with `ASSET_BASE_URL` set, for the play test
- **Play test, 2026-10-30** (Your parts 3 and 4): you played the pilot in the browser, the web app on the local backend on `ingest` with `ASSET_BASE_URL` set, and found nothing to fix: no refused real name, no wrong crest or photo, no player in the wrong slot. No curation change, so no rebuild or reload
- **Review fixes:** `verify` reads every table ordered by slug and each match's sides home then away, so its output is the same on every run; slug lookups use a `Set`, not a list scan, for a 2,000-match pool. 637 TypeScript tests pass, lint, typecheck and format clean, `verify` on `ingest` still passes
- **`/feature test`:** `parseVerifyArgs` (`src/verify/args.ts`) moved out of `main.ts` and tested: no flags, the production guard flags, `--apply` refused (exit 2, checked on the command line too), an unknown flag refused. `openTargetStore` gets no unit test: its guard and env parsing are S17's, already tested, and the env is cached per process. 641 TypeScript tests (18 new in S20) and 292 Python tests pass; lint, typecheck and format clean; `verify` on `ingest` still passes

## History
