# Phase S11b — Player Pages

## Status

Complete

## Goals

- **Profile link on each starter** (decision D1): the match-report parser keeps the starter's link as shown (`/oliver-kahn/profil/spieler/206`), a new raw field `profilePath` on `starters` in `src/raw/transfermarkt-match.ts`, exported to `schemas/raw/` and the examples. `uv run python -m extract.inbox --reparse` (S11) refills the 5 stored match reports
- **Player parser** `extract/parsers/transfermarkt/player.py` gains three raw fields, each as shown or `null` (`link-map.md` § 4):
  - `fullName`: the info table's `Full name:` (`Raphael Dias Belloli`)
  - `nameInHomeCountry`: the info table's `Name in home country:`, when the page has one (a transliteration source for S12)
  - `capsGoals`: the header's `Caps/Goals:` (`43 / 12`), as text; S10 reads the caps
  - In `src/raw/transfermarkt-player.ts` and its examples; the stored player page is re-parsed with `--reparse`
- **Player link lists** `extract/lists/player_pages.py` (`uv run python -m extract.lists.player_pages`), written with `write_link_list`:
  - `s11b-players`: **every starter of every pool match with a saved report, each player once**, in match order, `https://www.transfermarkt.com{profilePath}`, kind `player`, saveAs `player-<id>.html`, tagged with the first match's `group`, `competition` and `season`. Players whose page is already stored are still listed; `extract.links show` leaves them out
  - `s11b-pilot`: the same for the 3 pilot matches only (65 players: `213` starts in two of them)
  - Reads the pool through `schemas/work/pool-matches.schema.json` and the match reports through `schemas/raw/`, as S11's list does
- **Starters only** (decided in S08b): bench players and substitute scorers aren't listed. One whose page is saved anyway still gets a slug
- **Tests:**
  - `extract/tests/test_parsers_transfermarkt.py`: `profilePath` on all 22 starters of each saved report; `fullName` and `capsGoals` on `411295`; `null` when a label is missing
  - `extract/tests/test_player_page_lists.py`: each player once across two matches, the link from `profilePath`, the tags of the first match, only pool matches, the pilot list, a rerun byte-identical
  - Every new pilot player page parses and validates (after your part)
- **Docs:** `link-map.md` § 4 and § 9 (`Name in home country:` and `Caps/Goals:` on retired players), `CLAUDE.md` § Commands, `manual-work.md` row S11b, `enrichment-guide.md` § 3

## Your part

You save **65 player pages**: every starter of the 3 pilot matches. The list exists after `/feature start` has built it; Claude stops and asks.

1. Run `uv run python -m extract.links show s11b-pilot`. It writes `data/work/inbox-lists/s11b-pilot.md`, with each link, its save-as name (`player-206.html`) and the folder.
2. Open them a few at a time: `uv run python -m extract.links open s11b-pilot --count 5` opens the next 5 unsaved links in your own browser.
3. Save each as **HTML only** into `data/inbox/` (`context/docs/manual-work.md` § How to save a page). A wrong file name does no harm.
4. After each batch, run `uv run python -m extract.inbox`. `uv run python -m extract.progress s11b-pilot` shows how many are left.
5. Tell Claude when `extract.progress` shows 65/65.

## Decisions

Settled at `/feature load`, 2026-10-27 (both as proposed):

- **D1. Each player link comes from the match report** (approved): the starter's own link, kept in the raw record (`profilePath`), so every link is one Transfermarkt itself shows. Not `/-/profil/spieler/{id}`, which no saved page shows to work
- **D2. Match order** (approved): pool order (by date), home XI then away XI, so you save one team at a time. Within an XI, the order the match report lists it (keeper first), since slots are computed by the TypeScript stage, not the Python list writer

## Out of Scope

- Aliases from the full name, the home-country name and the short names: **S12**
- Caps as a star-power signal: **S10** reads `capsGoals`
- Display names: still the headline, shirt number stripped (S08b); the full name is never the display name (`data-display-requirements.md` § 2)
- Bench players and substitute scorers: not listed (starters only, S08b)
- Images: **S18**

## Notes

- Scope: the raw fields the later phases need from player pages, and the list of player pages to save. Python, plus the two raw Zod schemas. No new TypeScript stage: `npm run resolve` (S08b) already turns saved profiles into slugs.
- Depends on: S11 (`--reparse`, the saved pilot reports), S08b (player slugs from saved profiles), S06c (link lists, `extract.progress`).
- Checked on the saved pages before writing this spec:
  - The 3 pilot reports have **65 distinct starters**; `213` starts in two of them. The 2001 final's starters link `/oliver-kahn/profil/spieler/206` and so on
  - `411295`'s info table has `Full name:`; its header has `Caps/Goals: 43 / 12` next to `Current international: Brazil`
- **Unverified until your pages are saved:** how a retired player's header shows caps (perhaps `Former international:`), whether `Name in home country:` appears on any pilot player, and how a player with no caps looks. The parser returns `null` for a missing label, never a guess
- Constraints:
  - Raw text stays raw: `capsGoals` and the names are stored as shown (NFC only). Python never normalises a name
  - Key on the `spieler` id, never a name; each page is saved once however many matches the player starts
  - Never fetch Transfermarkt with code: the lists only name links; `extract.links open` hands them to your browser
  - No player name from memory or an LLM: names come only from the saved pages
- Verification: `uv run pytest`, `uv run ruff check`, `uv run mypy extract`, `npm test`, `npm run typecheck`. After your part: `extract.progress s11b-pilot` at 65/65, every page imported and valid, then `npm run resolve` with **65 player slugs and 0 starters waiting**; a second run changes no byte

**Deviations recorded during implementation**

- **`extract.records.read_records`** (added): reads and validates every raw record of a kind, naming the file and line and pointing at `--reparse` on a failure; the player list reads match reports through it
- **`match_season`** in `extract/lists/match_reports.py`: the season tag, shared by both list writers
- `--reparse` refilled all 12 stored pages with `profilePath`, `fullName`, `nameInHomeCountry` and `capsGoals`
- The lists list each player in match order, home XI then away XI, the XI as the page lists it (D2); a player starting twice is tagged by their first match
- Before your part, 2026-10-27: `s11b-players` and `s11b-pilot` both have **65 players** (the 3 pilot matches are the only pool matches with a saved report: 3/61)
- After your part, 2026-10-27: 65/65 imported and parsed; `npm run resolve` gives 65 player slugs, 0 waiting, rerun byte-identical
- `Name in home country:` holds the full name on 36 of 66 pages, `Full name:` on 6, never both; one is Cyrillic (`135`)
- `capsGoals` is `N / M` on 65 pages, retired players too; `null` for `6877`, never capped
- `411295` (a parser fixture, not in the pool) gets no slug: only pool match players do
- `/feature test`: two of your pages are parser fixtures, `player-206` (home name, retired caps) and `player-6877` (no caps)

## History
