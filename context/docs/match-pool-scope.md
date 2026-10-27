# Match Pool Scope

Which real matches end up playable, and how many. Read by S07, S08, S10, S11, S11b, S13, S14, S15, S18, S19 and S20.

**Decided on 2026-10-27:** the pool is a set of **curated match groups**, each kept whole. This replaces the earlier funnel (a ~25,000-match universe, scored, then cut to a shortlist), which needed far more hand-saved pages. Counts are estimates; S07 replaces them with real ones.

**This is the target, not the build.** The repo proves the pipeline on a 3-match pilot (S20, `enrichment-guide.md` § 4). The user then grows the pool towards this target in their own time: about 100 matches next, then the rest. The database holds whatever part is complete at the time.

---

## 1. The groups

| Group | Competitions | Seasons | Every match that… | About | Counted so far |
| --- | --- | --- | --- | --- | --- |
| **Derbies** | `league`, `ucl`, `uel` | 2000-01 to 2025-26 | Is a meeting of a pair in § 2.1 | ~370 | 4 |
| **Big-club league clashes** | `league` | 2000-01 to 2025-26 | Is a league match between two curated clubs (§ 2.2) of the same league, and isn't a derby | ~1,130 | 8 |
| **Champions League knockouts** | `ucl` | 2000-01 to 2025-26 | Is a quarter-final, semi-final or final, every leg | ~330 | 26 |
| **UEFA Cup / Europa League finals** | `uel` | 2000-01 to 2025-26 | Is the final | 26 | 0 |
| **World Cup knockouts** | `world_cup` | 2002, 2006, 2010, 2014, 2018, 2022 | Is a knockout match, the third-place match included | 96 | 16 |
| **Euro knockouts** | `euro` | 2000, 2004, 2008, 2012, 2016, 2020, 2024 | Is a knockout match | 73 | 7 |
| **Total** | | | | **~2,000** | **61** |

- **Counted so far** is `npm run pool` (S07b) on the 6 listing pages saved by 2026-10-27 (`it1-2000`, `tr1-2002`, `cl-2000`, `cl-2023`, `fiwc-2005`, `euro-2003`). It grows as you save the rest of `s07-listings`; `data/reports/pool.md` has the current counts.
- **Every match once.** A match in two groups (the 2011 Clásico semi-final) is one Transfermarkt id, so one slug and one row. Its groups are all recorded, for QA.
- **Groups are kept whole.** Every Fenerbahçe–Galatasaray league meeting from 2000-01 to 2025-26 is in, however dull. A match leaves the pool only through the gate (§ 4) or `data/curation/excluded-matches.json`.
- **Out of scope until the backend changes:** domestic cups (the Turkish Cup derbies, the Copa del Rey Clásicos), the Club World Cup and the Conference League need a new `competition_kind`. The **2026 World Cup** needs `start_year` 2026, which the database refuses. Euro 2020 was played in 2021, and the 2019–20 season ran into August 2020 (S04's `SEASON_EXCEPTIONS`).

---

## 2. Clubs and pairs

### 2.1 Derbies

| Derby | Clubs | League |
| --- | --- | --- |
| El Clásico | Real Madrid – Barcelona | La Liga |
| Manchester derby | Manchester United – Manchester City | Premier League |
| Derby della Madonnina | AC Milan – Inter | Serie A |
| Kıtalar Arası Derbi | Fenerbahçe – Galatasaray | Süper Lig |
| Le Classique | Paris Saint-Germain – Marseille | Ligue 1 |
| O Clássico | Porto – Benfica | Primeira Liga |
| Der Klassiker | Bayern Munich – Borussia Dortmund | Bundesliga |

The first six are the spec's rivalry list (`project-overview.md` § A); Der Klassiker covers the Bundesliga. A derby's European meetings count too (the Madonnina semi-finals of 2003 and 2023).

### 2.2 Curated clubs

| League | Clubs |
| --- | --- |
| Premier League | Manchester United, Manchester City, Liverpool, Chelsea, Arsenal, Tottenham Hotspur |
| La Liga | Real Madrid, Barcelona, Atlético Madrid |
| Serie A | AC Milan, Inter, Juventus |
| Bundesliga | Bayern Munich, Borussia Dortmund |
| Ligue 1 | Paris Saint-Germain, Marseille, Lyon |
| Primeira Liga | Porto, Benfica |
| Süper Lig | Galatasaray, Fenerbahçe, Beşiktaş |

22 clubs, 29 same-league pairs: the 7 derbies and 22 clash pairs. A pair only meets in seasons when both clubs are in the top flight (Juventus 2006-07, Atlético 2000–02 and Manchester City 2001-02 weren't). Opponents in the tournament groups are loaded as ordinary clubs.

---

## 3. Limits and floors

| Limit | Value | Why |
| --- | --- | --- |
| Total pool | **≤ 3,000** | Spec § Ingestion strategy: 1,500–3,000 |
| Match reports saved | One per pool match, ~2,000 | No buffer: the groups are fixed, not ranked |
| Any single club | Reported, not capped | The groups decide; the dashboard shows the share |

The dashboard (S19) shows every cell below its floor. A miss is a coverage gap; it is never filled with matches outside the groups. While the pool is still growing, most cells are below their floor, and that's expected.

| Cell | Floor |
| --- | --- |
| A curated club, per era bucket (2000–07, 2008–15, 2016–26) | ≥ 20 playable matches |
| A league, per season | ≥ 10 |
| A Champions League season | ≥ 7 |
| A World Cup or Euro | ≥ 7 |

At about 2,000 matches: ~44,000 lineup rows, an estimated 5,000–8,000 players, and their aliases.

---

## 4. Selection rules

1. **In:** every match of every group in § 1, plus `data/curation/pool-include.json` (hand-picked extras, e.g. a famous group-stage match).
2. **Out:** `data/curation/excluded-matches.json` (abandoned, awarded and walkover matches), and any match the gate (S13) drops because an XI can't be resolved.
3. **The score still exists.** The backend serves a match only if its `memorability_scores.score` clears `POOL_THRESHOLD` (45 for `world_cup`, `euro`, `ucl`; 60 for `league` and `uel`; data contract § 8). S10 scores every pool match from match data alone (no Wikipedia signal) and calibrates so every group match clears its threshold; the dashboard checks it. If calibration can't make a group clear, the threshold is retuned in the backend first, never worked around.

---

## 5. What each phase takes from this file

| Phase | Uses |
| --- | --- |
| S07 | § 1 and § 2: which listing pages to save, and the pool match list built from them |
| S08 | § 2: the curated clubs and their Transfermarkt ids |
| S10 | § 4.3: scores and calibration for every pool match |
| S11, S11b | The link lists: match reports for pool matches, then player pages for their starters |
| S13 | § 4.2: what the gate drops |
| S14, S15 | Only the pool and its clubs and players go into the dataset and the database |
| S19 | § 3: floors and coverage gaps, per group, competition, era bucket and club |
| S18 | Images for pool players and clubs only |
| S20 | The pilot: 3 matches from the groups (`enrichment-guide.md` § 4) |
