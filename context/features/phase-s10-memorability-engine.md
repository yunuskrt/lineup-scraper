# Phase S10 — Memorability Engine

## Status

Complete

## Goals

- **Pool rules, ported by hand** from `../lineup-backend/src/matches/pool-rules.ts` (read it, never import it): `ERA_BUCKETS`, `POOL_THRESHOLD` (`league` 60, `tournament` 45) and the pool's `TOURNAMENT_KINDS` (`world_cup`, `euro`, `ucl`), in `src/score/pool-rules.ts`. Values only; a retune is a backend change first (`data-contract.md` § 8)
- **Signals** `src/score/signals.ts`, pure, each 0–1, from match data only (decision D2):
  - **stage**, from the resolved stage text: `Final` 1.0, `Semi-final` 0.8, `Quarter-final` 0.6, `Round of 16` 0.5, `Third-place play-off` 0.4, a group 0.3, a league matchday 0.2
  - **rivalry**, from the match's groups: `derbies` 1.0, `clashes` 0.5, otherwise 0
  - **drama**, a weighted mean of: goals (`min(total, 6) / 6`), a comeback (the side behind at half time didn't lose), extra time, a shootout, a winner at 90' or later, red cards (`min(count, 2) / 2`) and a hat-trick (a player with 3 goals, own goals excluded). Each part is kept under `signals.raw`
  - **starPower**, per side the mean over its 11 starters of `min(caps, 100) / 100`, caps read from `capsGoals` (`86 / 0` → 86; `null` → 0); the match's value is the mean of both sides (decision D3)
- **Score** `src/score/score.ts` (decision D1):
  - `raw = 0.30 stage + 0.15 rivalry + 0.35 drama + 0.20 starPower` (D2)
  - Normalised **within each era bucket** (season start year: 2000–07, 2008–15, 2016–26): the raw score's percentile among that bucket's scored matches, ties sharing a rank; a bucket of one gets 0.5
  - `score = floor + (100 − floor) × percentile`, where `floor = POOL_THRESHOLD + 5` for the match's class: 50 for `world_cup`, `euro`, `ucl`; 65 for `league` and `uel`. **Every group match clears its threshold by construction** (`match-pool-scope.md` § 4.3)
  - Rounded to 2 decimals
- **Output** `data/work/scores/matches.json`: one entry per match in `data/work/lineups/matches.json` (S11), keyed by slug and sorted by it, fields in alphabetical order:
  - `algorithmVersion`: `s10-v1`
  - `computedAt`: decision D4
  - `score`: 0–100
  - `signals`: `{ stage, rivalry, drama, starPower, eraBucket, percentile, rawScore, raw: { goals, comebackFromHt, extraTime, shootout, lateWinner, redCards, hatTrick }, sides: { home: { starPower }, away: { starPower } } }`
  - S13 adds `guessability` beside each side's `starPower`; the full `sides` block is validated against `src/dataset/side-signals.ts` when S13 writes it
  - A rerun with no new input is byte-identical
- **Report** `data/reports/scores.md` (local): per group and per competition kind, the count, the lowest, median and highest score, and the threshold each must clear; per era bucket, the count, with a bucket under 10 matches flagged (its scores move as the pool grows); starters with no player page, counted at 0 caps. The terminal prints counts and paths only
- **`npm run scores`** (`src/score/main.ts`): reads `data/work/resolved/matches.json`, `competitions.json` and `players.json` (S08), `data/work/lineups/matches.json` (S11) and the player pages (S11b), each through Zod
- **Tests** (Vitest, beside the code, pure, no mocks): each stage text; rivalry by group; each drama part on built events (a comeback, a 90'+ winner, an extra-time winner, a hat-trick with an own goal left out, red cards capped at 2); caps parsing; star power per side; percentiles with ties and a bucket of one; floors per class; every score clears its threshold; byte-identical output
- **Docs:** `CLAUDE.md` § Commands (`npm run scores`), `link-map.md` § 7 (`memorability_scores`), `manual-work.md` row S10, `enrichment-guide.md` § 2 step 7

## Decisions

Settled at `/feature load`, 2026-10-28 (all four as proposed):

- **D1. Score shape: a floor plus a within-era percentile** (approved): `score = (threshold + 5) + (100 − (threshold + 5)) × percentile`. The groups are kept whole, so every pool match must clear; the score only orders matches inside the pool, and the backend never sorts by it. The +5 keeps a small retune of the threshold from dropping matches. Alternatives: a floor of the threshold exactly; or no percentile, raw score scaled to the band (stable as the pool grows, but not era-normalised)
- **D2. Signals and weights** (approved): stage 0.30, rivalry 0.15, drama 0.35, star power 0.20. **Stakes and footprint are left out:** stakes (title-deciders, aggregate swings) needs standings or both legs, which no saved page gives yet; footprint came from Wikipedia, dropped with S09. Alternative: a stakes proxy from knockout legs, once both legs of a tie are saved
- **D3. Star power from caps** (approved): per side the mean of `min(caps, 100) / 100` over its XI; a starter without a player page counts 0 and is reported (S13 gates that match anyway). Caps run high for retired players and are still growing for current ones; the era percentile in D1 evens that out. Alternative: count starters with 50 caps or more
- **D4. `computedAt` is the newest `fetchedAt` among the run's inputs**, the same for every match (approved): a rerun with no new page stays byte-identical, and when a page arrives every score may move (the percentiles are shared), so every `computedAt` moves with it. Timestamps come from the source, never the clock (`coding-standards-scraper.md` § Data rules). Alternative: per match, its own report and player pages

## Notes

- Scope: the score and its signals, per match with a saved match report. Guessability, the gate and refusing a match are S13; the dataset file and loading `memorability_scores` are S14 and S15
- Depends on: S08 (resolved matches, competitions, players), S11 (lineups and events), S11b (`capsGoals`). Run `npm run resolve` and `npm run lineups` first
- Your part: **nothing**
- Pilot: the 3 matches are all in the 2000–07 bucket. `2001-05-23-bayern-munich-valencia` (`ucl` final, extra time, shootout) and `2006-07-09-italy-france` (`world_cup` final, extra time, shootout, a red card) are tournament matches, so they score between 50 and 100. `2002-11-06-fenerbahce-galatasaray` (a derby, 6–0, two red cards) is a league match, so it scores between 65 and 100
- Constraints:
  - **`memorability_score` is never shown to players** (HC 20); it only gates the pool. The report stays local
  - Scores are 0–100 (`memorability_scores_score_check`); `algorithm_version` is non-blank and bumps on any change to a weight, a signal or the floor
  - `data-contract.md` § 8 expects "a dull league match well below 60"; the groups decision of 2026-10-27 (`match-pool-scope.md` § 4.3) supersedes it: every group match clears, and the score orders them. If that can't hold, the threshold is retuned in the backend first, never worked around
  - Pure functions, files in and files out; no LLM output as data (HC 4)
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`. A pilot run: 3 scores, each clearing its threshold, the report's groups and buckets; a second run changes no byte

**Deviations recorded during implementation**

- **Drama weights** (tuned values, `s10-v1`): goals 0.25, comeback 0.20, extra time 0.10, shootout 0.15, late winner 0.15, red cards 0.10, hat-trick 0.05
- **`players.json` isn't read:** caps are keyed by spieler id straight from the player pages, as the lineups' starters are
- **A late winner needs every goal's minute:** if the goal events with a minute don't add up to the score, it's `false`, never a guess
- **Sides with no XI** (a side S11 couldn't map) are listed in the report: their star power is 0, so it isn't hidden among the missing pages
- Signal values are rounded to 4 decimals and the score to 2, so a rerun is byte-identical
- Pilot run, 2026-10-28, all in 2000–07: `2001-05-23-bayern-munich-valencia` 100 (a comeback from 0–1 at half time), `2006-07-09-italy-france` 75, `2002-11-06-fenerbahce-galatasaray` 65 (lowest raw score, so the league floor; clears 60); `computedAt` 2026-10-27T14:57:30Z; rerun byte-identical

## History
