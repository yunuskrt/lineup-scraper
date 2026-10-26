# Transfermarkt Source

The source this repo collects from, and the facts every fetching and parsing phase relies on. Decided on 2026-10-26; the evidence is in `context/fixes/2026-10-26-transfermarkt-context.md`.

- **Source:** `https://www.transfermarkt.com`, English site. It replaces Mackolik, whose S02 report (`source-trial.md`) stays as history.
- **Why:** it is the only probed source with a formation and pitch coordinates for every starter, back to 2000–01. The data contract can't play a match without a formation (`data-contract.md` § 9.2).
- **Shared spec:** `project-overview.md` § Sources names Transfermarkt primary for development. The backend changed it on 2026-10-26 (`lineup-backend` `95d7fce`), and plan fix P0 is done.
- **Licence:** Transfermarkt must be licensed or replaced before the app is marketed (`coding-standards-scraper.md` § Sources).

## 1. Where to look

| Need | Read |
| --- | --- |
| How the old scraper worked: URL types, selectors, linking, validation | `docs/legacy_transfermarkt_scraper_reference.md` (the reference). Its selectors were written in 2024; § 4 below says which still work |
| The old code, for porting | `/Users/yunuskerestecioglu/Desktop/LINEUP old/lineup-scraper` (read-only; quote the path). Start at `transfermarkt/champions_league/parse_html.py` (match report), `players/parse_html.py`, `teams/parse_html.py` |
| What this repo stores | `data-contract.md`. The old repo kept coaches, stadiums, attendance, referees, height and foot; this schema has no column for any of them, so they are not collected |

Never run, edit or import anything in the old repo.

## 2. Link types used here

Base `https://www.transfermarkt.com`; page links are relative. The numeric id at the end of a link is the entity's `sourceId`.

| Link | Pattern | Gives | Live check, 2026-10-26 |
| --- | --- | --- | --- |
| League season fixtures | `/{slug}/gesamtspielplan/wettbewerb/{CODE}?saison_id={YYYY}` | Every match of the season: teams, score, match link | Works (IT1 2000: 306/306) |
| Cup season fixtures | `/{slug}/gesamtspielplan/pokalwettbewerb/{CODE}/saison_id/{YYYY}` | Every match link | Works; use a scan of all `/spielbericht/` links (§ 4) |
| Tournament fixtures | `/{slug}/gesamtspielplan/pokalwettbewerb/{CODE}{YY}` | World Cup and Euro matches | **Unverified** (not probed) |
| Match report | `/{home}_{away}/index/spielbericht/{id}` or `/spielbericht/index/spielbericht/{id}` | Header, score, XIs with formation and coordinates, bench, events | Works with the new selectors (§ 4) |
| Team in a season | `/{slug}/startseite/verein/{id}/saison_id/{YYYY}` | The team's id, as linked from match pages | Works |
| Player profile | `/{slug}/profil/spieler/{id}` | Name, DOB, citizenship, position | Works (§ 4) |
| Team page | `/{slug}/startseite/verein/{id}` | Name, crest URL | Works |

Competition codes: `GB1`, `ES1`, `IT1`, `L1`, `TR1`, `CL`, `EL`, `WM{YY}`, `EM{YY}` come from the old repo. Only `IT1` and `CL` were probed live. **`FR1` (Ligue 1), `PO1` (Primeira Liga) and `EM00` are unverified.**

## 3. Entities, ids and linking

- **Match:** the `spielbericht/{id}` number. **Club** (or national team): the `verein/{id}` number; drop `/saison_id/…`. **Player:** the `spieler/{id}` number.
- Raw records carry that number as `sourceId`, as a digit string (`src/raw/envelope.ts`). S08's crosswalk (`data/curation/crosswalk/`) maps each `sourceId` to one permanent slug; the slug is the database key (`data-contract.md` § 1.4).
- **No `uuid3` ids.** The reference hashes the whole URL (§ 7.1), so a renamed URL slug would change the id. The numeric id doesn't change.
- Per-match facts (shirt number, coordinates, captain) belong to the match side, as in the reference § 7.2.

## 4. Selectors: what still works

Checked live on 2026-10-26 (T1–T9 in the evidence table of the context fix).

| Reference | Status | Use instead |
| --- | --- | --- |
| § 3.1 league rows, `a.ergebnis-link` | Works | — |
| § 3.3 cup layout (child divs, then the last box) | **Breaks** on 2000–01 (85 of 157) | Collect every distinct `a[href*="/spielbericht/"]` in the page |
| `div.sb-team sb-heim` / `sb-gast` → `a.sb-vereinslink` | Works | — |
| Table position from `homeBox` for both sides (§ 12 #1) | Bug | Each box's own `p` (`Position: 16`); absent on matchday 1 and in cups |
| `p.sb-datum hide-for-small` date text | **Format changed:** `8/12/23` → `12/08/23` | The `datum/YYYY-MM-DD` link on the page (present on all three probed matches). Never parse the text date |
| `div.sb-endstand`, `div.sb-halbzeit` | Works | On `on pens`, `sb-endstand` is the **shootout** score |
| Formation `div.large-7 … aufstellung-unterueberschrift` | **Class renamed** | `div.formation-subtitle`, text `Starting Line-up: 4-4-2 Diamond` |
| Starters `div.aufstellung-spieler-container` | **Renamed** | `div.formation-player-container` (11 per side), `style="top: 80%; left: 40%;"` |
| Starter name `span.aufstellung-rueckennummer-name > a` | **Renamed** | `span.formation-number-name > a` |
| Shirt numbers, `kapitaenicon-formation`, `table.ersatzbank` (coach in the last row) | Works | — |
| Event boxes `sb-tore`, `sb-karten`, `sb-wechsel` | Not in the reference; present | `li.sb-aktion-heim` / `sb-aktion-gast`, with a clock sprite `span.sb-sprite-uhr-klein` (`background-position`) and added time as text (`+2`) |
| Player h1, info table (`…min-height-audio` fallback) | Works | Strip the `#11` shirt number from the h1 |
| Player DOB `%b %d, %Y` | **Format changed** | `DD/MM/YYYY (age)` |
| Crest host `tmssl.akamaized.net` | **Changed** | `img.a.transfermarkt.technology/wappen/head/{id}.png` |

**Unverified:** the clock-sprite → minute rule. One check agrees: `-324px -288px` with `+2` is 90+2, if a cell is 36 px and a row holds 10 minutes. Verify it on fixtures with known minutes before relying on it. A card at `-0px -433px` doesn't fit the 36 px grid; it may mean "minute unknown".

## 5. Formation, slots and positions

- **Formation:** take the digits of the formation text (`3-5-2 flat` → `3-5-2`). Diamonds name the shape, not the lines, so map them explicitly: `4-4-2 Diamond` → `4-1-2-1-2`, `3-4-3 Diamond` → `3-1-2-1-3`, `5-4-1 Diamond` → `5-1-2-1-1`. The result must pass `formationSchema`. **Unverified:** strings that aren't among the old dataset's 25.
- **Slots:** slot 0 is the starter at `top:80%`. Sort the other ten by `top`, descending; chunk them by the formation's line sizes; inside each line sort by `left`, **descending**, since `left:73%` is the right back in the old repo's `data/positions/positions.json`. Number slots 1–10 in that order. This separates the lines in all 18,404 old XIs.
- **Position:** always `positionForSlot(formation, slot)` (`data-contract.md` § 6.6). Never copy a Transfermarkt role label.

## 6. Pitfalls: do not port

From the reference § 12, with this repo's rule:

1. Away table position read from the home box → read each side's own box.
2. 12-hour clock bugs and `"20" + YY` → no text dates; use the `datum/` link. No kick-off times are stored.
3. Lost half-time score and an unclear full-time score on `AET` / `on pens` → the full-time score is counted from the goal events; `sb-endstand` is the shootout on `on pens`.
4. Tri-state `null` flags → `extraTime` is always a boolean.
5. Duplicated rows on rerun → the Scrapy cache and idempotent writes.
6. `raise "Page not parsed"` → real exceptions.
7. No throttle, retry or backoff → Scrapy AutoThrottle, retries, one request at a time (`coding-standards-scraper.md` § Sources).
8. Lookups re-read per match → load once.
9. Files opened without an encoding → always UTF-8.
10. Filters on English team names → filter on numeric club ids.
11. Copy-pasted parsers per competition → one parser, per-competition config.

## 7. Fetching rules

- Send `Accept-Language: en-US,en;q=0.9` with every request: labels and formats are English-dependent.
- Fetch only what a phase needs: fixture lists for the universe (S07), match reports for the shortlist (S11, ≤ ~3,600 pages, `match-pool-scope.md` § 3), player pages for pool players (S08).
- **Images:** Transfermarkt photos and crests are copyrighted and trademarked. Don't bulk-upload them (`project-overview.md` § Data Architecture); S18 decides.
