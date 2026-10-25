# Phase S04 — Dataset Schema

## Status

Not Started

## Goals

Every file below is **ported by hand** from `../lineup-backend/`, never imported. "Verbatim" means the same code and the same test cases; only import paths change.

- **`src/names/normalize.ts`**: `normalizeName`, verbatim from `src/game/normalize.ts` (data contract § 5). **`normalize.spec.ts`**: every test vector in § 5, from `src/game/normalize.spec.ts`, plus its two properties (NFD and NFC give the same output; idempotent and in shape)
- **`src/dataset/constants.ts`**: `SQUAD_SIZE` (11), `FIRST_SEASON_START` (2000) and `LAST_SEASON_START` (2025), from `src/contract/constants.ts`. Only these three
- **`src/dataset/enums.ts`**: `competitionKindSchema`, `positionGroupSchema`, `sideSchema` and `isoDateSchema` from `src/contract/common.ts`, without the OpenAPI `register` calls. Add `clubKindSchema` (`club`, `national_team`) and `matchEventKindSchema` (`goal`, `own_goal`, `penalty_goal`, `red_card`) from the Prisma enums
- **`src/dataset/formation.ts`**: `formationSchema` from `src/contract/match.ts` and `positionForSlot` from `src/game/formation.ts`, both verbatim. **`formation.spec.ts`**: the backend's `positionForSlot` cases, plus the formation strings in data contract § 6.5 (`4-4-2`, `4-2-3-1`, `3-5-2`, `4-1-2-1-2` and `5-3-2` valid; `4-4-1`, `4-6`, `4-1-1-1-1-2`, `10-0` and `4-4-3` invalid)
- **`src/dataset/season.ts`**: `seasonIssue`, ported from `scripts/seed/seed-data.schema.ts`, with **`SEASON_EXCEPTIONS`**: a short, documented list of widened date windows (see § Decisions). **`season.spec.ts`**: the seed's `seasonIssue()` cases, plus each exception and the dates just outside it
- **`src/dataset/side-signals.ts`**: `sideSignalsBlockSchema`, verbatim from `src/matches/side-signals.ts` (data contract § 7.1)
- **`src/dataset/schema.ts`**: **`datasetSchema`**, ported from `seedDataSchema` and extended per data contract §§ 2 and 6 (see § Shape and § Rules). It exports the input and output types
- **`src/dataset/issues.ts`**: `formatDatasetIssues(error)`, which prints one line per issue as the path and a message, **never the value**, like `formatEnvIssues`
- **`src/dataset/schema.spec.ts`**: the seed spec's `rejects` cases and alias cases (`''`, `'   '`, `'-—–'`, `'Аршавин'` rejected; a raw alias the pipeline can normalise accepted; a shared surname on two players accepted). Plus one rejection per rule in § Rules, a valid two-match fixture built in the test, and a check that issue text never contains the bad value

## Shape

`datasetSchema` validates the **assembled** dataset: one object with four arrays. S14 decides how it's split into files under `data/dataset/`. Seasons aren't a list; they're implied by `(competitionSlug, season)` on each match. Natural keys are named `slug`, and references are `<thing>Slug`.

```text
competitions[]  slug, kind, name
clubs[]         slug, kind, name, shortName, crestKey | null, aliases[] (raw text, may be empty)
players[]       slug, name, imageKey | null, aliases[] (raw text, at least one)
matches[]       slug, competitionSlug, season, date, stage | null, nickname | null,
                homeClubSlug, awayClubSlug, score { home, away },
                extraTime, shootout { home, away } | null,
                home { formation, lineup[11] { playerSlug, slot, position } },
                away { … same … },
                events[] { kind, minute, addedTime | null, side, playerSlug | null },
                memorability { score, signals, algorithmVersion, computedAt }
```

- A match is in the dataset only if it's in the pool (`coding-standards-scraper.md` § Data rules). So `formation`, the two lineups and `memorability` are **required** here, though nullable or separate in the database. That is what makes every rule in data contract § 9.3 hold for both sides
- `aliases` holds raw text. The loader fills `player_aliases.normalized` with `normalizeName(alias)`, as the seed does

## Rules

Each is a Zod check with a path and a fixed message. The database mirror is named in brackets.

| Area | Rule |
| --- | --- |
| Text | Every display string and alias is non-blank (`btrim <> ''` CHECKs) and already NFC (display doc § 5) |
| Slugs | `^[a-z0-9]+(-[a-z0-9]+)*$`; unique per list; no reserved prefix `club-`, `nat-`, `comp-`, `match-`, `pl-` or `test-` (contract § 6.8) |
| References | Every `competitionSlug`, club slug and `playerSlug` exists in its list |
| Club | `kind` set explicitly. `shortName` matches `^[A-Z0-9]{3}$`. `crestKey`, if set, is a key and not a URL (no `://`, no leading `/`). Club aliases are unique per club, compared exactly (`club_aliases_club_id_alias_key`) |
| Player | At least one alias, each normalising to a non-empty name; no two aliases of one player normalise alike (`player_aliases_player_id_normalized_key`). `imageKey` has the same key rule as `crestKey` |
| Season | Label `^[0-9]{4}(-[0-9]{2})?$`; start year 2000–2025; consecutive years (`seasons_*` CHECKs); `seasonIssue` date window with `SEASON_EXCEPTIONS` |
| Match | `date` is ISO; `homeClubSlug ≠ awayClubSlug` (`match_teams_match_id_club_id_key`); goals ≥ 0; shootout both-or-neither, ≥ 0, never level (`matches_shootout_check`) |
| Club kind | `world_cup` and `euro` matches are between `national_team` clubs; every other kind is between `club` clubs (contract § 6.3) |
| Side | `formationSchema` (`match_teams_formation_check`); exactly 11 entries, unique slots 0–10 and unique players (`lineups_*` keys); **`position === positionForSlot(formation, slot)` for every slot**, which covers `lineups_goalkeeper_check` |
| Both sides | No player starts for both sides (contract § 2.9) |
| Events | `minute` 1–120; `addedTime` null, or 1–30 with `minute` in 45, 90, 105 or 120 (`match_events_*` CHECKs); `playerSlug`, if set, exists |
| Memorability | `score` 0–100; `algorithmVersion` non-blank; `computedAt` an ISO datetime; `signals` an object that passes `sideSignalsBlockSchema`, other keys kept (contract § 7.1) |

## Decisions

1. **`shortName` is `^[A-Z0-9]{3}$`, a hard rule.** The display doc wants 3 capitals, and a hard rule means S08 can't drift
2. **Season exceptions** (setup doc § 11, decision 8; source trial follow-up):
   - **2019–20 club seasons** (`league`, `ucl`, `uel`) run to **2020-08-31**, not 2020-06-30. The UCL final was on 23 August 2020
   - **Euro 2020** keeps the label **`2020`** and allows dates from **2021-06-01 to 2021-07-31**. Mackolik files it as `2021`; S07 maps that to `2020`
   - **The 2026 World Cup stays out.** `start_year` 2026 is refused by the database, and changing that is a backend migration and contract change first
3. **Goal events aren't checked against the score.** Sources may miss an event, and a hard rule would drop whole matches. S16 reports mismatches instead

## Out of Scope

- File layout, sorting, the manifest and writing `data/dataset/`: **S14**. The schema validates an object; it doesn't read or write files
- Raw records and JSON Schema: **S05**
- Thresholds, `ERA_BUCKETS` and the pool decision: **S10** and **S16**. The schema doesn't check that `score` clears `POOL_THRESHOLD`
- A display-name length limit (about 20 characters): a QA warning in S16, not a schema error
- Any database access. `datasetSchema` is pure

## Notes

- Scope: the scraper's own copy of every rule the database and the backend's play-time loader enforce on content, as pure Zod and functions with unit tests. Later stages (S08, S12–S15) build objects that must pass it.
- Depends on: S03 (Zod, the TS layout). It reads `prisma/schema.prisma` only to copy the enum values.
- Constraints:
  - **`normalizeName` is byte-identical to the backend's.** Port the code and every vector unchanged; a backend script compares the two after each load (contract § 5)
  - **`position` is derived, never copied.** The schema refuses any position that disagrees with `positionForSlot` (contract § 6.6, § 9.3)
  - Substitutes never appear in `lineup` (HC 17). They can appear in `events` and in `players`
  - Issues name a path and a fixed message, never a value: no player name, alias or XI in an error (contract § 1.7)
  - No schema change is needed. The 2026 World Cup and any new `competition_kind` are backend phases first
  - Comments are rare, a single line, at most 50 characters
- Verification:
  - `npm test`: every `normalizeName` vector, the `positionForSlot` and formation cases, the `seasonIssue` cases with exceptions, one rejection per row of § Rules, and the valid fixture
  - `npm run lint`, `npm run typecheck`, `npm run format:check`. The Python checks stay green, since nothing in Python changes
  - Diff `src/names/normalize.ts` against `../lineup-backend/src/game/normalize.ts`: the only differences are import paths

**Deviations recorded during implementation**

- `seasonIssue` is verbatim; `matchSeasonIssue(kind, label, date)` applies `SEASON_EXCEPTIONS` first, so the Euro-only rule can key on `euro`
- Every object is strict, so an unknown or mistyped key fails. `signals` is the exception: it's loose, to keep its per-signal keys
- The seed's "GK belongs in slot 0 only" became "Position must match the formation", which covers it; "Duplicate id" became "Duplicate slug"
- `side-signals.ts` ports the schema only. The backend's `readSideSignals` is a runtime reader and is not needed here
- `normalize.ts` is byte-identical to the backend's, since it has no imports

## History
