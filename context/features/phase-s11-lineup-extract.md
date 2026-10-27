# Phase S11 — Lineup Extract

## Status

Complete

## Goals

- **Pool match list as a schema** `schemas/work/pool-matches.schema.json`, exported from `matchListSchema` (`src/pool/build.ts`) by `npm run schemas`, so Python reads `data/work/pool/matches.json` through a generated schema, as it reads `pool.json`
- **Match-report link lists** `extract/lists/match_reports.py` (`uv run python -m extract.lists.match_reports`), written with `write_link_list`:
  - `s11-match-reports`: one entry per pool match, `https://www.transfermarkt.com/spielbericht/index/spielbericht/{id}`, kind `match`, saveAs `match-<id>.html`, with `group`, `competition` and `season`. Rewritten from the current pool on every run, so it grows as listing pages are saved
  - `s11-pilot`: the 3 pilot matches (`990248`, `53491`, `1118844`); `extract.links show` leaves out `990248`, already saved
- **Formation** `src/lineups/formation.ts`, pure:
  - Strip `Starting Line-up:` and take the digits (`3-5-2 flat` → `3-5-2`)
  - Named shapes from a curation file, `data/curation/formations.json` (decision D1): `4-4-2 Diamond` → `4-1-2-1-2`, `3-4-3 Diamond` → `3-1-2-1-3`, `5-4-1 Diamond` → `5-1-2-1-1` (`transfermarkt-source.md` § 5)
  - The result must pass `formationSchema` (`src/dataset/formation.ts`). Anything else gives the side a `null` formation and a report line, never a guess (`data-contract.md` § 9.2: such a match is never played)
- **Slots** `src/lineups/slots.ts`, pure (`transfermarkt-source.md` § 5, `link-map.md` § 6):
  - Read `top` and `left` from each starter's `style`. Slot 0 is the one starter at `top: 80%`
  - Sort the other ten by `top`, descending; chunk them by the formation's line sizes; inside each line sort by `left`, descending (right to left); number them 1–10
  - **Refuse an ambiguous mapping:** lines that overlap in `top` (a line's lowest `top` not above the next line's highest), two starters with one `left` in a line, no keeper or two, or not 11 starters. The side is reported and gets no slots
  - `position = positionForSlot(formation, slot)` (`data-contract.md` § 6.6), never a Transfermarkt role label
- **Score, extra time, shootout** `src/lineups/score.ts`, pure:
  - **Goals per side from the goal events' running score** (`0:1`, `1:1`): the last one is the full-time score, extra time included. A goal counts for the side whose number rises, so an own goal needs no text rule (`data-contract.md` § 2.10)
  - **Checks:** without `on pens`, `sb-endstand` must equal the counted score. A mismatch holds the match back
  - **Shootout:** on `on pens`, `sb-endstand` is the shootout (`5:4` on `990248`, equal to its 5 and 4 scored kicks); it must not be a draw (`matches_shootout_check`)
  - **`extraTime`:** `true` on `AET` or `on pens`, else `false`; always a boolean
  - **Half-time score** for S10's comeback signal: the `(1:0)` note when the page has one; otherwise counted from goals at minute 45 or earlier; `null` if a goal's minute is unknown
- **Events** `src/lineups/events.ts`, pure:
  - **Minute from the clock sprite:** `background-position: -Xpx -Ypx` → minute `1 + X/36 + 10·Y/36`; with added time (`+2`) the minute is the end of the half it hangs off (45, 90, 105 or 120) and `addedTime` the number (`data-contract.md` § 2.10)
  - A sprite off the 36 px grid (`-0px -433px`) is an unknown minute: `null`, and reported
  - **Kinds:** goal → `goal`, or `penalty_goal` when its text has `, Penalty,`, or `own_goal` when its player is in the other side's XI or bench (the text rule is unverified, `link-map.md` § 9). Card → `red_card` for a red card or a second yellow (decision D2); yellow cards dropped. Substitutions dropped
  - `player`: the first player of the event, as a Transfermarkt id (a substitute who scores is fine; S08b may give them no slug yet)
- **Checks against the listing**: the report's date and its home and away club ids must equal the pool match's. A mismatch holds the match back (`enrichment-guide.md` § 6: "A match report whose date or teams disagree with its listing")
- **Stage** `src/lineups/main.ts`, `npm run lineups`, after `npm run resolve`:
  - Reads `data/work/resolved/matches.json` and the latest `transfermarkt-match` record per id (as S08b does)
  - Writes `data/work/lineups/matches.json`: per resolved match with a saved report, its slug, `extraTime`, `shootout`, `halfTime`, both sides (`goals`, `formation`, 11 starters as `slot`, `position`, `transfermarktId`) and its events. Sorted by slug, deterministic: a rerun with no new input changes no byte
  - Writes `data/reports/lineups.md`: matches with no saved report (the to-save count), held-back matches with the reason, sides with no formation or no slots, events with an unknown minute, the formation texts seen with their counts, and **the fixture list's `result` against the report's score and shootout** (settles `link-map.md` § 9's first item). Ids and slugs only, never an XI or a name
- **Tests** `src/lineups/*.spec.ts`, pure, on the three saved reports' raw records:
  - Formations: digits, `flat`, the 3 diamonds and an unknown text
  - Slots: all 6 saved sides, the diamond and the 5-4-1 of `990248` among them; each refusal
  - Minutes: `-72px -0px` → 3 and `-324px -144px` → 50 (`990248`: the page's own timeline puts its two goals at 2.5 % and 41.67 % of 120 minutes); `-324px -288px` with `+2` → 90+2 (`1153409`); `-0px -433px` → unknown
  - Score: running score, own goal, the `990248` shootout, the endstand mismatch, half time from the note and from the events
  - Red card and second yellow; date and team mismatches; deterministic output
  - `extract/tests/test_match_report_lists.py`: both lists from a small pool file, every match once, saveAs names
- **Docs:** `link-map.md` § 3 and § 9 (minute rule verified, penalties result settled), `transfermarkt-source.md` § 4 and § 5, `CLAUDE.md` § Commands (`npm run lineups`, `extract.lists.match_reports`), `manual-work.md` row S11

## Your part

You save **2 match reports**. Bayern–Valencia (`990248`) is already saved. You can save them now: the links are known.

1. Save each as **HTML only** into `data/inbox/` (`context/docs/manual-work.md` § How to save a page):

   | Save as | Link |
   | --- | --- |
   | `match-53491.html` | `https://www.transfermarkt.com/spielbericht/index/spielbericht/53491` (Italy–France, 2006 World Cup final) |
   | `match-1118844.html` | `https://www.transfermarkt.com/spielbericht/index/spielbericht/1118844` (Fenerbahçe 6–0 Galatasaray, 2002-03) |

   Once `/feature start` has written the list, `uv run python -m extract.links show s11-pilot` gives the same two lines.

2. Run `uv run python -m extract.inbox`. It should report 2 imported.
3. Tell Claude. The real run (`npm run resolve`, then `npm run lineups`) needs both pages.

## Decisions

Settled at `/feature load`, 2026-10-27 (all three as proposed):

- **D1. Named formations in curation** (approved). `data/curation/formations.json` maps a Transfermarkt formation text to a formation (the 3 diamonds to start). Any other text uses its digits. A new shape seen in the report is added there by hand
- **D2. A second yellow is a `red_card`** (approved). The database has no second-yellow kind, and it's a sending-off either way
- **D3. A goal or red card with an unknown minute is kept** (approved): in `data/work/lineups/` with `minute: null`, and reported. S10 still counts it as drama; S14 leaves it out of `match_events`, whose `minute` can't be null

## Out of Scope

- Player slugs for the starters: S08b's crosswalk, joined in **S14**. Here starters are Transfermarkt ids
- The player link list: **S11b**
- The guessability gate (11 resolved starters with aliases): **S13**. S11 only reports sides that can't be mapped
- Stage text from the report's round: every pool match already has one from its listing (61 of 61)
- Coaches, attendance, shirt numbers and captains: no column (`data-contract.md` § 2)

## Notes

- Scope: match reports to XIs, formations, slots, scores and events, plus the match-report link lists. TypeScript for the stage; Python only for the link lists. **One spec, not split:** the Python part is one small writer, and the next letter, S11b, is already `todo.md`'s Player Pages phase.
- Depends on: S07b (`data/work/pool/matches.json`), S08a (`data/work/resolved/matches.json`), S06b (the `transfermarkt-match` raw records), S04 (`formationSchema`, `positionForSlot`).
- Checked on the saved pages before writing this spec:
  - The slot rule separates the lines cleanly on all 6 saved sides (`3-4-1-2`, `3-1-4-2`, `4-2-3-1` ×2, `5-4-1`, `4-4-2 Diamond` → `4-1-2-1-2`)
  - The sprite rule agrees with the page's timeline on `990248`. The timeline is `sb-120-minuten` there and `sb-90-minuten` on the other two
  - `990248`'s `sb-endstand` `5:4` equals its shootout box's scored kicks (5 and 4)
- Unverified until `53491` is saved: a straight red card's text and sprite (Zidane), and the World Cup fixture list's `6:4 on pens` against the report.
- Constraints:
  - Starting XI only; substitutes are never stored (Hard Constraint 17)
  - Exactly 11 starters, slots 0–10, keeper in slot 0, `position` from `positionForSlot` (`data-contract.md` § 6.5, § 6.6)
  - `minute` 1–120; `added_time` 1–30 only on 45, 90, 105 or 120; the shootout never a draw (§ 2.7, § 2.10)
  - Never parse a text date; never key on a name; reports name ids and slugs, never an XI
  - No score or minute from memory: from the saved page only
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`, `uv run ruff check`, `uv run mypy extract`. After your part: `npm run resolve`, then `npm run lineups` on the 3 pilot matches, with 6 sides mapped, the 2001 and 2006 finals marked extra time with a shootout, and the derby at 6–0. A second run changes no byte.

**Deviations recorded during implementation**

- **`poolMatchesSchema`** (`z.array(poolMatchSchema)`) is exported, not `matchListSchema`: that one is the shape of `pool-include.json` and `excluded-matches.json`. The resolver reads the pool through it too
- **`resolvedMatchSchema`** (Zod, in `src/resolve/resolve.ts`) replaces the `ResolvedMatch` interface, so `npm run lineups` parses `data/work/resolved/matches.json`
- **The raw-record readers** (`ndjsonLines`, `readRecords`, `latest`) moved from `src/resolve/main.ts` to `src/raw/read.ts`, shared by both stages
- **Formation = the leading lines**, not every digit: the old dataset's `4-4-2 double 6` would otherwise read `4-4-2-6`. Its other styles are `flat`, `Attacking`, `Defending`
- **A side the slots refuse keeps no formation either** (`null`, no starters), so a shape the XI doesn't fit is never loaded. Without curation the 2001 final's diamond reads `4-4-2` and is refused: its holding and attacking midfielders share `left: 40%`
- **A held-back match** (date or teams differ, a running score that jumps, a shown score that differs from the goals, a drawn shootout, an unknown result note) is left out of `data/work/lineups/matches.json` and listed in the report
- **Events are sorted by minute**, unknown minutes last; cards that are neither yellow nor red are counted in the report
- `s11-pilot` lists only pilot matches already in the pool (all 3 are), and says which aren't
- **The shootout is counted from its kicks, not `sb-endstand`** (the spec's rule was wrong). On `53491` the box shows `6:4`: the 1:1 plus a 5:3 shootout (5 and 3 `Scored` kicks, 1 `Missed`), while `990248`'s `5:4` is the shootout alone. So the parser now reads `#sb-elfmeterscheissen`, a new raw field `shootout` (each kick's `side` and its `outcome`, `Scored`, `Missed` or `Saved`), and the box is only a check: it must equal the shootout or the score plus it
- **`extract.inbox --reparse`** (added, not in the spec): rebuilds every raw record from `data/pages/` after a parser change. It parses all pages first and changes nothing if one fails. Used once here; S11b's parser change needs it too
- `53491` and `1118844` are committed as parser fixtures (`extract/tests/fixtures/transfermarkt/`): the only saved pages with a straight red card and a box that adds the score
- **Checked on the 3 pilot pages:** all 13 goals and red cards agree with each page's own timeline (3' to 110'); a straight red card's text is `Red card`
- Your part done, 2026-10-27: `53491` and `1118844` saved and imported
- Real run, 2026-10-27: **3 matches read, 0 held back, all 6 sides mapped**, 58 waiting for a report. `990248`: 5-4-1 against `4-1-2-1-2`, 1:1, half time 0:1, extra time, shootout 5:4. `53491`: `4-4-1-1` against `4-2-3-1`, 1:1, half time 1:1 (from the goals), extra time, shootout 5:3, a red card at 110'. `1118844`: `4-3-3` against `4-4-2` (from `4-3-3 Attacking` and `4-4-2 double 6`), 6–0, half time 2:0, red cards at 57' and 84'. Fixture results: `990248` shootout only, `53491` score plus shootout. A second run changes no byte
- Review: a raw record that fails its schema now says to run `extract.inbox --reparse`, since records from before a parser change lack its new field
- Test: `ndjsonLines` and `readRecords` take an optional raw folder, so `src/raw/read.spec.ts` runs on a temporary one

## History

- 2026-10-27: 3 pilot matches read; shootout from kicks; `extract.inbox --reparse`
