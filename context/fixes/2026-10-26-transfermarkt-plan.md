# Fix — Transfermarkt Source: Migration Plan

## Status

Not Started

## Goals

This fix does **two jobs**. /feature applies the first now; the second is guidance that later `/todo spec` runs read.

**Applied by this fix** (items P2, P8 and the `todo.md` lines; details in § Changes):

- **Replace the S05 Mackolik raw kinds with Transfermarkt kinds**: `src/raw/transfermarkt-fixture.ts`, `src/raw/transfermarkt-match.ts`, `src/raw/transfermarkt-player.ts`; `SOURCES = ['transfermarkt']`; a new `RAW_KINDS` registry; regenerated `schemas/raw/*.schema.json`; new fictional examples. Every S05 test and rule still holds
- **Remove the Mackolik code** listed in P8, with git history as the archive
- **Update `context/todo.md`** lines S06, S07 and S11 to name Transfermarkt
- **Record a deviation** in `context/features/phase-s05-raw-record-contract.md` § Notes: the kinds were replaced by this fix

**Guidance for later phases** (not implemented here): P0 is done in `lineup-backend` by the user; P1 and P3–P7 are read by `/todo spec` when it writes S06, S07, S08, S11 and S18.

Companion fix: `context/fixes/2026-10-26-transfermarkt-context.md`, which creates `context/docs/transfermarkt-source.md`. Apply it first: this plan cites that doc's sections.

## Background and decision

- **2026-10-26: Transfermarkt replaces Mackolik as the source.** Mackolik has no formation or positions in any year (`context/docs/source-trial.md:20`). The data contract can't play a match without a formation (`context/docs/data-contract.md` § 9.2); slot positions derive from it (§ 6.6). Transfermarkt has both, back to 2000–01. The full evidence is in the context fix's § Evidence (live probes T1–T9, and the old dataset).
- **The shared spec changes first** (P0). `context/project-overview.md:173` says Transfermarkt is "never scraped programmatically (ToS)". Until the backend changes that row and the file is copied here, no spider runs against Transfermarkt.
- **Refetch fresh.** The old repo's 9,202 cached match pages aren't imported. They use the 2024 layout, cover 2002/2007–2024 only, and are filtered to "big-team" matches (reference § 3.4).
- **Ids:** Transfermarkt numeric ids as `sourceId`, mapped to slugs by S08's crosswalk. Not `uuid3` (reference § 7.1), because a URL's text part can be renamed while its number stays.
- **What this repo stores** is set by `context/docs/data-contract.md` § 2. The old repo's coaches, stadiums, attendance, referees, heights and feet have no column here, so the manager pipeline (reference § 5.2), the team-page stadium (§ 5.3) and the Mongo load (§ 11) aren't ported.

**Reference:** `context/docs/legacy_transfermarkt_scraper_reference.md`, cited as "ref § N". **Old repo:** `/Users/yunuskerestecioglu/Desktop/LINEUP old/lineup-scraper` (read-only), cited as "old `path:line`".

## Evidence: current state of this repo

- **No collection has started:** `data/` holds only `data/curation/.gitkeep` and `data/dataset/.gitkeep`. There's no `extract/spiders/`, no `scrapy.cfg`, and no parser
- **Mackolik-specific code** (all from S05):
  - `src/raw/envelope.ts:4` (`SOURCES = ['mackolik']`)
  - `src/raw/mackolik-match.ts`, `src/raw/mackolik-lineup.ts`, `src/raw/kinds.ts:1-7`
  - `schemas/raw/mackolik-match.schema.json`, `schemas/raw/mackolik-lineup.schema.json`
  - `schemas/raw/examples/mackolik-*.json` (4 files)
  - `extract/tests/test_records.py:40-178`, which uses those kind names
- **Generic and kept:**
  - `extract/records.py` (`validate_record`, `RecordWriter`)
  - `src/raw/schema-files.ts`, `src/raw/export.ts`, `src/raw/schemas.spec.ts`
  - the S04 dataset schema (`src/dataset/`, `src/names/`)
  - the S03 Prisma setup (`prisma/`, `src/db/`, `src/config/`)

## Plan

Items are in priority order. **Effort:** S < 1 day, M 1–3 days, L > 3 days. **Risk** is the chance the item turns out wrong or blocked.

### P0 — Shared spec: allow Transfermarkt (gate). Done by the user, in `lineup-backend`

**Done on 2026-10-26:** `lineup-backend` commit `95d7fce` ("docs: make Transfermarkt the primary development source"), copied byte-identically to this repo. The gate is open.

- **From:** `context/project-overview.md:167-173` (the § Sources table), and `context/ai-interaction.md` § Working Across Repos (backend first).
- **Current:** the Transfermarkt row says "Manual spot-checking only — never scraped programmatically (ToS)"; the Mackolik row says "Candidate, pending S02"; API-Football is "Primary".
- **Change:** in `lineup-backend/context/project-overview.md`, replace three rows of the § Sources table, then copy the file unchanged to `lineup-web`, `lineup-mobile` and `lineup-scraper`:

  ```markdown
  | **Transfermarkt** (transfermarkt.com)       | **Primary** for fixtures, lineups, formations, events and player profiles during development (scraper decision 2026-10-26). Must be licensed or replaced before release |
  | **Mackolik** (mackolik.com)                 | Trialled in S02; **superseded**: no formations or positions in any year                                                                                            |
  | **API-Football** (api-sports.io)            | Not trialled. A paid fallback if Transfermarkt becomes unusable                                                                                                    |
  ```

  Keep the FBref and worldfootball.net row as manual-only, without Transfermarkt in it: `| **FBref, worldfootball.net** | Manual spot-checking only — never scraped programmatically (ToS) |`.
- **Benefit:** the shared spec matches reality, so no session refuses or questions the crawl. **Effort:** S. **Risk:** low.
- **Acceptance:** `diff` of `project-overview.md` across the four repos is empty, and the scraper's copy has the new rows.

### P1 — Data-integrity rules, set before any parser exists

Each is a rule the S06, S07 and S11 specs must copy, with a test. They come from ref § 12 and today's probes.

| # | Rule | Old bug (ref § 12 / old file) | Lands in | Acceptance |
| --- | --- | --- | --- | --- |
| 1 | Each side's table position comes from its own box's `p`; absent → `null` | #1; old `transfermarkt/super_lig/parse_html.py:95` reads `homeBox` for away | S11 parser | A fixture where the two positions differ yields both |
| 2 | Match dates come only from the `datum/YYYY-MM-DD` link, on match pages and fixture lists. No text-date parsing, no kick-off time | #2, #12; old `transfermarkt/super_lig/transform_parsed_data.py:20-45`. The text format flipped from `8/12/23` to `12/08/23` (probe T6) | S07, S11 | Fixtures from 2000 and 2023 give ISO dates; no code parses `dd/mm/yy` |
| 3 | On `on pens`, `sb-endstand` is the **shootout**; each side's goals are counted from the `sb-tore` events (own goals credited to the other side) | #3; probe T3: `5:4` with `on pens` for the 2001 final, which was 1–1 | S11 transform | The 2001 final fixture → goals 1–1, shootout 5–4, `extraTime` true |
| 4 | `extraTime` is always a boolean; `shootout` both-or-neither (`data-contract.md` § 2.7) | #4 | S11 transform | No `null` flags in the dataset; S04's `datasetSchema` passes |
| 5 | Every fetch goes through Scrapy's HTTP cache; writes are idempotent; reruns add no rows | #5 | S06 | Running a spider twice adds 0 new requests and 0 new lines |
| 6 | Failures raise real exceptions with the URL and status; a parse failure fails the record, never the run silently | #6; old `players/save_html_pages.py:37` | S06 | A 404 and a malformed page each give a named error |
| 7 | One request at a time per domain, AutoThrottle, retries with backoff, 429 handling | #7; old `players/save_html_pages.py:80-81` (a 500-page manual cap) | S06 settings | The settings test asserts these values |
| 8 | Lookups load once per run | #8; old `write_non_relational.py:283` onward | S08, S14 | No per-match file reads |
| 9 | Every file open is UTF-8 | #9; old `transfermarkt/champions_league/parse_html.py:11` | All Python | ruff/mypy clean; a test with `ç`, `ğ`, `é` round-trips |
| 10 | Club filters and joins use numeric ids, never English names | #11; old `transfermarkt/super_lig/download_links.py:56,86` | S07 | The curated-club list is a list of ids |
| 11 | One parser per page type, with per-competition config | #13 | S06/S07 | No per-competition copies of a parser |

**Benefit:** each known bug is closed before code exists. **Effort:** S, as spec text. **Risk:** low.

### P2 — Raw contract: Transfermarkt kinds. Applied by this fix

- **From:** ref § 4.1, § 4.2, § 5.1, and probes T2–T7. **Current:** `src/raw/kinds.ts:1-7` registers `mackolik-match` and `mackolik-lineup`.
- **Change:** see § Changes. Three kinds; all S05 schema rules still hold (§ Changes, "Raw schema rules").
- **Port and fix:** fields follow the old parser's record (old `transfermarkt/champions_league/parse_html.py:13-43`), with these changes:
  - store raw text, not parsed values
  - add the event boxes the old parser ignored
  - drop the coach, stadium, attendance and referee, which have no column
  - dates from the `datum/` link only
- **Benefit:** S06 can write records the day it starts. **Effort:** M. **Risk:** medium. The shapes are drafts from 3 match pages, and S06 confirms them against saved responses.
- **Acceptance:** `npm test`, `uv run pytest`, both linters, typecheck and format pass; `npm run schemas` twice gives no diff; no file under `src/`, `extract/` or `schemas/` contains `mackolik`.

### P3 — S06 fetch harness

- **From:** ref § 1 (resumable, cached, network decoupled from parsing), ref § 2 headers; old `transfermarkt/super_lig/save_html_pages.py:11-27`. **Current:** no Scrapy (`pyproject.toml` has only `jsonschema`).
- **Change:** Scrapy, the HTTP cache in `data/cache/`, AutoThrottle, a concurrency of 1, retries, `Accept-Language: en-US,en;q=0.9`, and a `RecordWriter` item pipeline (`extract/records.py`). The User-Agent and its contact are the user's call. Parser fixtures are saved from spider responses for **both layouts seen**: a 2000–01 page and a 2023 page.
- **Port and fix:** request headers from ref § 2, minus the browser-only ones; the cache-by-id idea from ref § 1. Fix P1 #5–#7 and #9.
- **Benefit:** every later fetch is polite, cached and rerunnable. **Effort:** M. **Risk:** low.
- **Acceptance:** a two-page crawl twice → the second run makes 0 network requests; records validate; parser tests run on fixtures offline.

### P4 — S07 fixture discovery: the universe

- **From:** ref § 3.1, § 3.3, § 3.4; probes T2, T4. **Current:** nothing (`context/todo.md:17`).
- **Change:**
  - **Leagues:** one fixture-list page per league-season, with the ref § 3.1 selectors, which work (306/306).
  - **Cups:** collect every distinct `a[href*="/spielbericht/"]` on the page instead of ref § 3.3, which found 85 of 157 for 2000–01.
  - **Every row:** the match id, the `datum/` date (carried down to the day's later rows), team ids from `/verein/{id}/`, full names from the link `title`, and the result.
  - **Universe:** filter to the curated clubs **by id** (`match-pool-scope.md` § 2).
- **Port and fix:** the selector code from old `transfermarkt/super_lig/download_links.py`. Drop its name filters (P1 #10) and its TSV output; write `transfermarkt-fixture` records instead.
- **Benefit:** about 200 fixture pages give the whole ~25,000-match universe. **Effort:** M. **Risk:** medium. `FR1`, `PO1`, `EM00` and the World Cup and Euro pages are **unverified**; S07 probes one page of each before relying on it.
- **Acceptance:** match counts per league-season equal the league's size (18 clubs → 306); every curated club appears in every season it played.

### P5 — S11 match parsing: XIs, formation, slots, events

- **From:** ref § 4.1, § 4.2, § 10; old `transfermarkt/champions_league/parse_html.py:46-294`; probes T3, T5, T6. **Current:** nothing (`context/todo.md:21`).
- **Change:**
  - **Selectors:** the renamed ones (`context/docs/transfermarkt-source.md` § 4).
  - **Formation:** from the digits; Diamonds mapped explicitly (`transfermarkt-source.md` § 5).
  - **Slots:** from coordinates. The keeper is at `top:80%`; sort the rest by `top`, descending, chunk by line sizes, then sort each line by `left`, descending.
  - **Position:** `positionForSlot` (`src/dataset/formation.ts`).
  - **Events:** goals, own goals, penalty goals and red cards (including second yellows), from the `sb-tore` and `sb-karten` text, with the minute from the clock sprite and added time from the `+N` text.
- **Port and fix:** the old parser's structure and shirt-number handling, plus the captain flag (unused but harmless; may be dropped). Replace the three renamed selectors. Parse events, which the old code never did. Fix P1 #1–#4.
- **Benefit:** every match has a formation and correct slots, so the gate (S13) can pass it. **Effort:** L. **Risk:** medium:
  - The sprite → minute rule is **unverified**: `-324px -288px` with `+2` fits 90+2, but `-0px -433px` (a card) doesn't fit the 36 px grid. Verify it on fixtures with known minutes first
  - Own-goal and second-yellow labels in English text are **unverified**
- **Acceptance:**
  - Every probed match (T3, T5, T6) parses to 11 + 11 with a schema-valid formation
  - Slot order agrees with the old dataset's rule in all 18,404 old XIs (§ Evidence of the context fix)
  - The 2001 final gives 1–1, a 5–4 shootout and `extraTime` true
  - Juventus v Bari 2000–01 gives Zidane's penalty at 90+2

### P6 — S08 entities: players and clubs

- **From:** ref § 5.1, § 5.3, § 7; old `players/parse_html.py`; probes T7, T9. **Current:** nothing.
- **Change:**
  - Player pages only for pool players: the name (h1 with the `#N` shirt number stripped), DOB (`DD/MM/YYYY (age)`), citizenship, position.
  - DOB is for disambiguation and the slug's birth year (`ronaldo-1976`).
  - Clubs come from the fixture rows (id, full name); no team-page fetch unless S08 needs one.
  - The crosswalk maps each `sourceId` to a permanent slug.
- **Port and fix:** the old player selectors still work except the DOB format and the "player data" headline (use the info-table class fallback). Don't port managers or stadiums.
- **Benefit:** clean English display names with diacritics (`Zinédine Zidane`), not Mackolik's ASCII-folded forms. **Effort:** M. **Risk:** low.
- **Acceptance:** one id → one slug across seasons; a fixture page with dual citizenship parses.
- **Open:** whether display names come from Transfermarkt or from Wikidata labels (`context/docs/scraper-repo-setup.md:1043`). Decide in the S08 spec.

### P7 — S18 images

- **From:** ref § 5.4 (the old repo bulk-downloaded Transfermarkt photos); `context/project-overview.md` § Data Architecture (photos are copyrighted, crests are trademarks). **Current:** nothing.
- **Change:** don't fetch or upload Transfermarkt images. Use initials or Wikimedia Commons, with attribution, as the spec says. **Effort:** none now. **Risk:** low.
- **Acceptance:** the S18 spec names no Transfermarkt image host.

### P8 — Remove the Mackolik code. Applied by this fix

Delete these files (git history keeps them):

- `src/raw/mackolik-match.ts`
- `src/raw/mackolik-lineup.ts`
- `schemas/raw/mackolik-match.schema.json`, `schemas/raw/mackolik-lineup.schema.json`
- `schemas/raw/examples/mackolik-match.valid.json`, `mackolik-match.invalid.json`, `mackolik-lineup.valid.json`, `mackolik-lineup.invalid.json`

Keep:

- `context/docs/source-trial.md` (history; the context fix adds a superseded banner)
- `context/features/phase-s02-source-trial.md` and `phase-s05-raw-record-contract.md` (records of what was built; add a deviation line to S05)

## Changes

### `src/raw/envelope.ts`

Change line 4 to `export const SOURCES = ['transfermarkt'] as const;`. Nothing else changes.

### `src/raw/transfermarkt-fixture.ts` (new): kind `fixture`

One match row of a league, cup or tournament fixture list.

| Field | Type | From | Note |
| --- | --- | --- | --- |
| `source`, `sourceId`, `sourceUrl`, `fetchedAt` | envelope | — | `sourceId` = the match id (`spielbericht/{id}`); `sourceUrl` = the fixture-list URL |
| `competitionCode` | string, `^[A-Z0-9]+$` | The request URL | `IT1`, `CL`, `WM06` |
| `seasonId` | digits or null | `saison_id` in the request URL | `null` for World Cup and Euro |
| `round` | non-empty string or null | The box headline | `2. Matchday`, `Group A`, as shown |
| `date` | string, `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, or null | The `datum/` link of the day's first row, carried down | Never the text date |
| `home`, `away` | `{ sourceId: digits, name: non-empty string }` | The `/verein/{id}/` link and its `title` | Full name, `AS Bari` |
| `result` | non-empty string or null | `a.ergebnis-link` text | `1:1`; `null` if not shown |

### `src/raw/transfermarkt-match.ts` (new): kind `match`

One match report page.

| Field | Type | From |
| --- | --- | --- |
| envelope | — | `sourceId` = the match id; `sourceUrl` = the report URL |
| `round` | non-empty string | `p.sb-datum` text before the first `|` |
| `date` | ISO date pattern, as above | The `datum/` link |
| `result` | non-empty string | `div.sb-endstand` first text node (`5:4`) |
| `resultNote` | non-empty string or null | `div.sb-halbzeit` (`(1:0)`, `AET`, `on pens`) |
| `home`, `away` | object, below | `div.sb-team sb-heim` / `sb-gast`, and the line-up boxes |
| `events` | array, below | `sb-tore`, `sb-karten`, `sb-wechsel` |

A side object holds:

- `sourceId` (digits), `name`: from `a.sb-vereinslink`
- `tablePosition`: non-empty string or null, the box's own `p`, such as `Position: 16`
- `formation`: non-empty string or null, the `div.formation-subtitle` text, such as `Starting Line-up: 3-4-1-2`
- `starters`: an array of `{ sourceId, name, shirtNumber: string or null, style: non-empty string, isCaptain: boolean }`, from `div.formation-player-container`
- `bench`: an array of `{ sourceId, name, shirtNumber: string or null, position: string or null }`, from the `table.ersatzbank` rows except the last (the coach)

An event object: `{ box: "goal" | "card" | "substitution", side: "home" | "away", clock: string or null, addedTime: string or null, players: [{ sourceId, name }], text: non-empty string }`.

- `clock` is the sprite's raw `style` text; `addedTime` is the raw `+N` text
- `players` lists the item's player links in page order
- `text` is the item's whitespace-collapsed text. The parser does no interpretation; S11 decodes it

### `src/raw/transfermarkt-player.ts` (new): kind `player`

| Field | Type | From |
| --- | --- | --- |
| envelope | — | `sourceId` = the player id |
| `headline` | non-empty string | The h1 text, raw (it includes `#11`) |
| `dateOfBirth` | non-empty string or null | `DD/MM/YYYY (age)`, raw |
| `citizenship` | non-empty string or null | The info-table value, raw (it can hold two countries) |
| `position` | non-empty string or null | The info-table `Position:` value |

### Registry, schemas, examples, tests

- **`src/raw/kinds.ts`:** register `transfermarkt-fixture`, `transfermarkt-match` and `transfermarkt-player`; remove the Mackolik entries
- **Schemas:** run `npm run schemas`; delete the two Mackolik schema files (P8)
- **Examples:** `schemas/raw/examples/transfermarkt-{fixture,match,player}.{valid,invalid}.json`. They're fictional, hold at least 2 valid and 5 invalid cases per kind, and include a 2000–01-style match with a shootout and a `+N` goal
- **`extract/tests/test_records.py`:** change the kind names: `KINDS` in `test_finds_the_schema_files` (line 40) becomes `["transfermarkt-fixture", "transfermarkt-match", "transfermarkt-player"]`; the tests at lines 72–178 use `transfermarkt-match` and `transfermarkt-fixture` in place of the Mackolik kinds, and their paths become `transfermarkt/match/…` and `transfermarkt/fixture/…`

**Raw schema rules** (from S05, unchanged):

- Only `type`, `enum`, `const`, `pattern`, `minimum`/`maximum`, `minLength`, `minItems`, `required`, `additionalProperties`, `items`, `anyOf`; the keyword allow-list test in `src/raw/schemas.spec.ts` enforces it
- No refine or transform
- ASCII patterns only (`[0-9]`, never `\d`)
- Strict objects
- Ids as digit strings

### `context/todo.md`

Replace lines 16, 17 and 21:

```markdown
- [ ] **Phase S06 — Fetch Harness**: Scrapy with disk cache, auto-throttle, retries, fixture-tested Transfermarkt parsers. (was B15)
- [ ] **Phase S07 — Match Metadata Extract**: Transfermarkt fixture lists: scores, dates, stages and competitions across the season range. (was B16)
```

```markdown
- [ ] **Phase S11 — Lineup Extract**: Transfermarkt match reports: XIs, formations, coordinates to slots, and events, for the shortlist only. (was B20)
```

### `context/features/phase-s05-raw-record-contract.md`

Append to the **Deviations recorded during implementation** list in § Notes:

```markdown
- 2026-10-26, fix `2026-10-26-transfermarkt-plan`: the Mackolik kinds were replaced by `transfermarkt-fixture`, `transfermarkt-match` and `transfermarkt-player`, after the source switch
```

## Out of Scope

- **P0**: a `lineup-backend` change the user makes. Applying this fix doesn't wait for it, because no fetch happens here
- **P1 and P3–P7**: guidance for `/todo spec` (S06, S07, S08, S11, S18). Nothing in them is built by this fix
- Any spider, parser, crawl or network request
- Context-doc changes: the companion fix `context/fixes/2026-10-26-transfermarkt-context.md`
- Importing the old repo's cached pages or parsed data (decided against)

## Acceptance Criteria

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `uv run pytest`, `uv run ruff check`, `uv run ruff format --check` and `uv run mypy extract` all pass
- `npm run schemas` twice gives no diff; the stale check and the keyword allow-list cover the three new kinds
- Every new valid example passes and every invalid one fails, in both Vitest and pytest
- `grep -ri mackolik src extract schemas` finds nothing
- `context/todo.md` lines S06, S07 and S11 match § Changes; no other `todo.md` line changed

## Notes

- Scope: the S05 raw-contract swap, the Mackolik code removal and three `todo.md` lines. The rest of the document is a prioritised plan read by later phases.
- Depends on: the companion context fix, applied first (it creates `context/docs/transfermarkt-source.md`, which this plan cites).
- Constraints:
  - No network: this fix fetches nothing
  - Raw means as fetched: no date, score or event interpretation in the raw kinds
  - Errors name paths, never values (`extract/records.py`)
  - Examples are fictional
  - Don't edit `project-overview.md` or `data-contract.md` here
- Verification: § Acceptance Criteria.
- Open questions and unverified points:
  - `FR1`, `PO1`, `EM00` and the World Cup and Euro fixture pages: not probed (P4)
  - The sprite → minute rule, and the own-goal and second-yellow text: unverified (P5)
  - The draft raw shapes come from 3 match pages, 2 fixture lists and 1 player page; S06 confirms them against saved responses
  - Display names, Transfermarkt or Wikidata: decide in S08 (P6)
  - Request volume: ~200 fixture pages, ≤ ~3,600 match reports and the pool's player pages. No block was seen in 9 requests; the old repo's 500-page-per-run cap (old `players/save_html_pages.py:80-81`) hints that rate limits exist, **unverified**
  - A hybrid with Mackolik for Turkish alias spellings: deferred

## History
