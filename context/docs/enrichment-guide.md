# Enrichment Guide

How you grow the database yourself, in your own time, after the pilot. This repo builds the tools and proved them on 3 matches (S20); collecting the rest of the pool is your work, at your pace. When a step fails or the data looks wrong, ask, and the scripts get fixed.

**Status:** verified on the pilot (S20, 2026-10-29). Every command below was run as written: from the saved pages to `ingest`, then played in the app. The dashboard (§ 7) comes with S19, after S20; until then, every step is the terminal command shown.

---

## 1. The idea

- **Small, then grow.** The pilot is 3 matches (§ 4). Then the whole pool of `match-pool-scope.md`, in the order of `general.csv` (§ 5).
- **Save each page once.** A club is never saved (its id and name come from match pages). A player is saved once, however many matches they start. Every link list leaves out what's already saved.
- **A match is playable when it's complete:** its match report, and the player page of all 22 starters. Only complete matches that pass the gate reach the database.
- **Nothing reaches the database without your approval**, and never `production` without your explicit instruction.

---

## 2. The loop

Run from the repo root. Each step is the command shown; S19 adds a dashboard button for most of them (§ 7). **The short checklist is `collection-runbook.md`:** it follows `data/inbox-lists/general.csv`, and `npm run status` keeps that file's statuses current after every step.

| # | You do | Command |
| --- | --- | --- |
| 1 | Pick the next batch: a group, a competition, a season (§ 5) | `uv run python -m extract.progress` |
| 2 | Write the list for the level you're on (§ 3) | `uv run python -m extract.lists.listings`, `…lists.match_reports`, `…lists.player_pages` or `…lists.images` |
| 3 | Open its unsaved links in your browser, a few tabs at a time | `uv run python -m extract.links open <list> --count 10` |
| 4 | Save each page as **HTML only** into `data/inbox/`, under the file name shown (`manual-work.md` § How to save a page). Images: ⌘S on the image itself | — |
| 5 | Import what you saved; read what it refused | `uv run python -m extract.inbox` |
| 6 | See what's still missing; check one page | `uv run python -m extract.progress`, `uv run python -m extract.check <link>` |
| 7 | Repeat 2–6 one level down: listing pages → match reports → player pages → crests and photos | — |
| 8 | Build: the 8 stages in order (`pool`, `resolve`, `lineups`, `aliases`, `scores`, `gate`, `images`, `dataset`); it stops at the first that fails and names it | `npm run build` |
| 9 | Read the reports: `data/reports/gate.md` (matches that failed and why), `images.md` (photos to check by eye), `images.html` (every face and crest); fix names in `data/curation/` (§ 6) and rebuild | — |
| 10 | Upload the new images to `ingest`'s bucket; a rerun uploads nothing | `npm run images -- --upload` |
| 11 | Commit `data/dataset/` | `git add data/dataset && git commit` |
| 12 | Dry-run the load and read the counts; it stops if an image isn't in the bucket | `npm run load` |
| 13 | Load into `ingest`; a second run writes 0 rows | `npm run load -- --apply` |
| 14 | Prove the database serves every match: exits 1 and names the match and the rule otherwise | `npm run verify` |
| 15 | Play the new matches in the app (§ 8) | — |

How long the pilot took (2026-10-29):

| Step | Pilot | Rate |
| --- | --- | --- |
| Saving listing pages and match reports | 2 + 2 pages, ~10 min | ~2–3 min a page |
| Saving player pages | 65 pages, ~25 min | ~25 s a page |
| Saving crests and photos | 71 images, ~20 min | ~17 s an image |
| Import (`extract.inbox --reparse --all`, every stored page) | 77 pages, under 1 s | — |
| `npm run build` | 8 stages, ~6 s | — |
| `npm run load -- --apply` | 335 rows, ~9 s | — |
| `npm run verify` | 3 matches, 71 images, a few seconds | — |

Saving is almost all of the time. Everything after it takes seconds.

---

## 3. Which links come from where

Links are found level by level, so a list can only hold what the level above has revealed (`link-map.md` § 1):

| Level | List | Known once | Size, whole pool |
| --- | --- | --- | --- |
| 1 | `s07-listings`: listing pages | Now: written from the config (`extract.lists.listings`) | 238 |
| 2 | `s11-match-reports` | Their listing page is saved and `npm run pool` has run (`extract.lists.match_reports`) | ~2,000 |
| 3 | `s11b-players` | Their match report is saved (`extract.lists.player_pages`); players already saved are left out | ~5,000–8,000 |
| 4 | `s18-images`: crests and photos | Their match report and player page are saved (`extract.lists.images`) | One per club and player |

---

## 4. The pilot

Built and loaded into `ingest` on 2026-10-29:

| Match | Competition, season | Why |
| --- | --- | --- |
| Bayern Munich – Valencia, 2001 Champions League final | `champions-league/2000-01` | `ucl` knockout, 5-4-1 against a diamond, extra time and a shootout |
| Italy – France, 2006 World Cup final | `world-cup/2006` | `world_cup`, national teams, extra time and a shootout, a red card |
| Fenerbahçe – Galatasaray, 6 November 2002 | `super-lig/2002-03` | `league`, a derby, a matchday stage |

In all: 3 matches, 6 clubs, 65 players (66 places; one player starts twice), 164 aliases, 13 events, 6 crests and 65 photos: 335 rows. Saved by hand: 2 listing pages, 2 match reports (the 2001 final was already saved), 65 player pages and 71 images.

---

## 5. The whole pool

Follow `data/inbox-lists/general.csv` from the top (`collection-runbook.md`). `npm run status` writes it, and the 4 per-type CSVs beside it, from what you've saved:

1. **All 238 listing pages first.** Each parsed listing adds its pool matches to the file.
2. **Then match by match.** A match block starts as one row, its report. Once that report is parsed, its crests, its 22 starters' pages and, once each page is parsed, their photos appear right under it. A club or player already listed under an earlier match isn't listed again.
3. **The order is balanced:** the pilot first, then round-robin across the groups, and across the era buckets within a group, oldest first. Wherever you stop, the saved matches spread over every group and era.
4. **Build and ingest a batch whenever you like** (§ 2, steps 8–14), then `npm run status`.

Every status is recomputed from the real state on each run, never read back from the CSV, so a mistake is corrected next time. Sizes for the whole pool: 238 listing pages, 1,987 match reports (2,002 with Euro 2020), 5,000–8,000 player pages, ~5,300–8,300 images; in `ingest`, ~80,000–90,000 rows (~40–45 MB) and a ~20–28 MB bucket.

---

## 6. Mistakes and fixes

| You see | Do |
| --- | --- |
| The importer refuses a page as a challenge | Save it again once the site loads normally |
| A page saved twice | Nothing: the importer keeps one copy per id |
| A parse error on a page | Keep the page; ask for a fix. It's a selector change, tested on that page; then `uv run python -m extract.inbox --reparse --all` re-reads every stored page |
| `npm run build` stops at a stage | Read that stage's message and its report in `data/reports/`; fix, then run `npm run build` again |
| A match fails the gate | `data/reports/gate.md` names the side, the slot and the rule. `no player` or `no alias`: save the missing player page. `no alias of their own`: add an alias in `data/curation/aliases.json`. `no formation` or `breaks …`: a formation to map in `data/curation/formations.json`. Then `npm run build` |
| A wrong name, alias or club name | Fix it in `data/curation/`, then rebuild; never in code |
| A photo listed in `images.md`, or a face cut badly in `images.html` | Add a crop for that player to `data/curation/images.json`: `{ "photoCrops": { "oliver-kahn": "top" } }` (`top`, `centre`, `bottom`, or pixels from the top); then `npm run build` |
| A crest with a white square behind it, or a wrong photo | Save a better image under the same id (it replaces the filed one); then `npm run build` and `npm run images -- --upload` |
| A missing nickname, or an alias that shouldn't count | Add it to, or remove it with, `data/curation/aliases.json` under the player's Transfermarkt id: `{ "7438": { "add": ["Kily"], "remove": [] } }`; then `npm run build`. `aliases.md` lists aliases two starters share and near-misses inside an XI |
| `npm run load` says images aren't in the bucket | `npm run images -- --upload`, then the load again |
| The dry run flags a played match | Your change rewrites an XI or the events of a match someone has played. Load only if the change is a correction |
| `npm run verify` fails | It names the match and the rule (`no memorability score`, `home: slot 4 has no alias`, `served but not in the dataset`, a count off the manifest). Rerun `npm run load -- --apply` if the load stopped partway; otherwise ask |
| A real name the game refused in play | Add it as an alias in `data/curation/aliases.json`, then build, load and verify |

---

## 7. The dashboard (S19)

Not built yet: S19 comes after S20. Until then, use the commands in § 2.

A local app: `npm run dashboard` opens it in your browser. It reads only local files and the `ingest` branch, and it's reachable only from your machine.

**Progress.** Read from the 5 CSVs in `data/inbox-lists/` (run `npm run status` first). For each link type, the share of its links at each step of the status ladder: saved / to parse, parsed / to parse, validated / to parse, ingested / to parse (images: saved, uploaded, ingested), with counts and percentages (`23/1,000`, 2.3%). The denominator is every link known so far, and it grows as each level is saved. Broken down by group, competition, season, era and club, and for the whole pool. A warning asks you to check what you've saved (parsed, ingested, images in the bucket) when rows sit at an `error` or below `parsed`.

**History.** Every import from the import log: when, which file, which link, what it became, and whether it worked. Filterable by kind and date.

**Failures, each with its reason and what to do:**

| Failure | From |
| --- | --- |
| A challenge page saved by mistake | Import |
| A page of an unknown kind, or for a match outside the pool | Import |
| A page that didn't parse | Import |
| The same page saved twice | Import (one copy is kept) |
| A match report whose date or teams disagree with its listing | Build |
| A match missing a player page, or with an unreadable formation | Gate |
| A player with no usable alias | Gate |
| A dataset validation error | Build |
| Rows that differ in the dry run, or schema drift (`db:check`) | Load |
| A club or player with no image | Images |
| A loaded match the backend couldn't serve or play | Verify |

**Buttons:**

| Button | Does |
| --- | --- |
| Open next links | Opens the next few links of a list in your own browser, for you to save. It never fetches a page itself |
| Import | Runs the importer on `data/inbox/` |
| Build | Runs `npm run build` |
| Check schema | Runs `db:check` |
| Dry run | Shows what a load would change, counts only |
| Load into `ingest` | Loads after a confirmation, only once a dry run has passed; then runs `npm run verify` |

- **One action at a time.** Its output streams into the page, and the views refresh when it ends.
- **No `production` button.** Loading into `production` stays a terminal command with an explicit confirmation.
- **No scraping button.** Transfermarkt challenges code, so only you save its pages (`transfermarkt-source.md` § 8).

---

## 8. Playing what you loaded

Real matches live on `ingest`; the backend's `dev` branch keeps the mock seed and the backend's tests (`data-contract.md` § 10). To play real data, run your local backend against `ingest`:

1. In `lineup-backend`'s `.env`:
   - `DATABASE_URL`: `ingest`'s connection string, from the Neon console (project **lineup** → branch **ingest** → Connect)
   - `ASSET_BASE_URL`: `https://br-steep-paper-b1z0rlqq.storage.c-5.eu-central-1.aws.neon.tech/images` (needs backend request R2, `backend-requests.md`)
2. Start the backend and the web app as usual. Only the loaded real matches are served, through the same filters as in production.
3. Play each new match from both sides when you can; a duel needs two browser windows.
4. **Don't run the backend's e2e suites** while it points at `ingest`. They expect the mock seed.
5. When you're done, set `DATABASE_URL` back to `dev`.

Your games write accounts, sessions and guesses into `ingest`. The scraper never touches those tables, so later loads are unaffected. A later load that rewrites the XI of a match you've played is flagged by the dry run, as it would be in `production`.
