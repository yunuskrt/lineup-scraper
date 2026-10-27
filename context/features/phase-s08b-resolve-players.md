# Phase S08b — Resolve Players

## Status

Complete

## Goals

- **Player crosswalk** `data/curation/crosswalk/players.json` (`spieler` id → slug), append only, as S08a's
- **Player sources**, every raw record that names a player id:
  - `transfermarkt-match`: starters, bench and event players (a substitute who scores needs a `players` row, `data-contract.md` § 2.10)
  - `transfermarkt-player`: the profile page, the only source of a display name
- **Display name** from the profile's `headline`, with the shirt number stripped (`#11 Raphinha` → `Raphinha`), diacritics kept (`data-contract.md` § 2.5). **A player with no saved profile page gets no slug yet:** they're listed as "waiting for a player page" (the S11b list), since a slug made from a match report's short name (`Kily Gonzá.`) would be permanent and wrong
- **Slug:** `normalizeName` of the display name, hyphenated (`raphinha`). On a clash with another id: `-<birth year>` from the profile's date of birth (`ronaldo-1976`), then `-<spieler id>` if that clashes too. Same format and reserved-prefix rules as S08a
- **Names seen elsewhere** (a match report's short name, the bench's full name) are kept with the player as alias candidates for **S12**, never as the display name
- **Output** `data/work/resolved/players.json`, sorted by slug, deterministic. `npm run resolve` gains the players; `data/reports/resolve.md` lists new player slugs, players waiting for a page, and clashes resolved by birth year or id
- **Tests** `src/resolve/players.spec.ts`, pure: the shirt number stripped; diacritics kept in the name and dropped in the slug; a waiting player gets no slug; a clash resolved by birth year, then by id; a crosswalk entry never changes; alias candidates collected from starters, bench and events; deterministic output. One run on the real raw records (3 match reports, 1 player page)

## Out of Scope

- Full name and caps from the profile page: **S11b** adds them to the parser
- Building aliases from the candidates: **S12**
- The player link list for you to save: **S11b**

## Notes

- Scope: players from the raw records into permanent slugs. TypeScript only.
- Depends on: **S08a** (the crosswalk store, the slug rules, `npm run resolve`).
- On the real store today: one profile page (`411295`, Raphinha) and 3 match reports. So one player gets a slug and the rest wait; that's expected until S11b's pages are saved.
- Constraints:
  - A slug is permanent: never assign one from a short or cut-off name
  - No player name from an LLM or from memory; names come only from saved pages
  - Errors and reports name ids and slugs, never an XI
- Verification: `npm test`, `npm run lint`, `npm run typecheck`. `npm run resolve` on the real store: `411295` → `raphinha`, every other starter of the 3 saved match reports listed as waiting; a second run changes no byte

**Deviations recorded during implementation**

- **Only pool matches' reports count** (the data rule "only the pool is loaded"). Today that's `990248` alone: `1153409` and `4126774` were S06b parser samples, not pool matches, and Raphinha (`411295`) plays in none. So the real run gives **0 player slugs and 22 starters waiting**, not the `411295` → `raphinha` the Verification line expected
- **Only starters need a saved page** (decided by the user, 2026-10-27). A substitute or event player with a saved page still gets a slug; one without stays unlinked (`match_events.player_id` may be `NULL`). Bench and event names are alias candidates
- **`extendCrosswalk` takes `fallbacks`**, tried before `<base>-<id>`; players pass `<base>-<birth year>`. Clubs are unchanged
- The latest saved copy of a page wins (`fetchedAt`), if a report or profile was imported twice
- `crosswalk/players.json` is guarded like the others; it's committed as `{}` until the first player page of a pool match is saved
- Output key `aliasCandidates` holds the other names; S12 builds the aliases from them
- `link-map.md` § 7 and `CLAUDE.md` § Commands name the player slugs
- Real run, 2026-10-27: 37 clubs, 61 matches, 0 players, **22 starters waiting** (the 2001 final's XIs); a second run changes no byte
- Test: a headline that is only a shirt number (`#9`) gave the slug `9`, because the strip pattern needed a space after the number. It now strips `#<n>` at the end too, so such a page is reported with no slug

## History

- 2026-10-27: player crosswalk and resolver; starters only need a page; 22 waiting on the pool
