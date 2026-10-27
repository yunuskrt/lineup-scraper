# Phase S12 — Alias Sets

## Status

Complete

## Goals

- **Alias stage** `src/aliases/` (`npm run aliases`): for every resolved player (`data/work/resolved/players.json`), an ordered alias list, built only from names on saved pages and in curation:
  1. The display name (`players.name`), always first
  2. The surname, from the display name (decision D1): its last word, or from a name particle on (`van der Vaart`, `Del Piero`). Not for a one-word display name: that name is already the mononym
  3. The match reports' other names (`aliasCandidates`, S08b): `Pirlo`, `Élber`, `Makélélé`. A name with a `.` is a truncation (`Kily Gonzá.`) and is dropped (decision D2)
  4. The full name from the player page (`fullName`, else `nameInHomeCountry`, S11b): `Arnaldo Ariel Ortega`, `William Sagnol`. Never the display name (`data-display-requirements.md` § 2)
  5. Curation additions (`data/curation/aliases.json`), then curation removals
- **Each alias kept once by its normalised form**, in the order above, so the first spelling wins (`Salihamidzic` before `Hasan Salihamidžić`). Raw text as written, NFC, diacritics kept; the database's `normalized` column is filled later from `normalizeName` (`src/names/normalize.ts`)
- **Dropped, never stored:** a name that normalises to `''` (non-Latin script, `Мирослав Стевић`), a truncation, a curation removal. Each is counted in the report. There's no automatic transliteration: a Latin form comes from the display name or curation
- **Curation file** `data/curation/aliases.json`, keyed by Transfermarkt player id, as `club-names.json` is (decision D3): `{ "7438": { "add": ["Kily"], "remove": [] } }`. A Zod schema in `src/aliases/`. It starts as `{}`: **no nickname is written from memory or by an LLM**; only you add them
  - The run fails, naming the path, on: an addition that normalises to `''`, a removal of the display name, or a malformed file
  - It warns on: an id that isn't a resolved player, an addition that is already an alias, a removal that matches nothing
- **Ported by hand** from `../lineup-backend/src/game/matcher.ts` (read it, never import it): `FUZZY_THRESHOLD` (0.82) and `similarity` (restricted Damerau–Levenshtein), with the `similarity` cases of `matcher.spec.ts`. In `src/aliases/similarity.ts`. Nothing else of the matcher is copied: the rules engine stays in the backend
- **XI checks**, over every side in `data/work/lineups/matches.json` (S11), all on normalised aliases. Reported, never fixed silently (decision D4):
  - **Shared aliases:** one alias owned by two starters of one XI (`squadCollisions` in `collisions.ts`, read only). At play time a bare shared surname never reveals either player
  - **Fuzzy neighbours:** an alias of one starter within `FUZZY_THRESHOLD` (`similarity > 0.82`) of another starter's alias in the same XI, so a typo could hit the wrong player
  - **Unrevealable starters:** a starter with no alias that's theirs alone in that XI. S13's gate decides what that costs; S12 only reports it
- **Output** `data/work/aliases/players.json`: `[{ aliases, slug, transfermarktId }]`, sorted by slug, keys alphabetical, 2-space JSON, trailing newline. Every player passes the S04 dataset rules for aliases (`src/dataset/schema.ts`): at least one, each normalising to a name, none normalising alike. A rerun with no new input is byte-identical
- **Report** `data/reports/aliases.md` (local, gitignored): aliases by source, dropped names by reason, curation warnings, and per XI (by match slug and side) the shared aliases, fuzzy neighbours and unrevealable starters. The terminal prints counts and paths only, never an alias
- **Tests** (Vitest, beside the code, no mocks): each source and its order; the surname rule (one word, particles, a hyphenated name); truncation and non-Latin drops; deduplication by normalised form keeping the first spelling; every curation error and warning; the ported `similarity` cases; shared aliases, a fuzzy neighbour and an unrevealable starter in a built XI; byte-identical output on a rerun
- **Docs:** `CLAUDE.md` § Commands (`npm run aliases`), `link-map.md` § 7 (`player_aliases`), `manual-work.md` row S12, `enrichment-guide.md` § 2 step 7 and § 5 (a wrong or missing alias)

## Decisions

Settled at `/feature load`, 2026-10-28 (all four as proposed):

- **D1. Surname rule** (approved): the last word of the display name, or from the first particle on (`van`, `von`, `der`, `den`, `de`, `del`, `della`, `di`, `da`, `dos`, `das`, `du`, `le`, `la`, `ter`, `ten`). The particle form only: `Del Piero`, never `Piero`, which is someone's first name. A hyphenated surname stays whole (`Thuram-Ulien`). Alternative: no derived surname; only the match report's short name. That would leave `Fabio Pinto` without `Pinto`, since his report shows his full display name
- **D2. Names with a `.` are dropped** (approved): the match report shortens long names (`Kily Gonzá.`) and may write initials (`N. Kanté`). Neither is how anyone types a name. Alternative: keep initials, drop only a trailing `.`
- **D3. Curation keyed by Transfermarkt id** (approved): as `club-names.json`, so an entry survives whatever the slug is. Alternative: by player slug, easier to read but tied to the crosswalk
- **D4. Collisions are reported, not removed** (approved): a player's aliases are theirs in every match, and the backend already refuses a shared surname inside an XI (B29). Removing `Harlow` from one player because of one XI would break it in every other match. Alternative: drop a surname shared inside any XI

## Notes

- Scope: player aliases only. Club aliases were built in S08a. The `normalized` column, the `player_aliases` rows and the loader are S14 and S15. Guessability scores and refusing a match are S13
- Depends on: S08b (`data/work/resolved/players.json`, `aliasCandidates`), S11 (`data/work/lineups/matches.json`), S11b (`fullName`, `nameInHomeCountry`). Run `npm run resolve` and `npm run lineups` first
- Your part: **nothing to save.** After the run you may read `data/reports/aliases.md` and add nicknames to `data/curation/aliases.json` (`Kily` for Kily González); none are needed for the pilot
- What the pilot shows (65 players, read from the saved pages):
  - 61 have a short name from the match reports; `Batista`, `Christian`, `Washington` are one-word display names (mononyms) and `Fabio Pinto`'s report shows his full name
  - 1 truncation (`Kily Gonzá.`), 1 Cyrillic full name (`135`)
  - Full names come from `Name in home country:` on 36 pages and `Full name:` on 6 (`link-map.md` § 4)
- Constraints:
  - **No LLM is a source for an alias** (HC 4): every alias is a name a saved page shows, or one you wrote into curation
  - Matching runs on `normalized` only, and `normalizeName` is the S04 port, byte-identical to the backend's (`data-contract.md` § 5). An alias normalising to `''` is invalid
  - The same normalised alias may belong to two different players (`data-contract.md` § 2.6); only inside one XI does it matter
  - `data-display-requirements.md` § 5 says to keep a non-Latin native spelling as an alias; that can't pass the contract (it normalises to `''`), so it's dropped. The contract wins
  - Manual decisions live in `data/curation/`, never in code. Every file read is parsed with Zod; errors name a path, never a value
  - Short names (`Kaka`, `Pepe`, `Xavi`) need exact aliases: the fuzzy threshold doesn't reach them (backend B28)
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`. A real run on the pilot: 65 players, each with at least one alias, the dropped names and XI findings in the report; a second run changes no byte

**Deviations recorded during implementation**

- **`playerAliasesSchema`** exported from `src/dataset/schema.ts` (was inline in `playerSchema`): the stage checks its output with the S04 rule itself
- **The dot rule (D2) applies to derived names too**, not only report names: a surname like `Jr.` (from `Neymar Jr.`) is dropped. The display name and curation keep their dots
- **Starters with no alias set** are listed apart from unrevealable ones, by spieler id
- Pilot run, 2026-10-28: 65 players, 164 aliases (name 65, surname 62, report 0, full name 37); 2 dropped (`Kily Gonzá.`, Stević's Cyrillic name); no shared alias, fuzzy neighbour or unrevealable starter in the 6 XIs; rerun byte-identical
- "report 0": every pilot short name equals the derived surname (`Pirlo`, `Élber`), so it's kept once, as the surname

## History
