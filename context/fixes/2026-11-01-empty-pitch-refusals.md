# Fix — Empty-Pitch Match Reports

## Status

Complete

## Goals

Some Transfermarkt match reports draw the pitch with empty markers (`div.formation-player-container` holding only `pos_klein.png`, no `span.formation-number-name > a`) and list that side's XI below by position group, as the list layout does (`fixes/2026-10-31-list-layout-refusals.md`). The parser assumes every marker has a linked name, so it crashes with an `IndexError`. The importer doesn't catch that, and the whole run stops at the first such file. Found 2026-11-01: 7 of the ~780 files in `data/inbox/`, the first being `match-1000779.html` (Chelsea – Arsenal, 2001-09-08). On some, one side is drawn normally and the other is empty.

The listed groups don't fit the formation label. For example, `1001429`'s away side is labelled `4-4-2` but lists 5 defenders, 3 midfielders and 2 forwards. So the XI can't be put into slots, and the page is treated as the list layout.

- **Recognise the empty pitch** (`extract/parsers/transfermarkt/match.py`, `starters()`):
  - a side whose pitch has any marker without a linked name raises `ListLayoutError` (`list layout: no formation`) when that side's box holds the position-group table
  - without the table it raises a `ParseError` that names the missing link, never an `IndexError`
  - a side is read whole or refused: no XI is half-read
- **No change to the importer, the pool or the dashboard:** both errors are already caught. The file moves to `data/inbox/refused/`, `npm run pool` leaves the match out (`list layout`), and `pool.md` lists it
- **Tests** on 2 of your saves kept as parser fixtures: `match-1000779` (home empty, away drawn) and `match-1001429` (both empty)
- **Docs:** `transfermarkt-source.md` (§ the source's exception, § 8) and `match-pool-scope.md` § 4 name the empty-pitch variant; `manual-work.md` gets a row

## Your part

1. **Approve the commit** at `/feature complete`
2. **After the merge:** `uv run python -m extract.inbox`, then `npm run status`. The 7 files move to `data/inbox/refused/` and their matches leave the pool. The rest of the inbox imports

Nothing to save.

## Decisions

None new: this follows D1 of the list-layout fix (2026-10-31), so list-layout matches leave the pool automatically.

## Notes

- Scope: the parser's check and its tests, the docs. Not in scope: reading the listed groups into lineups (declined 2026-10-31; here the groups also contradict the formation label)
- Depends on: the list-layout fix (`ListLayoutError`, the pool rule, `refused/`)
- Constraints:
  - Never fetch Transfermarkt with code; fixtures are the pages you saved
  - Errors name a side and a selector, never a player
  - Comments at most 50 characters
- Verification:
  - `uv run pytest`: both fixtures raise `ListLayoutError`; an empty marker without the table raises a named `ParseError`; the pitch-layout fixtures still parse; the importer refuses a fixture and carries on
  - `uv run ruff check`, `uv run mypy extract`
  - on the real data, read only: every match report in `data/inbox/` parses or is refused, with no crash

**Deviations recorded during implementation**

- **How the empty pitch is recognised:** any `div.formation-player-container` without `span.formation-number-name > a` (`STARTER_NAME`), checked before any starter is read. With the position-group table in that side's box it is `ListLayoutError`; without it, `Missing <side> starter span.formation-number-name > a`
- **The importer test** also proves the run goes on: an empty-pitch file is refused and a pitch-layout file beside it imports
- **Real data, 2026-11-01, read only** (an in-memory parse and validation of `data/inbox/`, nothing moved): 786 files, 695 match reports and 63 player pages parse and validate, 28 match reports are `list layout: no formation`: the 7 empty-pitch pages and 21 plain list-layout pages the crashed run never reached. That is about 4% of the reports saved so far, mostly Premier League 2000–03; `pool.md`'s count shows it per era once imported
- 335 Python tests (3 new) pass; ruff, format and mypy clean. No TypeScript changed
