# Phase S08a — Resolve Competitions, Seasons, Clubs & Matches

## Status

Complete

## Goals

- **Crosswalk** `data/curation/crosswalk/`, committed, one file per entity: `competitions.json` (code → slug), `clubs.json` (`verein` id → slug), `matches.json` (`spielbericht` id → slug). **Append only:** a resolver run adds ids it hasn't seen and never changes or removes an entry (`coding-standards-scraper.md` § Data rules). A hand edit that changes an existing slug fails the run (the previous slugs are compared with the committed file)
- **Slug rules** `src/resolve/slugs.ts`, pure:
  - Built from `normalizeName` (`src/names/normalize.ts`) with spaces turned into `-`; must match `^[a-z0-9]+(-[a-z0-9]+)*$` and never start with a reserved prefix (`club-`, `nat-`, `comp-`, `match-`, `pl-`, `test-`; `data-contract.md` § 6.8)
  - **Competition:** from its display name (`Süper Lig` → `super-lig`)
  - **Club:** from its display name; on a clash with another id, the second gets `-<verein id>` (`arsenal-1234`)
  - **Match:** `<date>-<home club slug>-<away club slug>` (`2002-11-06-fenerbahce-galatasaray`); a club plays once a day, so it's unique
  - A name that normalises to `''` (a non-Latin name) is reported, never given a slug
- **Competitions and seasons** from `data/curation/pool.json`:
  - `kind` and display `name` as configured
  - **Season label** from `saison_id`: `2002` → `2002-03` for `league`, `ucl`, `uel`; `saison_id` + 1 for `world_cup` and `euro` (`fiwc-2005` → `2006`, `euro-1999` → `2000`); `start_year` its first four digits
  - Every pool match passes `matchSeasonIssue` (`src/dataset/season.ts`, with `SEASON_EXCEPTIONS`); a failure is reported and the match held back
- **Clubs** from every club id on the pool matches:
  - `kind`: `national_team` if it plays in a `world_cup` or `euro` competition, else `club`
  - **Display name:** `data/curation/club-names.json` if it names the id, else the Transfermarkt name seen most often (ties: alphabetical). Every other name seen becomes a `club_aliases` entry
  - **`shortName`:** 3 capitals (`data-display-requirements.md` § 2 and § 5). From `club-names.json` if set; else a default (decision D2), reported so it can be curated
- **Stage display text** `data/curation/stage-names.json`, a mapping file, and `src/resolve/stage.ts`:
  - Knockout codes: `FI` → `Final`, `FI 3rd` → `Third-place play-off`, `SF n` → `Semi-final`, `QF n` → `Quarter-final`, `Ro16 n` → `Round of 16`
  - Rounds: `6.Matchday` → `Matchday 6`; `Group A` stays `Group A`
  - The knockout code wins over the round (`Knockout stage`); an unmapped value is reported and left `null`, never guessed
- **Matches** from `data/work/pool/matches.json` (S07b): slug, season, date, stage display text, home and away club slugs, `transfermarktId`, and the pool groups. Scores, extra time and shootouts are **S11**
- **Output** `data/work/resolved/`: `competitions.json`, `seasons.json`, `clubs.json` (with aliases), `matches.json`. Deterministic: sorted by slug, 2-space JSON, stable key order, trailing newline; a rerun with no new input changes no byte, in the crosswalk or the output
- **Stage** `npm run resolve` prints counts and writes `data/reports/resolve.md`: new slugs, held-back matches, unmapped stage text, clubs on a default `shortName`, names with no slug. Ids and slugs only
- **Tests** `src/resolve/*.spec.ts`, pure: slug building and reserved prefixes; club slug clashes; the crosswalk keeps old slugs and refuses a changed one; season labels for all five kinds, Euro 2000 and the 2019–20 exception; stage text for every code and an unmapped one; club kind, display name ties and aliases; deterministic output
- **Docs:** `link-map.md` § 5 and § 7 point at the resolver and the curation files

## Decisions

Settled at `/feature load`, 2026-10-27 (all three as proposed):

- **D1. Slug formats** (approved), as in the goals: names for competitions and clubs (`-<id>` on a clash), `<date>-<home>-<away>` for matches. Seasons have no slug: they're keyed by competition and label (`data-contract.md` § 2.2)
- **D2. The default `shortName`** (approved): the first 3 letters of the normalised display name, upper case (`Kayserispor` → `KAY`, `Real Madrid` → `REA`). Every club on a default is listed in the report, and `club-names.json` overrides it. For the 22 curated clubs and the national teams, Claude proposes codes in `club-names.json` for you to approve (`GAL`, `FEN`, FIFA codes such as `ITA`); they're display labels, not source data
- **D3. Display names come from Transfermarkt plus curation** (approved). The setup plan said "a canonical source such as Wikidata"; Wikipedia and Wikidata left the pipeline on 2026-10-27, so Transfermarkt's own name is the default and `club-names.json` corrects it (`FC Bayern Munich` → `Bayern Munich`). Claude proposes the curated clubs' corrections and codes together during the build; **you approve `club-names.json` before the commit**

## Out of Scope

- Players, their slugs and the player crosswalk: **S08b**
- Scores, extra time, shootouts, events and lineups: **S11**
- Merging two ids that are one club: no case known yet; it would be a curation entry and a spec of its own
- Database rows: **S14** builds the dataset, **S15** loads it

## Notes

- Scope: everything the listing pages already tell about competitions, seasons, clubs and matches, turned into permanent slugs and display text. TypeScript only.
- Depends on: S07b (`data/work/pool/matches.json`), S07a (`pool.json`), S04 (`normalizeName`, `seasonIssue`, the slug rules in `src/dataset/schema.ts`).
- Constraints:
  - **Slugs are permanent** (`data-contract.md` § 6.8): the loader keys on them, so a changed slug is a new row that can never be deleted (§ 4)
  - Key on Transfermarkt ids; names are display text and aliases only
  - Raw text stays raw in `data/raw/`; display text is a curated mapping, never an LLM's output
  - Manual decisions live in `data/curation/` (`club-names.json`, `stage-names.json`, the crosswalk), never in code
- Verification: `npm test`, `npm run lint`, `npm run typecheck`. `npm run resolve` on the real store: 61 matches resolved, `1118844` → `2002-11-06-fenerbahce-galatasaray` with stage `Matchday 6`, `53491` with `Final` and season `2006`; a second run changes no byte

**Deviations recorded during implementation**

- **`poolMatchSchema`** (Zod, in `src/pool/build.ts`) replaces the `PoolMatch` interface, so the resolver parses `data/work/pool/matches.json` instead of trusting it
- **Club names come from fixture rows and match reports** (every `transfermarkt-fixture` and `transfermarkt-match` record), counted per id
- **Only competitions with a pool match are resolved** (5 today); the rest get slugs when their first match arrives
- **A slug that can't be assigned** (reserved prefix, non-Latin name, or still taken after `-<id>`) is reported under "No slug": add it to the crosswalk by hand, which is allowed since it's a new entry
- **The permanence guard compares with `git show HEAD:`**, so it starts working once the crosswalk is first committed; before that, an uncommitted crosswalk can still be regenerated
- A pool match with no date or no `saison_id` is held back: its slug needs a date
- The default `shortName` uses letters and digits only (`Beşiktaş JK` → `BES`)
- **Approved by the user, 2026-10-27:** `club-names.json` as proposed for the 18 curated clubs with ids and the 19 national teams' FIFA codes; the 3 other opponents named `Valencia`, `Deportivo La Coruña`, `Leeds United` (`VAL`, `DEP`, `LEE`); in `pool.json` the competitions `UEFA Champions League` → `Champions League` and `European Championship` → `Euro`, so their slugs are `champions-league` and `euro`. The uncommitted crosswalk was regenerated from these names
- Real run, 2026-10-27: 5 competitions, 6 seasons, 37 clubs (18 clubs, 19 national teams), **61 matches, 0 held back, 0 unmapped stages, 0 default codes**; the derby is `2002-11-06-fenerbahce-galatasaray`, the 2001 final `2001-05-23-bayern-munich-valencia`; a second run changes no byte
- Review: the guard reads `git show HEAD:./<path>`, so the path is relative to the working folder, not the repo root
- Review: a round pattern in `stage-names.json` that isn't a valid regular expression is refused when the file is read, not when a match hits it
- Review: a malformed match-record line fails naming its file and line; crosswalk keys are checked with `Object.hasOwn`

## History

- 2026-10-27: crosswalk for 5 competitions, 37 clubs, 61 matches; club names approved
