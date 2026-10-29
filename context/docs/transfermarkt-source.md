# Transfermarkt Source

The source this repo collects from, and the facts every fetching and parsing phase relies on. Decided on 2026-10-26; the evidence is in `context/fixes/2026-10-26-transfermarkt-context.md`.

- **Source:** `https://www.transfermarkt.com`, English site. It replaces Mackolik, whose S02 report (`source-trial.md`) stays as history.
- **Why:** it is the only probed source with a formation and pitch coordinates for every starter, back to 2000–01. The data contract can't play a match without a formation (`data-contract.md` § 9.2).
- **Shared spec:** `project-overview.md` § Sources names Transfermarkt primary for development. The backend changed it on 2026-10-26 (`lineup-backend` `95d7fce`), and plan fix P0 is done.
- **Licence:** Transfermarkt must be licensed or replaced before the app is marketed (`coding-standards-scraper.md` § Sources).
- **Collection: pages saved by hand.** Transfermarkt challenges automated requests (§ 8), so no spider, script or Playwright session fetches it. The user saves pages in their own browser; `extract.inbox` parses them. The steps for the user are in `manual-work.md`.

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
| Tournament fixtures | `/{slug}/gesamtspielplan/pokalwettbewerb/{FIWC or EURO}/saison_id/{year − 1}` | World Cup and Euro matches | Works (`fiwc-2005`, `euro-2003`; the old `WM06` and `EM04` links redirect here) |
| Match report | `/{home}_{away}/index/spielbericht/{id}` or `/spielbericht/index/spielbericht/{id}` | Header, score, XIs with formation and coordinates, bench, events | Works with the new selectors (§ 4) |
| Team in a season | `/{slug}/startseite/verein/{id}/saison_id/{YYYY}` | The team's id, as linked from match pages | Works |
| Player profile | `/{slug}/profil/spieler/{id}` | Name, DOB, citizenship, position | Works (§ 4) |
| Team page | `/{slug}/startseite/verein/{id}` | Name, crest URL | Works |

Competition codes: `GB1`, `ES1`, `IT1`, `L1`, `TR1`, `CL`, `EL`, `WM{YY}`, `EM{YY}` come from the old repo. Only `IT1` and `CL` were probed live. **The World Cup is `FIWC` with `saison_id` = tournament year − 1:** the old `WM06` link redirected to `/pokalwettbewerb/FIWC/saison_id/2005` (saved page, 2026-10-27). **The Euro is `EURO` the same way:** `EM04` redirected to `/pokalwettbewerb/EURO/saison_id/2003` (saved page, 2026-10-27), so Euro 2000 is `saison_id` 1999. `TR1` is verified by `tr1-2002`. **`GB1`, `ES1`, `L1`, `FR1`, `PO1` and `EL` are unverified**; one sample of each is in `s07-verify`.

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
| `div.sb-endstand`, `div.sb-halbzeit` | Works | On `on pens`, `sb-endstand` is the shootout on `990248` (`5:4`) but the score plus the shootout on `53491` (`6:4` for 1:1 and 5:3). The shootout comes from `#sb-elfmeterscheissen`: each kick's clock `span` has the title `Scored`, `Missed` or `Saved` (S11) |
| Formation `div.large-7 … aufstellung-unterueberschrift` | **Class renamed** | `div.formation-subtitle`, text `Starting Line-up: 4-4-2 Diamond` |
| Starters `div.aufstellung-spieler-container` | **Renamed** | `div.formation-player-container` (11 per side), `style="top: 80%; left: 40%;"` |
| Starter name `span.aufstellung-rueckennummer-name > a` | **Renamed** | `span.formation-number-name > a` |
| Shirt numbers, `kapitaenicon-formation`, `table.ersatzbank` (coach in the last row) | Works | — |
| Event boxes `sb-tore`, `sb-karten`, `sb-wechsel` | Not in the reference; present | `li.sb-aktion-heim` / `sb-aktion-gast`, with a clock sprite `span.sb-sprite-uhr-klein` (`background-position`) and added time as text (`+2`) |
| Player h1, info table (`…min-height-audio` fallback) | Works | Strip the `#11` shirt number from the h1 |
| Player DOB `%b %d, %Y` | **Format changed** | `DD/MM/YYYY (age)` |
| Crest host `tmssl.akamaized.net` | **Changed** | `img.a.transfermarkt.technology/wappen/head/{id}.png` |
| Match report crests (S18a) | Works | Each side's box (`div.sb-team sb-heim` / `sb-gast`) holds `img[src*="/wappen/"]`: `…/wappen/normquad/{clubId}_{stamp}.png`, or `{clubId}.png` with no stamp (`36.png`, Fenerbahçe). One club can show both forms in different reports (`141.png`, `141_1751657220.png`) |
| Player photo (S18a) | Works | `img.data-header__profile-image`, `…/portrait/header/{playerId}-{stamp}.jpg` (139×181), an older `s_{playerId}_{clubId}_{date}_{n}.jpg` (7 of the pilot's 65), or `default.jpg`, a placeholder |

**Clock sprite → minute** (S11, `src/lineups/events.ts`): `background-position: -Xpx -Ypx` is minute `1 + X/36 + 10·Y/36`; with added time (`+2`) that minute is the end of the half (`-324px -288px` `+2` is 90+2). Checked against each page's own timeline (`div.sb-zeitleiste`, `sb-120-minuten` with extra time, else `sb-90-minuten`) on the 3 pilot reports: all 13 goals and red cards agree, from 3' to Zidane's red card at 110'. A sprite off the 36 px grid (`-0px -433px`, seen on cards) is an unknown minute: the event is kept with `minute: null` and left out of the load.

## 5. Formation, slots and positions

- **Formation:** take the leading lines of the formation text (`3-5-2 flat` → `3-5-2`, `4-4-2 double 6` → `4-4-2`; the old dataset's styles are `flat`, `Attacking`, `Defending`, `double 6`). Diamonds name the shape, not the lines, so they're mapped in `data/curation/formations.json` (S11): `4-4-2 Diamond` → `4-1-2-1-2`, `3-4-3 Diamond` → `3-1-2-1-3`, `5-4-1 Diamond` → `5-1-2-1-1`. The result must pass `formationSchema`; otherwise the side has no formation. `data/reports/lineups.md` lists every formation text seen, so a new named shape can be added.
- **Slots:** slot 0 is the starter at `top:80%`. Sort the other ten by `top`, descending; chunk them by the formation's line sizes; inside each line sort by `left`, **descending**, since `left:73%` is the right back in the old repo's `data/positions/positions.json`. Number slots 1–10 in that order. This separates the lines in all 18,404 old XIs. S11 refuses a side whose lines overlap in `top` or share a `left`: a diamond read as `4-4-2` fails, since its holding and attacking midfielders share `left: 40%`.
- **Position:** always `positionForSlot(formation, slot)` (`data-contract.md` § 6.6). Never copy a Transfermarkt role label.

## 6. Pitfalls: do not port

From the reference § 12, with this repo's rule:

1. Away table position read from the home box → read each side's own box.
2. 12-hour clock bugs and `"20" + YY` → no text dates; use the `datum/` link. No kick-off times are stored.
3. Lost half-time score and an unclear full-time score on `AET` / `on pens` → the full-time score is counted from the goal events' running score and the shootout from its kicks; `sb-endstand` is only a check.
4. Tri-state `null` flags → `extraTime` is always a boolean.
5. Duplicated rows on rerun → the page store (`data/pages/`) and idempotent writes.
6. `raise "Page not parsed"` → real exceptions.
7. No throttle, retry or backoff → no automated Transfermarkt requests at all (§ 8). The harness throttles the sources it does fetch.
8. Lookups re-read per match → load once.
9. Files opened without an encoding → always UTF-8.
10. Filters on English team names → filter on numeric club ids.
11. Copy-pasted parsers per competition → one parser, per-competition config.

## 7. What to collect

- Collect only what the pool needs (`match-pool-scope.md`, curated groups since 2026-10-27): listing pages for the groups (S07, 247), one match report per pool match (S11, ~2,000), and the player page of every pool starter (S11b, ~5,000–8,000), since the match report shows only a short name such as `Kily Gonzá.`. Each phase writes the exact list of links for the user. The page-by-page map is `link-map.md`.
- The English site only (`www.transfermarkt.com`): labels and formats are English-dependent.
- **Images:** the user saves crests and photos by hand in S18 (decided 2026-10-27). Photos and crests are copyrighted and trademarked, so each image's licence is checked before release (`project-overview.md` § Data Architecture).

## 8. Collection: pages saved by hand

**The block.** On 2026-10-26 the S06a harness sent 8 requests with the honest UA `lineup-scraper/0.1 (personal, non-commercial; development)`. All 8 got `202` with `X-Amzn-Waf-Action: challenge` (AWS WAF behind CloudFront) and a page that loads `token.awswaf.com/…/challenge.js`. The step-4 probes weren't challenged only because they sent a desktop Chrome UA, as did the old repo (old `transfermarkt/*/save_html_pages.py`, Chrome 91). A block stops a source (`coding-standards-scraper.md` § Sources), so:

- **Never** fetch Transfermarkt with a spider, a script, a fake browser UA, or a browser driven by code or the Playwright MCP
- The S06a harness stays (`extract/crawl.py`, `BlockGuard`, the guarded cache). It serves any source that allows automated access, if a later phase needs one (Wikipedia was dropped with S09 on 2026-10-27). A later Transfermarkt retry with the honest UA is allowed only with the user's approval, and `BlockGuard` stops it at the first challenge

**The flow** (built in S06b):

1. A phase writes a link list (`data/work/link-lists/<list>.json`, for example `s07-fixtures`) and tells the user the size of the batch. `uv run python -m extract.links show <list>` writes the to-save copy, `data/work/inbox-lists/<list>.md`; `extract.links open <list>` opens the next links in the user's browser (`link-map.md` § 8).
2. The user opens each link in their own browser and saves it as HTML only into `data/inbox/` (`manual-work.md` § How to save a page).
3. `uv run python -m extract.inbox`:
   - Reads each file's `og:url`, which every probed page carries, including the `saison_id`
   - Classifies the page (fixture list, match report, player) and refuses challenge pages with `extract.middlewares.is_challenge_html`
   - Parses the page with the S06b parsers and writes raw records through `RecordWriter`
   - Moves the file to `data/pages/transfermarkt/<kind>/<id>.html`, the local page store, which replaces the HTTP cache for Transfermarkt
   - Reports what's missing from the phase's list, and appends one line per file to `data/work/import-log.ndjson`
4. `fetchedAt` is the saved file's modification time in UTC: when the user saved it.
5. After a parser change, `uv run python -m extract.inbox --reparse` rebuilds every raw record from the stored pages. It parses them all first and changes nothing if one fails.

`data/inbox/` and `data/pages/` are gitignored, like `data/cache/`. Parser test fixtures are hand-saved pages too, copied into `extract/tests/fixtures/transfermarkt/` and committed.
