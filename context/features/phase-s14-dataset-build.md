# Phase S14 — Dataset Build

## Status

Complete

## Goals

- **Dataset schema gains `transfermarktId`** (decision D1): a nullable digit string on clubs, players and matches in `src/dataset/schema.ts`, unique within each list when set. Backend request R1 adds the same columns to the database (`backend-requests.md`); the loader (S15) waits for it. Every other S04 rule stays as it is
- **Assembly** `src/dataset/build.ts`, pure: from the stage outputs, **only the matches that passed the gate (S13)**, and only what they need (`match-pool-scope.md` § 5):
  - **matches**: slug, competition, season, date and stage (S08a); `transfermarktId`; `nickname` null (no curation yet); score, extra time and shootout (S11); both XIs as `{ formation, lineup: [{ playerSlug, slot, position }] }` (S11, slugs from S08b's crosswalk); events (S11) with player slugs, an unknown player as `null`; `memorability` = S10's score, `algorithmVersion` and `computedAt`, with S10's signals and S13's whole `sides` block
  - **Events with an unknown minute are left out** of the dataset (`match_events.minute` is 1–120) and counted in the report
  - **competitions** and **clubs** the kept matches use (S08a), with clubs' `aliases`, `kind`, `shortName`; `crestKey` null until S18
  - **players**: every starter of a kept match, plus every event player with a slug; `name` (S08b), `aliases` (S12), `imageKey` null until S18
  - Each list sorted by slug, keys in a fixed order, 2-space JSON, trailing newline
- **Validation before the first write:** the assembled object passes `datasetSchema` (S04) whole, or nothing is written and the run fails naming each path (never a value). This is where every `data-contract.md` CHECK and every § 9.3 play-time rule is checked a last time
- **Files** in `data/dataset/` (decision D2), committed:
  - `competitions.json`, `clubs.json`, `players.json`
  - `matches/<competition-slug>/<season>.json`, one per competition season, matches sorted by slug
  - `manifest.json` (decision D4)
- **Written whole** (decision D3): the new dataset is built in a temporary folder beside it, then swapped in, so `data/dataset/` always holds one complete build. A match that leaves (it now fails the gate) leaves the files too. A rerun with no new input changes no byte
- **Report** `data/reports/dataset.md` (local): counts per list and per competition season; matches left out and why (failed the gate, not scored, no lineup); events left out for an unknown minute; players present only through an event. The terminal prints counts and paths only
- **`npm run dataset`** (`src/dataset/main.ts`): reads `data/work/resolved/` (competitions, clubs, matches), `data/curation/crosswalk/players.json`, `data/work/resolved/players.json`, `data/work/lineups/matches.json`, `data/work/aliases/players.json`, `data/work/scores/matches.json` and `data/work/gate/matches.json`, each through Zod
- **Tests** (Vitest, beside the code, pure, no mocks): a failed or unscored match left out with its clubs and players; event slugs and an unknown player; an unknown minute dropped; the `sides` block from the gate; `transfermarktId` unique per list; a schema failure writes nothing and names its path; the file layout and manifest; byte-identical output
- **Docs:** `CLAUDE.md` § Commands (`npm run dataset`), `link-map.md` § 7, `manual-work.md` row S14, `enrichment-guide.md` § 2 step 7, `backend-requests.md` R1 (the dataset side is done)

## Decisions

Settled at `/feature load`, 2026-10-28 (all four as proposed):

- **D1. `transfermarktId` in the dataset now** (approved): R1 says S14 adds it, the ids are already in every stage output, and the dataset is the scraper's own file, so nothing waits on the backend here. Only S15's write needs R1's columns. Alternative: wait until R1 is deployed and add it in S15
- **D2. Matches split by competition season** (approved): `matches/champions-league/2000-01.json`, as `scraper-repo-setup.md` § 8 planned, so adding a season touches one file and a git diff stays readable at 2,000 matches. Competitions, clubs and players stay one file each. Alternative: one `matches.json`
- **D3. The dataset is rebuilt whole every run** (approved): a temporary build is swapped in once it validates, so the folder never holds half a build, and a match the gate now refuses leaves the dataset. What that means in the database (its score row removed, never the match) is S15's to decide (`data-contract.md` § 4). Alternative: only add and update, never remove from the files
- **D4. The manifest has no timestamp** (approved): `{ algorithmVersions, counts, files: { "<path>": "<sha256>" }, matchesBy: { "<competition>/<season>": n }, schemaHash, sources }`. `schemaHash` is the sha256 of `prisma/schema.prisma`, so S15 can refuse a dataset built for another schema; the file hashes let S15 skip what didn't change. A build time would break the byte-identical rerun; the newest source time is already each score's `computedAt`. Alternative: add a `builtAt` from the clock

## Notes

- Scope: the committed dataset and its manifest. No database, no bucket: loading is S15, images S17–S18. Seasons aren't a list of their own; they're implied by each match's `(competitionSlug, season)` (S04)
- Depends on: S08 (resolved entities, crosswalks), S10 (scores), S11 (lineups, events), S12 (aliases), S13 (gate). Run every stage first: `npm run pool`, `resolve`, `lineups`, `aliases`, `scores`, `gate`
- Your part: **nothing**
- Pilot: 3 matches pass the gate, so the dataset holds 3 competitions (`champions-league`, `world-cup`, `super-lig`), 6 clubs, 65 players, and 3 match files (`champions-league/2000-01`, `world-cup/2006`, `super-lig/2002-03`). The derby's 78' goal is by a substitute with no saved page (`7064`), so its `playerSlug` is `null`
- Constraints:
  - **Only the pool is loaded**: matches that passed the gate, and only their competitions, clubs and players (`coding-standards-scraper.md` § Data rules)
  - **Output is deterministic:** sorted by slug, stable key order, 2-space JSON, trailing newline; a rerun with no new input is byte-identical
  - **Validate before the first write** (`data-contract.md` § 1.6); errors name paths, never values (§ 1.7)
  - **Slugs are permanent**: they come from the crosswalks, never regenerated
  - The dataset stays in this private repo
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`. A pilot run: the counts above, the manifest, `datasetSchema` passing; a second run changes no byte

**Deviations recorded during implementation**

- **`data/curation/crosswalk/players.json` isn't read:** `data/work/resolved/players.json` holds the same slugs with the display names, keyed by spieler id
- **`.gitkeep` is rewritten into each build**, so the committed folder marker survives the swap
- **`.gitignore` gains `data/dataset.build/` and `data/dataset.previous/`**, the swap's temporary folders, so an interrupted build is never committed
- **`src/dataset/write.ts`** (`writeDataset`): validation and the folder swap, moved out of `main.ts` in `/feature test` so a temporary folder can prove that an invalid dataset writes nothing
- **Key order:** dataset objects follow the dataset schema's field order (the database's column order), not alphabetical; the manifest's keys are alphabetical
- A starter with no player record would give an empty slug, and a side with no formation an empty one; neither can pass the gate, and `datasetSchema` refuses both, naming the path, before anything is written
- Pilot run, 2026-10-28: 3 matches in 3 match files, 3 competitions, 6 clubs, 65 players, 66 lineup rows, 13 events, 164 aliases; 58 pool matches left out (no lineup); the derby's 78' scorer `null`; rerun byte-identical

## History
