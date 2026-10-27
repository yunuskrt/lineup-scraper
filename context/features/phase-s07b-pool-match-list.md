# Phase S07b — Pool Match List

## Status

Not Started

## Goals

- **Stage** `src/pool/`, run as `npm run pool`. It reads `data/curation/pool.json` (S07a), every raw `transfermarkt-fixture` record in `data/raw/`, and `data/curation/pool-include.json` and `excluded-matches.json` (created empty if absent). Every file is parsed with Zod
- **Group rules**, pure functions in `src/pool/groups.ts`, on club ids and stage codes only:
  - **Derbies:** home and away form a pair in `derbies`, in a `league`, `ucl` or `uel` competition, any stage
  - **Big-club league clashes:** a `league` match between two curated clubs of that league that isn't a derby
  - **Champions League knockouts:** a `CL` row whose stage starts with `QF`, `SF` or `FI`, every leg
  - **UEFA Cup / Europa League finals:** an `EL` row with stage `FI`
  - **World Cup and Euro knockouts:** a row whose stage starts with `Ro16`, `QF`, `SF` or `FI` (`FI 3rd` included)
- **Output** `data/work/pool/matches.json`: one entry per Transfermarkt match id, **every match once**, with `sourceId`, `competitionCode`, `seasonId`, `date`, `home` and `away` ids, `stage` and `round` as raw text, and `groups` (sorted; a match in two groups lists both). Sorted by date, then id; 2-space JSON, stable key order, trailing newline. A rerun with no new input is byte-identical
- **Conflicts** for one match id (two listing pages that disagree on date or teams) are reported and the match left out until fixed; they never merge silently
- **Report** printed and written to `data/reports/pool.md` (gitignored): matches per group, per competition and per season, from the listing pages saved so far, and each listing page of `s07-listings` not yet saved. Counts and ids only
- **Tests** `src/pool/*.spec.ts`, pure, no files: each group rule on hand-made rows (a derby in the Champions League, a clash that's also a derby, a non-curated opponent, a `QF 2` second leg, `FI 3rd`, a group-stage World Cup match left out); one match in two groups; include and exclude lists; a conflicting date reported; deterministic output. One run on the real raw records (the 8 S06b pages plus S07a's)
- **Docs:** `match-pool-scope.md` § 1 gains a "counted so far" column next to the estimates; `link-map.md` § 2 points at the stage

## Notes

- Scope: raw listing records in, the pool match list out. TypeScript only (`coding-standards-scraper.md` § The two languages: everything after the raw records is TypeScript).
- Depends on: **S07a** (`pool.json` and its schema).
- The match-report link list is **S11**: it reads `data/work/pool/matches.json`. Whether S11 writes it in Python with `write_link_list` or in TypeScript is decided there.
- From `match-pool-scope.md`: groups are kept whole (§ 1); every match once by its Transfermarkt id; only `excluded-matches.json` and the gate (S13) remove a match (§ 4). The fixture list's `result` isn't trusted for scores (`link-map.md` § 2), so it's carried as raw text, never parsed here.
- Constraints:
  - Join and filter on ids and stage codes only, never a team name
  - No date parsing beyond copying the ISO `date`; seasons stay `saison_id` values until S08 makes labels
  - Deterministic output; timestamps never in the file
- Verification: `npm test`, `npm run lint`, `npm run typecheck`. `npm run pool` on the real raw records: the pilot derby is in Derbies, the 2000–01 CL final (`990248`) in Champions League knockouts, the 2006 World Cup final (`53491`) in World Cup knockouts, and a second run leaves `matches.json` byte-identical

## History
