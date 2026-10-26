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

| # | You do | Command | Built in |
| --- | --- | --- | --- |
| 1 | Open the dashboard; pick the next batch (a group, a season, or the matches it suggests) | Dashboard | S19 |
| 2 | Get the link list for that batch: link, save-as file name, folder | Link lists | S06c, S07, S11, S11b |
| 3 | Save each page in your browser as **HTML only** into `data/inbox/` (`manual-work.md` § How to save a page) | — | — |
| 4 | Import what you saved | `uv run python -m extract.inbox` | S06b |
| 5 | Check: what's still missing, what failed to parse | Progress and check | S06c |
| 6 | Repeat 2–5 one level down: listing pages → match reports → player pages | — | — |
| 7 | Build the dataset: resolve, aliases, score, gate, validate | Dataset build | S08–S14 |
| 8 | Read the dashboard: duplicates, gate failures, validation errors | Dashboard | S19 |
| 9 | Dry-run the load, read the counts, then load into `ingest` | Loader | S15 |
| 10 | Play the new matches in the app | — | — |

---

## 3. Which links come from where

Links are found level by level, so a list can only hold what the level above has revealed (`link-map.md` § 1):

| Level | List | Known once | Size, whole pool |
| --- | --- | --- | --- |
| 1 | Listing pages | Now: written from the config | ~94–247 |
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
