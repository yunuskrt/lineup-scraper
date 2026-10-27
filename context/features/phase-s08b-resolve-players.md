# Phase S08b — Resolve Players

## Status

Not Started

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

## History
