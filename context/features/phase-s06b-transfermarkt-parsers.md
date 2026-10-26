# Phase S06b — Transfermarkt Parsers and Inbox Import

## Status

Not Started

## Goals

- **Parsers** in `extract/parsers/transfermarkt/`. Each is a pure function: HTML text plus context in, raw records out (`coding-standards-scraper.md` § The two languages). No network, no clock, no file access:
  - `fixtures.py` — `parse_fixture_list(html, url, fetched_at, competition_code, season_id) -> list[TransfermarktFixture]`
  - `match.py` — `parse_match_report(html, url, fetched_at) -> TransfermarktMatch`
  - `player.py` — `parse_player(html, url, fetched_at) -> TransfermarktPlayer`
  - The return types are `TypedDict`s matching `src/raw/transfermarkt-*.ts` field for field; every record validates against `schemas/raw/`
- **Selectors**: the live-verified ones in `context/docs/transfermarkt-source.md` § 4, not the reference's 2024 originals:
  - **Fixture lists:** every distinct `a[href*="/spielbericht/"]`. The match id is the link's trailing number; each row's date comes from the `datum/YYYY-MM-DD` link, carried down to the day's later rows; teams come from `/verein/{id}/` links with their `title`; `round` is the enclosing box's headline; `result` is the `a.ergebnis-link` text
  - **Match report:**
    - `round`: the `p.sb-datum` text before the first `|`
    - `date`: the `datum/` link
    - `result` and `resultNote`: `div.sb-endstand` and `div.sb-halbzeit`
    - Sides: `div.sb-team sb-heim` / `sb-gast`, each with its own `p` as `tablePosition`
    - `formation`: `div.formation-subtitle`
    - `starters`: `div.formation-player-container` (`span.formation-number-name > a`, the shirt number, `kapitaenicon-formation`)
    - `bench`: the `table.ersatzbank` rows except the last (the coach)
    - `events`: `li` items in `sb-tore`, `sb-karten` and `sb-wechsel`
  - **Player:** the h1 text, raw, as `headline`; the `data-header__label` items for date of birth and citizenship; the info table's `Position:`
  - **Raw means raw:** no date parsing beyond copying the `datum/` value, no score splitting, no minute decoding, no formation mapping. Whitespace in a text value is collapsed to single spaces; NFC is applied by `RecordWriter`
- **Data folders**: `inbox` and `pages` join `DATA_DIRS` in both languages (`extract/data_dirs.py`, `src/config/data-dirs.ts` and their tests); `.gitignore` adds `data/inbox/` and `data/pages/`
- **`extract/inbox.py`**: `uv run python -m extract.inbox [--partition <name>] [--expect <link-list>]`. For each `*.html` / `*.htm` in `data/inbox/` (not recursive):
  1. Refuse a challenge or block page (`is_challenge_html` from `extract/middlewares.py`): report "challenge page, save it again" and leave the file
  2. Read `og:url`. Classify it: a fixture list (`/gesamtspielplan/`, with the competition code and `saison_id` taken from the URL), a match report (`/spielbericht/{id}`) or a player page (`/profil/spieler/{id}`). Anything else is reported "unknown page" and left
  3. Parse it and write the records through `RecordWriter`. Fixture partitions are `<code>-<season>` or `<code>`, lower-cased; match and player partitions take `--partition` (default `inbox`)
  4. `fetchedAt` is the file's modification time in UTC (when the user saved it)
  5. Move the file to the page store `data/pages/transfermarkt/<kind>/<key>.html` (key: `<code>-<season>`, the match id or the player id). A key already in the store is skipped and reported "already imported" if the content is identical, and left in the inbox with a "differs from the stored page" note if not
  6. Finish with counts per kind and a list of refused files (paths and reasons, never page text). With `--expect`, also list the links in that file not yet in the store. Exit 1 if any file was refused
- **Parser fixtures**: the 8 pages from § Your part, copied unchanged from the store into `extract/tests/fixtures/transfermarkt/<name>.html` and committed
- **Tests** (offline):
  - `test_parsers_transfermarkt.py`, on the fixtures:
    - `fixtures-it1-2000` → 306 records, every date ISO, team ids digits
    - `fixtures-cl-2000` → 157
    - `fixtures-cl-2023` and `fixtures-wm06` → plausible counts, recorded in this spec
    - `match-990248` → 11 + 11 starters; `Starting Line-up: 5-4-1` and `Starting Line-up: 4-4-2 Diamond`; `result` `5:4`; `resultNote` `on pens`; date `2001-05-23`
    - `match-1153409` → `tablePosition` `Position: 2` and `Position: 16`; one goal with `addedTime` `+2`; date `2000-10-15`
    - `match-4126774` → no goal events; date `2023-08-12`
    - `player-411295` → `headline` `#11 Raphinha`, `dateOfBirth` `14/12/1996 (29)`
    - Every record passes `validate_record`; a page with the starters removed raises a named parse error, never an empty list
  - `test_inbox.py`, in temporary folders: each page kind is classified and stored; a challenge page and an unknown page are refused and left; a duplicate is skipped; a differing duplicate is left; `fetchedAt` comes from the file time; `--expect` lists what's missing; the exit code is 1 on refusals

## Your part

👤 About 5 minutes, once, after `/feature start`. Claude writes the parsers against these pages, so this comes first.

1. Open each link below in your own browser and save it **as HTML only** into `data/inbox/`. Any file name works (`docs/manual-work.md` § How to save a page)
2. Tell Claude when the 8 are saved. Claude runs the import and copies them into the test fixtures
3. If a page shows an error or "not found" instead of football data, say which. The World Cup link is **unverified** (taken from the old repo); if it fails, it's recorded and no other link is guessed

| Fixture name | Link |
| --- | --- |
| `fixtures-it1-2000` | https://www.transfermarkt.com/serie-a/gesamtspielplan/wettbewerb/IT1?saison_id=2000 |
| `fixtures-cl-2000` | https://www.transfermarkt.com/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2000 |
| `fixtures-cl-2023` | https://www.transfermarkt.com/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2023 |
| `fixtures-wm06` | https://www.transfermarkt.com/weltmeisterschaft-2006/gesamtspielplan/pokalwettbewerb/WM06 |
| `match-990248` | https://www.transfermarkt.com/spielbericht/index/spielbericht/990248 |
| `match-1153409` | https://www.transfermarkt.com/juventus-fc_as-bari/index/spielbericht/1153409 |
| `match-4126774` | https://www.transfermarkt.com/kayserispor_galatasaray/index/spielbericht/4126774 |
| `player-411295` | https://www.transfermarkt.com/raphinha/profil/spieler/411295 |

## Out of Scope

- **Any automated Transfermarkt request**: no spider, script or Playwright session (`transfermarkt-source.md` § 8). The S06a harness is not used for Transfermarkt
- Generating a phase's link list and interpreting raw records (dates, formations, slots, minutes, scores): **S07** and **S11**
- The harness itself: **S06a**

## Notes

- Scope: everything between a page the user saved and a validated raw record.
- Depends on: **S06a** (`is_block`, the Python layout) and S05 (the raw kinds, `RecordWriter`).
- Port from the old repo **by reading only**: old `transfermarkt/champions_league/parse_html.py:46-294` (structure, shirt numbers, the captain flag) and old `players/parse_html.py`. Replace the renamed selectors, open files as UTF-8, raise real errors, and don't port the reference's § 12 bugs (`transfermarkt-source.md` § 6).
- Constraints:
  - Parsers are pure and tested on saved pages only
  - **An invalid record fails the run**
  - Errors name a path or selector, never page text, a player name or an XI
  - `mypy --strict`, no `Any`, absolute imports
  - Choose one HTML library: `beautifulsoup4` (new dependency) or Scrapy's `parsel` (already installed). Record the choice
- Verification:
  - `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy extract`. The TS checks stay green (`DATA_DIRS` changed)
  - The 8 saved pages import with exit 0; a second import reports 8 "already imported"
- Unverified, carried over: the World Cup page; own-goal and second-yellow text (S11 decodes these from `events[].text`)

**Deviations recorded during implementation**

- 2026-10-26, before start: rewritten for hand-saved pages after the S06a capture hit an AWS WAF challenge. The record-yielding spiders and the live run were dropped; the `extract.inbox` import and `## Your part` were added

## History
