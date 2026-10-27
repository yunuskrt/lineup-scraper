# Phase S13 — Guessability Gate

## Status

Complete

## Goals

- **Gate** `src/gate/gate.ts`, pure: every scored match (`data/work/scores/matches.json`, S10) is checked on **both** sides, since the backend may pick either. These are the play-time rules of `data-contract.md` § 9.2–9.3, ported by hand from `../lineup-backend/src/matches/squad-loader.service.ts` (`toLoadedSquad`) and `match-selector.service.ts` (`toCandidate`). They're read there, never imported. A side fails when:
  - it has no formation, or one that breaks `formationSchema` (`src/dataset/formation.ts`)
  - it doesn't have exactly 11 starters, in 11 distinct slots 0–10, with 11 distinct players
  - a slot's position isn't `positionForSlot(formation, slot)`
  - a starter has no player slug (S08b) or no alias (S12)
  - a starter has no alias of their own in that XI, so no guess can ever reveal them (decision D1)
  - and the match fails when one player starts for both sides
- **Guessability** per side, 0–1 (decision D2): the mean over the 11 starters of 1 when they have an alias of their own in the XI with no fuzzy neighbour (`similarity > FUZZY_THRESHOLD`, S12's port), 0.5 when every alias of their own has one, 0 when they have none (which already fails the gate)
- **The `sides` block, whole**: each side's `guessability` beside S10's `starPower`, validated against `sideSignalsBlockSchema` (`src/dataset/side-signals.ts`). A block that fails stops the run: the backend would turn it neutral silently (`data-contract.md` § 7.1)
- **Output** `data/work/gate/matches.json` (decision D3): one entry per scored match, sorted by slug, keys in alphabetical order: `{ failures, passed, sides, slug }`. `failures` names the side, the slot and the rule (`away slot 7: no alias`), never a player. S14 takes only the matches that passed, and their `sides`. A rerun is byte-identical
- **Report** `data/reports/gate.md` (local): passed and failed counts; failures by rule, then per match; guessability spread; pool matches still waiting for their match report (resolved, but not in `data/work/lineups/`). The terminal prints counts and paths only
- **`npm run gate`** (`src/gate/main.ts`): reads `data/work/lineups/matches.json` (S11), `data/curation/crosswalk/players.json` (S08b), `data/work/aliases/players.json` (S12), `data/work/scores/matches.json` (S10) and `data/work/resolved/matches.json`, each through Zod
- **Tests** (Vitest, beside the code, pure, no mocks): each failure rule on a built side; a player in both XIs; an unrevealable starter; guessability at 1, 0.5 and the mean; the `sides` block passes the backend schema, and a bad one stops the run; both sides checked when only one is bad; byte-identical output
- **Docs:** `CLAUDE.md` § Commands (`npm run gate`), `link-map.md` § 7 (`memorability_scores` guessability), `manual-work.md` row S13, `enrichment-guide.md` § 2 step 7 and § 5 (a match that fails the gate)

## Decisions

Settled at `/feature load`, 2026-10-28 (all three as proposed):

- **D1. An unrevealable starter fails the gate** (approved): if every alias of a starter is shared with another starter of the same XI, no guess ever reveals them, so the XI can't be completed: no draw, no perfect clear. HC 13 asks for **all 11** resolvable. The fix is an alias in `data/curation/aliases.json`, then a rerun. Alternative: pass it with guessability 0 for that starter
- **D2. Guessability from collisions, not fame** (approved): 1 / 0.5 / 0 per starter as above, so a clean XI is 1.0 and shared or near-identical names lower it. Fame is already `starPower` (S10); the backend averages the two (`data-contract.md` § 7.1). Alternative: 1.0 for every side that passes, so the duel pick rests on star power alone
- **D3. A gate file of its own** (approved): `data/work/gate/matches.json` holds the verdict and the whole `sides` block; S10's `scores` file stays as written, and S14 joins the two by slug. Alternative: rewrite S10's file with `guessability` added, which makes S10's output depend on S13's run

## Notes

- Scope: the verdict and guessability per scored match. The dataset (S14) leaves out what failed; the loader (S15) never writes it. Exclusions by hand stay in `data/curation/excluded-matches.json` (S07b); the gate never edits curation
- Depends on: S08b (player slugs), S10 (scores, `starPower`), S11 (lineups), S12 (aliases). Run `npm run lineups`, `npm run aliases` and `npm run scores` first
- Your part: **nothing**. When a match fails for an alias, the fix is yours to make in `data/curation/aliases.json`
- Pilot: S12 found no shared alias, fuzzy neighbour or unrevealable starter in the 6 XIs, and S11 mapped all 6 sides, so all 3 matches should pass with guessability 1.0 on both sides
- Constraints:
  - **HC 13:** a match enters the pool only if it passes both the threshold (S10) and this gate
  - **HC 17:** starters only; a substitute is never an answer
  - `data-contract.md` § 9.3: a match that breaks a play-time rule is served and then fails in front of a player. The gate is what stops that
  - § 2.9: no player starts for both sides; the database doesn't check it
  - Failures and logs name slugs, sides and slots, never a player's name or an alias
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`. A pilot run: 3 passed, 0 failed, guessability on all 6 sides; a second run changes no byte

**Deviations recorded during implementation**

- **`canClear` and `areNeighbours` moved into `src/aliases/similarity.ts`** (was private in S12's `xi.ts`): the gate and S12's XI check share one rule for near-identical names
- **`data/work/resolved/matches.json`** is read only for its slugs, to list the pool matches waiting for a match report
- A scored match with no lineup gets two empty sides, so it fails as `no formation` and `0 starters` rather than stopping the run
- Pilot run, 2026-10-28: 3 checked, 3 passed, 0 failed; guessability 1 on all 6 sides; 58 pool matches waiting for a match report; rerun byte-identical

## History
