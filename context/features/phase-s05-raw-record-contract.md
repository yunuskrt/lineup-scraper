# Phase S05 — Raw Record Contract

## Status

Not Started

## Goals

- **`src/raw/envelope.ts`**: the fields every raw record carries:
  - `source`: an enum of the sources with record kinds, `mackolik` for now
  - `sourceId`: the source's own id, as a string
  - `sourceUrl`: the URL the facts were read from. That's the listing page or the JSON endpoint, not necessarily a match page
  - `fetchedAt`: an ISO datetime in UTC, the HTTP response time from the cache
- **`src/raw/mackolik-match.ts`**: kind **`match`**, one match as a listing shows it (S07). See § Records
- **`src/raw/mackolik-lineup.ts`**: kind **`lineup`**, the `MatchData.aspx` payload for one match: scores, both squads in source order, and events (S11). See § Records
- **`src/raw/kinds.ts`**: the registry of every record kind, as `<source>-<kind>` → schema. It's the one list the exporter, the tests and the Python side all follow
- **`src/raw/export.ts`** and **`npm run schemas`**: writes `schemas/raw/<source>-<kind>.schema.json` for each kind with `z.toJSONSchema` (Draft 2020-12). The output is deterministic: 2-space JSON and a trailing newline, so a rerun with no change is byte-identical
- **`src/raw/schemas.spec.ts`**:
  - **Stale check:** for every kind, the committed file equals what the exporter would write. It fails with "run `npm run schemas`"
  - No file in `schemas/raw/` lacks a kind, and no kind lacks a file
  - Every example in `schemas/raw/examples/` parses with Zod, or is rejected, as its name says
- **`schemas/raw/examples/`**: small fictional records per kind, `<source>-<kind>.valid.json` and `<source>-<kind>.invalid.json`. Both languages test against the same files, which is what proves they agree
- **Python dependency**: `jsonschema` in the project dependencies, and `types-jsonschema` in the dev group for `mypy --strict`
- **`extract/records.py`**:
  - `validate_record(kind, record)`: validates with a cached `Draft202012Validator` loaded from `schemas/raw/`. On failure it raises `InvalidRecordError` naming the JSON path and the failed keyword, **never the value**
  - `RecordWriter(kind, partition)`: NFC-normalises every string, validates, then appends one line to `data/raw/<source>/<kind>/<partition>.ndjson` (UTF-8, `ensure_ascii=False`, sorted keys). An invalid record raises before anything is written
- **`extract/tests/test_records.py`**:
  - Every schema file is a valid Draft 2020-12 schema (`check_schema`)
  - Each `valid` example passes and each `invalid` one fails, matching the Vitest results
  - The error message carries a path and no value
  - NFC: a decomposed name is written composed
  - The writer creates the partition file under a temporary `data/raw` and appends rather than overwriting

## Records

These follow the S02 trial (`context/docs/source-trial.md` §§ 2.1, 7). **Raw means as fetched:** strings stay as the source wrote them (NFC only), with no date parsing, no score splitting and no code mapping. The TypeScript stages (S07, S11) interpret them. The shapes are a first draft: S06 checks them against saved responses, and changing one is a regenerate.

**`mackolik-match`**, from club season pages and cup stage fragments:

| Field | Type | Example (fictional) | Note |
| --- | --- | --- | --- |
| `sourceId` | digits | `"783844"` | The match id |
| `competition` | string | `"İspanya LaLiga"` | The heading as shown |
| `season` | string | `"2000/2001"` | As shown |
| `stage` | string or null | `"Yarı Final"` | `null` when the page shows none (league rows) |
| `date` | string | `"21.10.2000"` | The displayed date, **never `startDate`** (source trial § 6) |
| `home`, `away` | `{ sourceId, name }` | `{ "sourceId": "83", "name": "Barcelona" }` | Club or national team, as shown |
| `score` | string or null | `"2-0"` | `null` before kick-off or when not shown |

**`mackolik-lineup`**, from `/Match/MatchData.aspx?t=dtl&id=<id>&s=0`:

| Field | Type | Note |
| --- | --- | --- |
| `sourceId` | digits | The match id |
| `score` | `{ s, st, ht, ft, et, pt }`, each a string or null | Mackolik's `d` keys, as sent (`"Pen"`, `"1-1"`) |
| `home`, `away` | array of `{ sourceId, name, shirtNumber }` | **All players in source order.** The first-11 rule is applied by S11, not here. `shirtNumber` is an integer ≥ 0, where 0 means unknown |
| `events` | array of `{ side, minute, type, playerSourceId, playerName, detail, detailName, assistSourceId, assistName }` | `side` is `1` or `2`, `minute` an integer ≥ 0 (minute `0` occurs), `type` the source code (1–4). Every other field is a string or null, as sent |

## Rules for raw schemas

- **Only keywords both validators enforce:** `type`, `enum`, `const`, `pattern`, `minimum`/`maximum`, `minLength`, `minItems`, `required` and `additionalProperties`
- **No `.refine`, `.superRefine`, `.transform` or `.preprocess`.** `z.toJSONSchema` drops refinements silently, so Python would accept what Zod refuses. Cross-field rules belong to the TypeScript stages
- **No `format`-only checks.** `z.url()` exports `format: "uri"`, which `jsonschema` doesn't enforce by default. Use a `pattern` (`^https?://\S+$`) instead. `z.iso.datetime()` is fine, since it exports a pattern too
- **Strict objects**, so a misspelt field fails on both sides
- **Ids are digit strings**, never numbers, so a leading zero or a huge id survives

## Decisions

1. **S05 defines the envelope, the mechanism and the two Mackolik kinds.** StatsBomb, openfootball, Wikipedia, Wikidata and image kinds are added by the phase that fetches them (S09, S11, S18), each with its examples
2. **S05 builds the writer:** `validate_record` and `RecordWriter`. S06 only wires them into a Scrapy item pipeline
3. **Shared example files** prove the two languages agree. Vitest and pytest run the same files

## Out of Scope

- Scrapy, spiders, parsers and the item pipeline: **S06**. Parser fixtures are saved from spider responses there
- Reading `data/raw/` from TypeScript, and any interpretation (dates, scores, the first-11 rule, event codes): **S07** and **S11**
- Partition naming. The writer takes a partition string; S07 picks competition-and-season partitions
- Kinds for other sources (§ Decisions, item 1)

## Notes

- Scope: the one interface between Python and TypeScript. Zod defines it, JSON Schema carries it, and Python enforces it before any record touches disk.
- Depends on: S01 (both projects), S04 (Zod in the TS project).
- Constraints:
  - `schemas/raw/*.schema.json` is generated: **never edit it by hand** (`coding-standards-scraper.md` § Layout). The examples are hand-written
  - Python never normalises a name. NFC is Unicode composition, not `normalizeName`, and the standards allow it
  - **An invalid record fails the run** (`coding-standards-scraper.md` § Python). There's no skip-and-log path
  - Errors name a path and a keyword, never a value
  - Example records are fictional and say so. No real lineup is copied into the repo here
  - No network. Python reads only `schemas/raw/` and writes only under `data/raw/` (or a temporary directory in tests)
  - Absolute imports in Python (`from extract.records import …`), `@/` in TS. No `Any`, and mypy strict
- Verification:
  - `npm run schemas` twice gives no diff; `npm test` passes, including the stale check
  - Editing a Zod field without regenerating fails `npm test`
  - `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy extract`
  - `npm run lint`, `npm run typecheck`, `npm run format:check`
  - A record with a refused value raises in Python with its path in the message and the value absent

**Deviations recorded during implementation**

- `source` is a per-kind `const` (`z.literal('mackolik')`), not a shared enum; `SOURCES` still lists the sources
- Added `src/raw/schema-files.ts` (paths and `renderSchema`), so the spec can import it without running the exporter
- Example files are arrays of `{ name, record }`, so both test runners report each case by name
- `RecordWriter` refuses partitions that aren't lower-case words (`^[a-z0-9]+([_-][a-z0-9]+)*$`), so no path can escape `data/raw/`
- The kind folder is singular (`data/raw/mackolik/match/`). `collection-phases.md` shows `matches/` and `lineups/` as illustrations
- Score keys and event detail fields allow an empty string, as sent. Ids, names and the raw text fields must be non-empty
- Review: `fetchedAt` uses an ASCII pattern, not `z.iso.datetime()`, which the § Rules for raw schemas had called fine. That pattern uses `\d`, which Python's `re` matches in any script, so Python accepted a fullwidth digit Zod refused. The calendar check (no 30 February) is dropped; Python writes the value itself
- Review: `RecordWriter` dumps with `allow_nan=False`, since `jsonschema` accepts NaN as a `number` and `NaN` isn't JSON. Today every number is an integer, which already refuses NaN; the guard is for future float fields
- 2026-10-26, fix `2026-10-26-transfermarkt-plan`: the Mackolik kinds were replaced by `transfermarkt-fixture`, `transfermarkt-match` and `transfermarkt-player`, after the source switch

## History
