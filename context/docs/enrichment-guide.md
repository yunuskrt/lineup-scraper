# Enrichment Guide

How you grow the database yourself, in your own time, after the pilot. This repo builds the tools and proves them on 3 matches (S20); collecting the rest of the pool is your work, at your pace. When a step fails or the data looks wrong, ask, and the scripts get fixed.

**Status:** a plan. Each command is filled in by the phase named beside it; S20 rehearses the whole loop on the pilot and finalises this file.

---

## 1. The idea

- **Small, then grow.** The pilot is 3 matches (§ 4). Next about 100, then the rest of `match-pool-scope.md`.
- **Save each page once.** A club is never saved (its id and name come from match pages). A player is saved once, however many matches they start. Every link list leaves out what's already saved.
- **A match is playable when it's complete:** its match report, and the player page of all 22 starters. Only complete matches that pass the gate reach the database.
- **Nothing reaches the database without your approval**, and never `production` without your explicit instruction.

---

## 2. The loop

Every step is a dashboard button (§ 6) or the terminal command behind it.

| # | You do | Dashboard | Built in |
| --- | --- | --- | --- |
| 1 | Pick the next batch: a group, a competition, a season, or what the dashboard suggests | Progress view | S19 |
| 2 | Open its links in your browser, a few tabs at a time | **Open next links** (`uv run python -m extract.links open <list>`) | S06c, S19 |
| 3 | Save each page as **HTML only** into `data/inbox/`, under the file name shown (`manual-work.md` § How to save a page) | — | — |
| 4 | Import what you saved | **Import** (`uv run python -m extract.inbox`) | S06b |
| 5 | Read what's missing and what failed | Progress and failures views (`uv run python -m extract.progress`, `extract.check <page>`) | S06c, S19 |
| 6 | Repeat 2–5 one level down: listing pages → match reports → player pages | — | — |
| 7 | Build the dataset: resolve, aliases, score, gate, validate | **Build** | S08–S14 |
| 8 | Read duplicates, gate failures and validation errors; fix names in `data/curation/` | Failures view | S19 |
| 9 | Dry-run the load, read the counts, then load into `ingest` | **Dry run**, then **Load** | S15 |
| 10 | Play the new matches in the app | — | — |

## 3. Which links come from where

Links are found level by level, so a list can only hold what the level above has revealed (`link-map.md` § 1):

| Level | List | Known once | Size, whole pool |
| --- | --- | --- | --- |
| 1 | Listing pages | Now: written from the config (`extract.lists.listings`) | 247 |
| 2 | Match reports | Their listing page is saved | ~2,000 |
| 3 | Player pages | Their match report is saved; players already saved are left out | ~5,000–8,000 |
| 4 | Images (later) | The club or player is in the dataset | One per club and player |

---

## 4. The pilot

| Match | Why | Pages to save |
| --- | --- | --- |
| Bayern Munich – Valencia, 2001 Champions League final (`spielbericht/990248`) | `ucl` knockout, 5-4-1 against a diamond, extra time and a shootout | None: already saved |
| Italy – France, 2006 World Cup final (`spielbericht/53491`) | `world_cup`, national teams, extra time and a shootout, a red card | The match report |
| One Fenerbahçe – Galatasaray league derby (season picked in S07) | `league`, a derby, a matchday stage | 1 Süper Lig fixture list, the match report |

Plus the player pages of all 66 starters: **~70 pages in all**. The pilot's link lists are written by the phases that need them (S07, S11, S11b).

---

## 5. Mistakes and fixes

| You see | Do |
| --- | --- |
| The importer refuses a page as a challenge | Save it again once the site loads normally |
| A page saved twice | Nothing: the importer keeps one copy per id |
| A parse error on a page | Keep the page; ask for a fix. It's a selector change, tested on that page |
| A match fails the gate | The dashboard says why (a missing player page, a formation it can't read) |
| A wrong name, alias or club name | Fix it in `data/curation/`, then rebuild; never in code |

---

## 6. The dashboard (S19)

A local app: `npm run dashboard` opens it in your browser. It reads only local files and the `ingest` branch, and it's reachable only from your machine.

**Progress.** Counts and percentages (`23/1,000`, 2.3%) for every level: listing pages, match reports, player pages, complete matches, matches in the dataset, matches loaded, and images (after S18). Broken down by group, competition, season, era and club, and for the whole pool.

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
| A club or player with no image (after S18) | Images |

**Buttons:**

| Button | Does |
| --- | --- |
| Open next links | Opens the next few links of a list in your own browser, for you to save. It never fetches a page itself |
| Import | Runs the importer on `data/inbox/` |
| Build | Runs the dataset build |
| Check schema | Runs `db:check` |
| Dry run | Shows what a load would change, counts only |
| Load into `ingest` | Loads after a confirmation, only once a dry run has passed |

- **One action at a time.** Its output streams into the page, and the views refresh when it ends.
- **No `production` button.** Loading into `production` stays a terminal command with an explicit confirmation.
- **No scraping button.** Transfermarkt challenges code, so only you save its pages (`transfermarkt-source.md` § 8).

