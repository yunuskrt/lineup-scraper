# Fix — Transfermarkt Source: Context Files

## Status

Not Started

## Goals

Docs-only fix. Every change below is given as exact text in § Changes; apply it as written.

- **Commit the reference**: `context/docs/legacy_transfermarkt_scraper_reference.md` is untracked (`git status` on 2026-10-26). Add it unchanged; every doc below links to it
- **Create `context/docs/transfermarkt-source.md`**: the repo-specific source facts (§ Changes, change 1)
- **`CLAUDE.md`**: add a "Data source" paragraph under `## Architecture` (§ Changes, change 2)
- **`context/coding-standards-scraper.md` § Sources**: add the Transfermarkt rules (§ Changes, change 3)
- **`context/docs/collection-phases.md`**: name Transfermarkt in the S07, S11 and S18 rows (§ Changes, change 4)
- **`context/docs/source-trial.md`**: add a "superseded" banner under the title, keep the body (§ Changes, change 5)
- **`context/README.md`**: list the two new docs (§ Changes, change 6)
- Leave `project-overview.md` and `data-contract.md` untouched: both are backend-owned (§ Out of scope)

## Background and decision

**Decision, 2026-10-26: Transfermarkt (transfermarkt.com, English site) replaces Mackolik as this repo's data source** for fixtures, lineups, formations, positions, events and player profiles. The user made it after a live probe of both sites and a review of the old Transfermarkt scraper.

- **Why:** the data contract can't load a match without a formation: a `NULL` formation is never played (`context/docs/data-contract.md` § 9.2), and every slot's `position` is derived from it (§ 6.6). **Mackolik has no formation or positions in any year** (`context/docs/source-trial.md:20`, confirmed again on 2026-10-26: the `MatchData.aspx` JSON for match 439931 has only the keys `a, away, d, e, h, home, seq, sv`). **Transfermarkt has a formation and pitch coordinates for every starter, back to 2000–01**, checked live on two 2000–01 matches.
- **Also decided:**
  - The shared spec is changed **backend-first**, before any crawl. `context/project-overview.md:173` still reads "Transfermarkt, FBref, worldfootball.net: Manual spot-checking only — never scraped programmatically (ToS)". That change is item P0 of the plan fix
  - **Refetch, don't import.** The old repo's 9,202 cached pages (August 2024, old layout, big-team filtered) are reference only
  - **Ids are Transfermarkt's numeric ids**, mapped to permanent slugs by S08's crosswalk, not the reference's `uuid3` of a URL
- **Superseded:** the Mackolik verdicts in `context/docs/source-trial.md` § 1 and the S05 Mackolik raw kinds (`src/raw/mackolik-*.ts`). The S02 report stays as evidence. Code removal is in the plan fix: **`context/fixes/2026-10-26-transfermarkt-plan.md`**, item P8.

## Evidence

**Live probes, 2026-10-26**, one request at a time, 4 s apart. Transfermarkt used the reference's § 2 headers (desktop Chrome UA, `Accept-Language: en-US,en;q=0.9`). Every response was `200`, with no CAPTCHA, Cloudflare challenge or login wall. The files were saved outside the repo, in a session scratch folder.

| # | URL | What it showed |
| --- | --- | --- |
| T1 | `https://www.transfermarkt.com/robots.txt` | `User-agent: *` `Allow: /`; only `wget` is disallowed |
| T2 | `/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2000` | 157 distinct `/spielbericht/` links. Reference § 3.3 selectors find only 85 (72 group + 13 knockout) |
| T3 | `/spielbericht/index/spielbericht/990248` (2001 UCL final) | Formations `5-4-1` and `4-4-2 Diamond`; 11 starters per side with coordinates; `sb-endstand` `5:4` with `sb-halbzeit` `on pens` (the shootout score); date text `Wed, 23/05/01`; link `datum/2001-05-23` |
| T4 | `/serie-a/gesamtspielplan/wettbewerb/IT1?saison_id=2000` | Reference § 3.1 selectors: 306 of 306 matches |
| T5 | `/juventus-fc_as-bari/index/spielbericht/1153409` (Serie A 2000–01, first Juventus home match against a non-curated club) | Formations `3-4-1-2` and `3-1-4-2`; 11 starters per side; coaches linked (`/carlo-ancelotti/profil/trainer/523`); `Position: 2` and `Position: 16` in each team's own box; `sb-tore` 2 goals, the second with text `+2`; `sb-karten` 7, `sb-wechsel` 5; link `datum/2000-10-15` |
| T6 | `/kayserispor_galatasaray/index/spielbericht/4126774` (the reference's own example) | Date text `12/08/23`. The same match cached by the old repo in August 2024 read `8/12/23` (old file `transfermarkt/super_lig/data/raw_html/26168e295e693dcfa265f02cb0ba0133.html`) |
| T7 | `/raphinha/profil/spieler/411295` | h1 `#11 Raphinha`; DOB `14/12/1996 (29)`; info table: `1,76 m`, `Attack - Centre-Forward`, `left`, `Brazil Italy` |
| T8 | `/laurent-blanc/profil/trainer/4589` | h1 and DOB `19/11/1965 (60)` |
| T9 | `/fc-paris-saint-germain/startseite/verein/583` | h1 `--oswald` works; crest `https://img.a.transfermarkt.technology/wappen/head/583.png?lm=…`; `Parc des Princes 48.583 Seats` |

**Mackolik, same day:** robots.txt unchanged from S02 (`anthropic-ai` disallowed). Coaches are linked as `/Antrenor/6/Ottmar-Hitzfeld`. The player page `/Futbolcu/5436/…` gives `D.Tarihi : 15.06.1969`, `Boy : 188 cm`, `Pozisyon : Kaleci`, and no foot.

**Old dataset** (`/Users/yunuskerestecioglu/Desktop/LINEUP old/lineup-scraper/data/non-relational/matches.json`, read-only):
- 9,202 matches, 18,404 sides, every one with 11 starters and a formation (25 distinct strings)
- The keeper is always at `top:80%`
- Sorting the other 10 by `top`, descending, and chunking by the formation's digits separates the lines in **all** 18,404 sides. Diamonds are mapped explicitly; see the new doc § 5

## Changes

### Change 1: create `context/docs/transfermarkt-source.md`

Create the file with exactly this content:

````markdown
# Transfermarkt Source

The source this repo collects from, and the facts every fetching and parsing phase relies on. Decided on 2026-10-26; the evidence is in `context/fixes/2026-10-26-transfermarkt-context.md`.

- **Source:** `https://www.transfermarkt.com`, English site. It replaces Mackolik, whose S02 report (`source-trial.md`) stays as history.
- **Why:** it is the only probed source with a formation and pitch coordinates for every starter, back to 2000–01. The data contract can't play a match without a formation (`data-contract.md` § 9.2).
- **Shared spec:** `project-overview.md` § Sources still forbids scraping Transfermarkt. **No crawl runs until the backend changes that row** (plan fix P0).
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
````

### Change 2: `CLAUDE.md`

Insert after line 16 (the paragraph starting `**This repo.**`), followed by a blank line:

```markdown
**Data source.** Transfermarkt (English site), decided 2026-10-26; Mackolik is superseded. Facts, verified selectors and pitfalls: `context/docs/transfermarkt-source.md`. The old Transfermarkt scraper is described in `context/docs/legacy_transfermarkt_scraper_reference.md`. No crawl runs until the backend updates `project-overview.md` § Sources.
```

### Change 3: `context/coding-standards-scraper.md` § Sources

Insert after line 31 (the bullet starting `- **Before the app is marketed**`):

```markdown
- **Transfermarkt** (the source since 2026-10-26, `docs/transfermarkt-source.md`):
  - Send `Accept-Language: en-US,en;q=0.9`.
  - Take match dates only from the page's `datum/YYYY-MM-DD` link, never from the date text.
  - Key every entity on its numeric id; never filter or join on a team or player name.
  - Port from the old repo by reading it; never run or import its code. Don't port the reference's § 12 bugs (`docs/transfermarkt-source.md` § 6).
```

### Change 4: `context/docs/collection-phases.md`

Replace the three rows at lines 9, 11 and 12 of the "Phases that fetch" table:

```markdown
| **S07** Match Metadata Extract | Fixtures, scores, dates, stages, competitions for the whole universe | Transfermarkt fixture lists (`transfermarkt-source.md` § 2) | `data/raw/transfermarkt/fixture/` | S08, S10 |
```

```markdown
| **S11** Lineup Extract | Starting XIs, formations, coordinates, goals and cards, **for the shortlist only** | Transfermarkt match reports | `data/raw/transfermarkt/match/` | S12, S13 |
```

```markdown
| **S18** Image Ingest | Player images, club crests, their licence metadata, **for pool entities only** | Wikimedia Commons (or none: initials). Not Transfermarkt images | `data/raw/images/` | S18's upload |
```

Replace line 14 (`**May fetch:**`) with:

```markdown
**May fetch:** S08, for Transfermarkt player pages (DOB for disambiguation) and Wikidata labels. The fetch is a Python step in that phase.
```

### Change 5: `context/docs/source-trial.md`

Insert after line 1 (`# Source Trial (S02)`), with a blank line before and after:

```markdown
> **Superseded for the source choice on 2026-10-26.** This repo now uses Transfermarkt: Mackolik has no formations, which the data contract requires (`docs/transfermarkt-source.md`). The evidence below stays valid as a record of Mackolik and the other sources.
```

### Change 6: `context/README.md`

Insert after line 19 (the `docs/collection-phases.md` bullet):

```markdown
- `docs/transfermarkt-source.md` - The data source: link types, verified selectors, ids, slots and pitfalls
- `docs/legacy_transfermarkt_scraper_reference.md` - How the old Transfermarkt scraper worked (selectors from 2024; read with the source doc)
```

## Out of Scope

- **`context/project-overview.md`**: shared and backend-owned. Its Sources rows (lines 167–173) change in `lineup-backend` first (plan fix P0), then the file is copied here unchanged
- **`context/docs/data-contract.md`**: backend-owned; no change needed
- **`context/todo.md`**: its phase lines are changed by the plan fix (P2), not here
- Any code, schema or config change. The plan fix covers them: `context/fixes/2026-10-26-transfermarkt-plan.md`
- `context/docs/scraper-repo-setup.md` and `build-order.md`: setup records; their Mackolik mentions stay as history

## Notes

- Scope: context and docs only. No code, config, test or data file changes.
- Depends on: nothing. It can be applied before P0 lands, because it says plainly that no crawl runs until then.
- Constraints:
  - Apply the § Changes text exactly. Line numbers refer to the files as of 2026-10-26; if a file has moved on, place the text by the quoted anchor instead
  - Don't copy the reference into other docs; link to it
  - Keep every "unverified" mark
- Verification:
  - `git status` shows the reference added, `transfermarkt-source.md` created, and the five edited files
  - `npm test`, `uv run pytest` and both linters still pass (nothing they check changed)
  - Every path the new doc names exists, except the old-repo path, which is outside the repo
- Open questions and unverified points:
  - `FR1`, `PO1`, `EM00` and the World Cup and Euro fixture pages weren't probed
  - The clock-sprite minute rule (§ 4 of the new doc)
  - Formation strings beyond the old dataset's 25
  - Whether S08's display names come from Transfermarkt (English, with diacritics, such as `Zinédine Zidane`) or from Wikidata labels, as `docs/scraper-repo-setup.md:1043` proposes. Decide in the S08 spec
  - Mackolik as a later alias source for Turkish spellings (a hybrid): deferred, not planned

**Deviations recorded during implementation**

- P0 landed while this fix was in progress (`lineup-backend` `95d7fce`; this repo's copy is byte-identical). So `CLAUDE.md` and `transfermarkt-source.md` say the shared spec names Transfermarkt primary, instead of "no crawl runs until the backend updates it"
- Change 4's "May fetch" line keeps S12 (Wikidata aliases), which the spec's replacement text had dropped by mistake

## History
