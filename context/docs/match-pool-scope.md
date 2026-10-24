# Match Pool Scope

Which real matches end up playable, and how many. Read by S07, S09, S10, S11, S13, S14, S15, S16 and S18.

Every count here is **provisional**. S10 tunes the budgets on real scores, S16 checks them, and changes are recorded in this file.

---

## 1. The funnel

Collecting every match ever played gives a pool nobody wants to play: a scoreless mid-table draw kills the session (spec § A). The funnel narrows it in four steps, and only the last step reaches the database.

| Step | Phase | Size (about) | Where it lives |
| --- | --- | --- | --- |
| **Universe:** match metadata for the curated scope (§ 2) | S07 | 25,000–30,000 | `data/raw/`, `data/work/` (gitignored) |
| **Scored:** every universe match gets a memorability score | S09, S10 | 25,000–30,000 | `data/work/` |
| **Shortlist:** the budgeted top of each stratum (§ 3), plus a 20% buffer | S10 | ~3,000 | `data/work/` |
| **Pool:** shortlisted matches whose XIs both pass the gate | S11, S13 | **2,000–3,000** | `data/dataset/` (committed), Postgres, bucket |

- **Only the pool is loaded.** The loader never deletes a match (data contract § 4), so a match loaded by mistake stays in the database forever. The universe never leaves the work files.
- **Only pool entities are loaded:** the clubs that play in pool matches, the players in pool XIs, and goal scorers in pool matches. Images (S18) are fetched and uploaded for those players and clubs only.
- **Start at the low end, then grow.** Adding matches later is cheap. Removing them isn't: a loaded match can only be unscored, never deleted.

---

## 2. Scope: the universe

### Competitions

| Competition | Kind | Seasons | Universe |
| --- | --- | --- | --- |
| Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Süper Lig | `league` | 2000-01 to 2025-26 | Matches with **at least one curated club** (§ 2.2) |
| UEFA Champions League | `ucl` | 2000-01 to 2025-26 | Every match |
| UEFA Cup / Europa League | `uel` | 2000-01 to 2025-26 | Matches with at least one curated club, plus every final |
| FIFA World Cup | `world_cup` | 2002, 2006, 2010, 2014, 2018, 2022 | Every match |
| UEFA European Championship | `euro` | 2000, 2004, 2008, 2012, 2016, 2020, 2024 | Every match |

- The leagues follow the spec's rivalry list (El Clásico, the Manchester derby, the Derby della Madonnina, the Kıtalar Arası Derbi, Le Classique, O Clássico), plus the Bundesliga.
- **Out of scope until the backend changes:** domestic cups, the Club World Cup and the Conference League (new `competition_kind` values), and the **2026 World Cup** (the database refuses `start_year` 2026). Euro 2020 was played in 2021 and the 2019–20 season ran into August 2020; see setup doc § 11, decision 8.
- S02 can narrow this. If the 2000s have no usable lineups, the season range changes in the backend contract first (spec § Ingestion strategy).

### Curated clubs

**Proposal, confirmed in the S07 spec.** The spec says about 24 clubs.

| League | Clubs |
| --- | --- |
| Premier League | Manchester United, Manchester City, Liverpool, Chelsea, Arsenal, Tottenham Hotspur |
| La Liga | Real Madrid, Barcelona, Atlético Madrid |
| Serie A | AC Milan, Inter, Juventus |
| Bundesliga | Bayern Munich, Borussia Dortmund |
| Ligue 1 | Paris Saint-Germain, Marseille, Lyon |
| Primeira Liga | Porto, Benfica |
| Süper Lig | Galatasaray, Fenerbahçe, Beşiktaş |

The curated list decides the league universe. Opponents are loaded as ordinary clubs when one of their matches makes the pool.

---

## 3. Budgets: how many matches each part gets

A single global "top N by score" would crowd out the 2000s, the smaller leagues and the group stages. The shortlist is picked **per stratum**: each competition-season gets its own budget and takes its own top-scoring matches.

| Competition | Universe | Pool budget | Per season or tournament | Always in (§ 4) |
| --- | --- | --- | --- | --- |
| World Cup | ~384 | **~200** | ~33 of 64 | Every knockout match |
| Euro | ~277 | **~150** | ~21 | Every knockout match |
| Champions League | ~3,500 | **~650** | ~25 | Quarter-finals, semi-finals, final |
| UEFA Cup / Europa League | ~1,500 | **~100** | ~4 | Final |
| Leagues (7) | ~20,000 | **~1,400** | ~2.5 per curated club per season | Title deciders and derbies between curated clubs, if they score well enough (§ 4) |
| **Total** | **~25,000** | **~2,500** | | |

Tournaments get a much larger share of their universe than leagues. That is the spec's lower tournament threshold, expressed as a budget.

### Floors: not too few

The pool has to stay big enough that the player filters (competition, club, era) don't run dry or repeat quickly. S16 reports every cell below its floor.

| Cell | Floor |
| --- | --- |
| A curated club, per era bucket (2000–07, 2008–15, 2016–26) | **≥ 20** playable matches |
| A league, per season | ≥ 10 |
| A Champions League season | ≥ 15 |
| A World Cup or Euro | ≥ 15 |

When a cell misses its floor because of source coverage, not scores, S16 reports it as a coverage gap. It is never filled with low-scoring matches.

### Ceilings: not too many

| Limit | Value | Why |
| --- | --- | --- |
| Total pool | **≤ 3,000** | Spec § Ingestion strategy: 1,500–3,000 |
| Lineup pages fetched | ≤ ~3,600 (pool plus the 20% buffer) | Polite crawling stays a few sessions, not weeks |
| Any single club | ≤ 8% of the pool | Keeps the backend's stratified sampling meaningful |

At about 2,500 matches: ~55,000 lineup rows, 10,000–15,000 players, ~50,000 aliases, and a few hundred MB of images at the web's display sizes.

---

## 4. Selection rules

1. **Always in**, inside the budget: the matches marked "Always in" in § 3, any match with its own Wikipedia article or a nickname (S09), and `data/curation/pool-include.json`.
2. **Never in:** `data/curation/excluded-matches.json` (abandoned, awarded and walkover matches go here), and any match the gate drops.
3. **The rest of each budget** goes to the highest scores in that competition-season, with a cap per club inside it so one club can't fill a season.
4. **Buffer:** S10 shortlists budget + 20% per stratum, and S11 fetches lineups for all of them. When S13 drops a match, the next one in that stratum takes its place. A cell never has to go back to the source.
5. **The score agrees with the selection.** The backend serves only matches at or above `POOL_THRESHOLD` (45 for `world_cup`, `euro`, `ucl`; 60 for `league` and `uel`; data contract § 8). S10 calibrates scores so every pool match clears its threshold and the rest of the universe doesn't. S16 checks it. If calibration can't make that hold, the threshold is retuned in the backend first, never silently worked around.

---

## 5. What each phase takes from this file

| Phase | Uses |
| --- | --- |
| S07 | § 2: the competitions, seasons and curated clubs, so metadata covers the universe and nothing beyond it |
| S09 | § 4.1: article and nickname lookups feed "always in" |
| S10 | § 3 and § 4: the budgets, floors, the per-club cap, the buffer and the calibration |
| S11 | Fetches lineups for the shortlist and its buffer only |
| S13 | Refills from the buffer, per stratum |
| S14, S15 | § 1: only the pool and its clubs and players go into the dataset and the database |
| S16 | § 3: floors, ceilings and coverage gaps, per competition, era bucket and club |
| S18 | § 1: images for pool players and clubs only |
