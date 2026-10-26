# Football Lineup Scraper: Scraping & ETL Reference

Reference extracted from the old `lineup-scraper` repo. It describes **what that repo actually does**: which pages it scrapes, which HTML element each field comes from, how records from different pages are linked, and how the data is transformed, validated and loaded. Use it as the spec when building or extending a similar scraper.

> **Source-site caveat. Read this first.**
> The old repo scrapes **transfermarkt.com only**. Every URL, CSS class and text format below is Transfermarkt's (English site, US date format). It contains no mackolik code.
> - If the target repo also scrapes Transfermarkt, the selectors and URL patterns (§2–§6) apply directly. Re-verify them against live HTML, because the site layout may have changed since 2024.
> - If the target repo scrapes **mackolik** or any other site, do **not** reuse the selectors. Reuse the architecture (§1), the entity model and ID/linking scheme (§7), the output schemas (§8), the validation rules (§9) and the porting checklist (§13). The mackolik equivalents of each page type and field must be discovered and verified separately.

---

## 1. Architecture at a glance

Four entity types, each with its own scrape pipeline: **match**, **player**, **manager** (coach) and **team** (club or national team). Matches are the root. Player, manager and team URLs are not crawled from index pages. They are **harvested from the links found inside the parsed match records**.

```
[competition fixture pages] --download_links--> match_list.txt (TSV)
        --save_html_pages--> raw_html/<matchId>.html
        --parse_html--> parsed_data.jsons (JSONL)          (per competition)
        --check_parsed_data (schema validation)
        --transform_parsed_data--> full_data.jsons         (adds league/season/type/country, normalizes date)
                         |
combine_full_data.py --> data/match_parsed_data.jsons      (all competitions, deduped by id)
                         |
     +-------------------+--------------------+------------------------------+
     | player links      | manager links      | team-season links            |
     v                   v                    v                              |
players/download_links  managers/download_links  teams/download_season_links |
players_list.txt        managers_list.txt        teams_seasons_list.txt      |
     |                   |                      teams/download_links -> teams_list.txt (season stripped)
     |                   |                      teams/hash_links -> teams_hashed_list.txt (seasonLink -> teamId)
     v                   v                      v
 save_html_pages -> parse_html -> check_parsed_data -> parsed_data.jsons   (per entity)
     |
download_image_links.py -> data/image_links.txt -> save_images.py -> data/images/<imageId>.png
     |
write_non_relational.py -> data/non-relational/{players,managers,teams,matches}.json
check_non_relational.py  (counts, keys, types, referential integrity)
     |
db/mongo/app.js -> MongoDB db "lineup": players, managers, teams, matches (refs as ObjectId)
```

**Design properties to keep:**
- **Every stage is resumable and idempotent.** HTML is cached on disk keyed by ID, so already-downloaded pages are skipped and already-parsed IDs are skipped. Re-running a stage only processes the gaps.
- **Network and parsing are decoupled.** Pages are downloaded once and then parsed offline as many times as needed.
- **IDs are deterministic.** `uuid.uuid3(uuid.NAMESPACE_URL, <url>).hex` (32-char hex). The same URL always yields the same ID (§7).
- **Errors are collected, not fatal.** A parser returns `{'type': None, 'msg': '<what failed>'}` (a 2-key dict) on failure. The driver detects a failure by `len(result.keys()) == 2`, logs the ID and message, and continues.

---

## 2. Link (URL) types

Base URL: `https://www.transfermarkt.com`. Links inside pages are **relative** (`href="/..."`). The `{id}` values are Transfermarkt's numeric IDs.

| # | Link type | Pattern | Example | Used for |
|---|---|---|---|---|
| L1 | League fixture list (whole season) | `/{slug}/gesamtspielplan/wettbewerb/{CODE}?saison_id={YYYY}` | `/super-lig/gesamtspielplan/wettbewerb/TR1?saison_id=2023` | Super Lig, Bundesliga, La Liga, Serie A → match links |
| L2 | League matchday page | `/premier-league/spieltag/wettbewerb/GB1/plus/?saison_id={YYYY}&spieltag={1..38}` | `...GB1/plus/?saison_id=2009&spieltag=5` | Premier League → match links |
| L3 | Cup/tournament fixture list | `/{slug}/gesamtspielplan/pokalwettbewerb/{CODE}/saison_id/{YYYY}` | `/uefa-champions-league/gesamtspielplan/pokalwettbewerb/CL/saison_id/2019` | Champions League (`CL`), Europa League (`EL`) |
| L4 | National tournament fixture list | `/{slug}/gesamtspielplan/pokalwettbewerb/{CODE}{YY}` | `/weltmeisterschaft-2022/gesamtspielplan/pokalwettbewerb/WM18` | World Cup (`WM02..WM22`), EURO (`EM04..EM24`). The slug can stay fixed; the code selects the edition. |
| L5 | **Match report** | `/{home-slug}_{away-slug}/index/spielbericht/{matchId}` or `/spielbericht/index/spielbericht/{matchId}` | `/kayserispor_galatasaray/index/spielbericht/4126774` | Match record (§4) |
| L6 | **Player profile** | `/{slug}/profil/spieler/{playerId}` | `/raphinha/profil/spieler/411295` | Player record (§5.1) |
| L7 | **Manager profile** | `/{slug}/profil/trainer/{managerId}` | `/laurent-blanc/profil/trainer/4589` | Manager record (§5.2) |
| L8 | Team-in-season link (as it appears on match pages) | `/{slug}/startseite/verein/{teamId}/saison_id/{YYYY}` | `/konyaspor/startseite/verein/2293/saison_id/2020` | Join key from match → team. **Not downloaded.** |
| L9 | **Team page** (season stripped) | `/{slug}/startseite/verein/{teamId}` | `/fc-paris-saint-germain/startseite/verein/583` | Team record (§5.3). Derived as `'/'.join(L8.split('/')[:5])`. |
| L10 | Player/manager image | `https://img.a.transfermarkt.technology/portrait/header/{n}-{ts}.jpg?lm=1` (`default.jpg` when there is no photo) | | Image download |
| L11 | Team crest / national flag | `https://tmssl.akamaized.net//images/wappen/head/{id}.png?lm=…` (clubs), `…/images/flagge/head/{id}.png?lm=…` (national teams) | | Image download |

**Request headers** (all downloads): a desktop Chrome `User-Agent`, `Accept: text/html,...`, **`Accept-Language: en-US,en;q=0.9`** (required: parsing relies on English labels like "Position", "Date of birth", "Line-Up", "Height:", "Foot:" and on US dates), `Accept-Encoding: gzip, deflate, br`, `Connection: keep-alive`. Plain `requests.get`: no session, no delay, no retry, no proxy.

---

## 3. Stage A: fixture pages → match links

Each competition folder `transfermarkt/<competition>/` has its own `download_links.py`. It writes `data/match_list.txt` as TSV with the header `id	league	season	url	page`:
- `id` = `uuid3(NAMESPACE_URL, full_match_url).hex`. This is the **match ID** used everywhere afterwards.
- `league` = hard-coded display name. `season` = `"YYYY/YYYY+1"` for clubs or `"YYYY"` for national tournaments.
- `url` = absolute match-report URL (L5).
- `page` = the season start year (or the 2-digit edition code for WC/EURO, or the matchday number for the Premier League). It is informational only.

### 3.1 League layout (L1): Super Lig, Bundesliga, La Liga, Serie A
```
div.large-12.columns                       (each matchday container; exact class string "large-12 columns")
  div[class^="large-6 columns"]            (one box per matchday)
    div.content-box-headline               → matchday label (only printed)
    tbody > tr                             (skip rows whose class contains "bg_blau_20", i.e. date sub-headers)
      td."text-right no-border-rechts hauptlink" > a   → home team short name
      td."no-border-links hauptlink" > a               → away team short name
      td."zentriert hauptlink" > a.ergebnis-link[href] → match link (L5)
```

### 3.2 Premier League layout (L2), one request per matchday 1–38
```
tr.table-grosse-schrift                                                        (one per match)
  td."rechts hauptlink no-border-rechts hide-for-small spieltagsansicht-vereinsname" > a  → home
  td."hauptlink no-border-links no-border-rechts hide-for-small spieltagsansicht-vereinsname" > a → away
  span.ergebnis-box > a[href]                                                   → match link
```

### 3.3 Cup/tournament layout (L3/L4): CL, EL, World Cup, EURO
```
div.large-8.columns  → direct child <div>s: all but the last = group-stage rows, last = knockout box
  group rows:   div.box > (direct child) table > tr  (keep rows with no class / empty class)
                  td."zentriert hauptlink" > a[href] → match link
  knockout box: table > tbody (one per stage) > tr  (same row filter and link cell)
```
The Europa League script reads **only the knockout box** (no group stage).

### 3.4 Selection filters (which matches were kept)
Club competitions were filtered to "big-team" matches. The names must match Transfermarkt's English short names exactly.

| Competition | Season range seen in data | Filter |
|---|---|---|
| Super Lig (TR1) | 2007/08–2023/24 | season ≤ 2010: **both** teams in {Fenerbahce, Galatasaray, Besiktas, Trabzonspor}; later: **either** team in {Fenerbahce, Galatasaray, Besiktas} |
| Bundesliga (L1) | 2010/11–2023/24 | one team in a per-season "important" dict (Bayern Munich, Bor. Dortmund, +B. Leverkusen 2023), the other in {Bayern, Dortmund, Leverkusen, RB Leipzig, VfL Wolfsburg, VfB Stuttgart, Werder Bremen} |
| La Liga (ES1) | 2007/08–2023/24 | one in {Real Madrid, Barcelona, Atlético Madrid}, the other in that set ∪ {Villarreal, Real Sociedad, Valencia, Sevilla FC} |
| Serie A (IT1) | 2007/08–2023/24 | one in {Inter, AS Roma, SSC Napoli, AC Milan, Juventus}, the other in that set ∪ {Fiorentina, Atalanta BC, Lazio} |
| Premier League (GB1) | 2010/11–2023/24 | either team in {Man City, Arsenal, Tottenham, Chelsea, Liverpool, Man Utd} |
| Champions League, Europa League, World Cup, EURO | CL 2007/08–2023/24, EL 2009/10–2023/24, WC 2002–2022, EURO 2004–2024 | all matches with a link |

The season loops in the scripts (for example `range(2015, 2009, -1)`) show only the **last range that was run**. The scripts were edited and re-run per season batch.

---

## 4. Stage B: match report page (L5) → match record

`parse_html.py` → `extract_content_from_page()`. All selectors use BeautifulSoup `find(tag, {'class': '<string>'})`. A class string containing spaces means an **exact match of the whole class attribute**.

### 4.1 Field → source mapping

| Output field | Source element (inside the page) | Extraction / normalization |
|---|---|---|
| *(header root)* | first `div.box-content` | |
| `home.name`, `home.link` | `div."sb-team sb-heim"` → `a.sb-vereinslink` | `.text`, `['href']` (team-season link, L8) |
| `home.position` (league table position, **leagues only**) | same box → first `p`, e.g. `"Position: 10"` | remove spaces; if it starts with "position" → `int(text[9:])`; tournaments → always `None` |
| `away.name`, `away.link`, `away.position` | `div."sb-team sb-gast"` → `a.sb-vereinslink` | same. **Bug:** position is read from the home box (§12). |
| *(score root)* | `div.sb-spieldaten` | |
| `round`, `date` (raw) | `p."sb-datum hide-for-small"` | strip `' '`, `\n`, `\xa0`; split on `\|` → `[0]` = round (`"3.Matchday"`, `"GroupB"`, `"Roundof16"`, `"Final"`, `"Quarter-Finals1stleg"`…); remaining parts joined with a space = raw date `"Sun,9/27/20 3:00PM"` |
| `home.score`, `away.score` | `div.sb-endstand` → `.contents[0]`, e.g. `"4:1"` | strip spaces/newlines, split `:` → ints |
| `home.halfScore`, `away.halfScore` | `div.sb-halbzeit`, e.g. `"(1:0)"` | `text[1:-1].split(':')` → ints |
| `extraTime`, `penalty` (**tournaments only**) | `div.sb-halbzeit` text | `== 'AET'` → `extraTime=True`; contains `'pens'` → `penalty=True`; in both cases halfScore stays `None`. Defaults `False`. Leagues set both to `None` in the transform. |
| `stadium` | `p.sb-zusatzinfos` → `span.hide-for-small` → `a` | `.text` |
| `attendance` | same span → `strong` | digits only → int; missing → `None` |
| `referee` | `p.sb-zusatzinfos` → last `a` | `.text` |
| *(lineup root)* | the `h2.content-box-headline` whose text contains both "line" and "up" → `.parent` | |
| `home.lineup` (formation) | home box `div."large-6 columns aufstellung-box"` → `div."large-7 aufstellung-vereinsseite columns small-12 unterueberschrift aufstellung-unterueberschrift"` | strip spaces/newlines, `split(':')[1]` → `"4-2-3-1"`, `"4-3-3Attacking"`, `"4-4-2double6"`… (25 distinct values) |
| `away.lineup` | away box = `div."large-6 columns"` (exact class string), same child | same |
| `first11[]` (exactly 11) | each `div.aufstellung-spieler-container` in the team box | see 4.2 |
| `manager` `{name, link}` | `table.ersatzbank` → **last** `tr` → `a` | `.text`, `['href']` (L7) |
| `substitutes[]` | `table.ersatzbank` → all `tr` except the last | see 4.2 |
| `id` | — | the HTML file name = match ID from Stage A |

### 4.2 Player entries inside a match

| Field | Starters (`div.aufstellung-spieler-container`) | Substitutes (`table.ersatzbank tr`) |
|---|---|---|
| `number` | `div."tm-shirt-number tm-shirt-number--large tm-shirt-number--bordered"` text, int if numeric, else `None` | `div."tm-shirt-number tm-shirt-number--small"` text, int if numeric, else `None` |
| `name` | `span.aufstellung-rueckennummer-name > a` text (short display name, for example "Sehic") | first `a` text |
| `link` | same `a['href']` → player link (L6) | same |
| `position` | **the container's inline `style` attribute**, spaces and trailing `;` removed → pitch coordinates such as `"top:80%;left:40%"` (see §10) | last `td` text → abbreviation: `GK CB LB RB SW DM CM AM LM RM LW RW SS CF` or `None` |
| `actions[]` | `captain` if `div.kapitaenicon-formation` exists, plus icons | icons only (no captain) |

Icon mapping (`span[class^="icons_sprite"]`, by class contained):

| CSS class | action |
|---|---|
| `icon-gelbekarte-formation` | `yellow` |
| `icon-rotekarte-formation` | `red` |
| `icon-gelbrotekarte-formation` | `yellow-red` |
| `icon-auswechslung-formation` | `sub-out` |
| `icon-einwechslung-formation` | `sub-in` (checked for substitutes only) |
| `icon-tor-formation` | `goal` (one per icon; a brace yields two `goal` entries only if two icons exist) |

There are no event minutes, no goal-scorer timeline and no assists. Actions are presence flags derived from the lineup graphic.

---

## 5. Stage C/D: entity link harvesting → entity pages

### Link harvesting (from `data/match_parsed_data.jsons`)
- **Players:** the set of `link` over `home/away × first11/substitutes` → `players/data/players_list.txt` (`id	link	url`, with `id = uuid3(base+link)`).
- **Managers:** the set of `home.manager.link`, `away.manager.link` → `managers/data/managers_list.txt` (`id	link	url`).
- **Teams** (3 steps):
  1. `download_season_links.py`: the set of `home.link`, `away.link` (team-season links, L8) → `teams_seasons_list.txt` (`id	url`, with **`id = uuid3(relative link)`**, no base URL).
  2. `download_links.py`: strip the season (`'/'.join(url.split('/')[:5])`) and dedupe → `teams_list.txt` (`id	link	url`, with `id = uuid3(base+link)` = **team ID**).
  3. `hash_links.py`: map every season link to its team ID → `teams_hashed_list.txt` (`id	url	teamId`). **This is the bridge used to join a match side to a team.**

Every entity pipeline then runs `save_html_pages.py` (HTML cached as `raw_html/<id>.html`), `parse_html.py`, `check_parsed_data.py` and `check_exists.py` (every harvested link exists in the match data).

All three profile pages share the Transfermarkt header: `header.data-header`.

### 5.1 Player page (L6) → `players/data/parsed_data.jsons`
| Field | Source | Normalization |
|---|---|---|
| `name` | `div.data-header__headline-container` → `h1.data-header__headline-wrapper` | text with the `span.data-header__shirt-number` text removed, then stripped (full name, e.g. "Roque Mesa") |
| `image` | `div.data-header__profile-container img['src']` | URL (L10) |
| `date_of_birth` | `div.data-header__info-box li.data-header__label` whose text contains "date of birth" → `span.data-header__content` | regex `^[^(]+` drops the "(age)" part → `"Jun 7, 1989"` (format `%b %d, %Y`) |
| `citizenship` | label containing "citizenship" → `span.data-header__content` | stripped text. In the data it is always a single country name (160 distinct values, e.g. "Korea, South"); no dual nationality was captured. |
| `height` | `div.box.viewport-tracking` whose `h2.content-box-headline` (fallback: `span.content-box-headline`) contains "player data" → `div."info-table info-table--right-space"` (fallback `"… min-height-audio"`) → all `span` texts; label ending in `:` + the next span = value | `"1,72 m"` → `172` (cm int); `N/A` → `None` |
| `position` | same table, label "Position:" | e.g. `"Midfield - Central Midfield"`, `"Goalkeeper"`, `"Attack - Centre-Forward"`; `N/A` → `None` |
| `foot` | same table, label "Foot:" | `right`/`left`/`both`/`None` |

### 5.2 Manager page (L7) → `managers/data/parsed_data.jsons`
`name` (h1 text), `image`, `date_of_birth` (optional, `N/A` → `None`) and `citizenship` (optional), using the same selectors as the player page. There is no player-data box.

### 5.3 Team page (L9) → `teams/data/parsed_data.jsons`
| Field | Source | Normalization |
|---|---|---|
| `name` | `div.data-header__headline-container` → `h1."data-header__headline-wrapper data-header__headline-wrapper--oswald"` | stripped |
| `image` | `div.data-header__profile-container img['src']` | crest/flag URL (L11) |
| `stadium.name` | `div.data-header__info-box ul.data-header__items li.data-header__label` whose text contains "stadium" → `span.data-header__content > a` | text |
| `stadium.capacity` | same span → `span.tabellenplatz`, e.g. `"48.583 Seats"` | remove "seats"/"Seats", `,` and `.` → int |

National teams have no stadium, so `{name: None, capacity: None}`, which is later collapsed to `stadium: null`. The team record is **season-independent** (one record per club). The season only lives in the link used on match pages.

### 5.4 Images
`download_image_links.py` collects the `image` URL of every player, team and manager → `data/image_links.txt` (`id	url`, `id = uuid3(image_url)`). `save_images.py` downloads each one to `data/images/<id>.png` (always `.png`, even for JPEG content). Shared placeholder URLs (`default.jpg`) are deduplicated by URL.

---

## 6. Transform (per competition): `transform_parsed_data.py`

Input: `parsed_data.jsons` + `match_list.txt`. Output: `full_data.jsons`.
1. `check_transfermarkt_ids()`: extract the numeric match ID (`/([^/]+)$`) from each URL and abort on duplicates. This guards against re-running Stage A, which appends duplicate rows.
2. **Date** `"Sun,9/27/20 3:00PM"` → `"YYYY-MM-DD HH:MM"` (24h): take the part after the comma, split M/D/YY, `year = "20" + YY`, zero-pad month/day, add 12 for PM and zero-pad AM hours. CL/EL also validate with `datetime.strptime(..., '%Y-%m-%d %H:%M')`. A record whose date fails to convert is **dropped** (only logged).
3. Enrich from the `match_list.txt` row with the same `id`: `league`, `season` (cast to `str` for tournaments), plus constants:

| Competition | `type` | `country` | `league` | `penalty`/`extraTime` |
|---|---|---|---|---|
| Super Lig | league | Turkey | Super Lig | `None` |
| Bundesliga | league | Germany | Bundesliga | `None` |
| La Liga | league | Spain | La Liga | `None` |
| Serie A | league | Italy | Serie A | `None` |
| Premier League | league | England | Premier League | `None` |
| UEFA Champions League | tournament | Europe | UEFA Champions League | parsed bool |
| UEFA Europe League | tournament | Europe | UEFA Europe League | parsed bool |
| World Cup | tournament | National | World Cup | parsed bool |
| EURO | tournament | National | EURO | parsed bool |

Then `combine_full_data.py` appends every competition's `full_data.jsons` into `data/match_parsed_data.jsons`, skipping IDs that are already present. Its `__main__` instead checks that all records share the same key set and that IDs are unique.

---

## 7. Entity model, IDs and how records are linked

### 7.1 ID formulas (all `uuid.uuid3(uuid.NAMESPACE_URL, s).hex`)
| Entity | `s` (the hashed string) | Stored in |
|---|---|---|
| Match | absolute match URL (`https://www.transfermarkt.com/.../spielbericht/{n}`) | `match_list.txt.id`, raw HTML file name, `match.id` |
| Player | `https://www.transfermarkt.com` + player link | `players_list.txt.id`, `player.id` |
| Manager | `https://www.transfermarkt.com` + manager link | `managers_list.txt.id`, `manager.id` |
| Team | `https://www.transfermarkt.com` + **season-stripped** team link | `teams_list.txt.id` = `teams_hashed_list.txt.teamId` = `team.id` |
| Team-season (bridge only) | the **relative** season link, without the base URL | `teams_seasons_list.txt.id` |
| Image | the image URL | `image_links.txt.id`, file name, `image_id` |

Because the IDs are deterministic, any ID can be **recomputed from a link** without a lookup table. The old code still used TSV lookups.

### 7.2 Join keys (used in `write_non_relational.py`)
```
match.home|away.link        (L8, season link)  == teams_hashed_list.url   → teamId   → team.id
match.home|away.manager.link (L7)              == managers_list.link      → id       → manager.id
match.*.first11|substitutes[].link (L6)        == players_list.link       → id       → player.id
player|manager|team.image                      == image_links.url         → id       → image_id  (→ data/images/<id>.png)
```
Relationship shape:
```
Match 1 ── 2 Side(home, away) ── 1 Team
                 ├── 1 Manager
                 ├── 11 first11  ─┐
                 └── N substitutes ┴─ each → 1 Player  (+ per-match number, position, actions)
Team / Player / Manager ── 1 Image
```
Per-match facts (shirt number, position on the pitch, actions, formation, score, table position) live **on the match side**, not on the entity. The entities hold only static profile data.

---

## 8. Output schemas (`data/non-relational/*.json`, JSON arrays)

`write_non_relational.py` runs `write_manager()`, `write_team()`, `write_player()` and then `write_match()`. Each write is **all-or-nothing**: any duplicate ID, missing image ID or unresolved reference aborts without writing the file. A file that already exists is never overwritten.

```jsonc
// players.json (14,868)
{ "id": "651d…", "name": "Roque Mesa", "image_link": "https://img.a.transfermarkt.technology/…", "image_id": "2352…",
  "date_of_birth": "1989-06-07" | null, "citizenship": "Spain" | null, "height": 172 | null,
  "position": "Midfield - Central Midfield" | null, "foot": "right" | "left" | "both" | null }

// managers.json (804)
{ "id", "name", "image_link", "image_id", "date_of_birth": "YYYY-MM-DD" | null, "citizenship": str | null }

// teams.json (296)
{ "id", "name", "image_link", "image_id", "stadium": { "name": str|null, "capacity": int|null } | null }

// matches.json (9,202)
{ "id": "<matchId>", "type": "league"|"tournament", "league": "Super Lig", "country": "Turkey",
  "season": "2020/2021" | "2022", "round": "3.Matchday", "date": "2020-09-27 15:00",
  "stadium": str|null, "attendance": int|null, "referee": str,
  "extraTime": bool|null, "penalty": bool|null,           // null for leagues
  "home": {
    "id": "<teamId>", "position": int|null, "score": int, "halfScore": int|null,
    "lineup": "4-2-3-1", "manager": "<managerId>",
    "first11":     [ { "id": "<playerId>", "number": int|null, "position": "top:80%;left:40%", "actions": ["captain","yellow"] } ],
    "substitutes": [ { "id": "<playerId>", "number": int|null, "position": "GK"|null,           "actions": ["sub-in","goal"] } ]
  },
  "away": { /* same as home */ }
}
```
Dates of birth are converted from `"%b %d, %Y"` to `"%Y-%m-%d"`; unparseable values become `null`. Names and links are dropped from the match document. Only IDs remain.

---

## 9. Validation rules (replicate these)

**Parsed match** (`check_parsed_data.py`, per competition):
- Exact key sets. Match: `home, away, round, date, stadium, attendance, referee, id` (+ `penalty, extraTime` for tournaments). Side: `name, link, position, score, halfScore, first11, substitutes, lineup, manager`. Player: `number, name, link, position, actions`. Manager: `name, link`.
- Required non-empty strings: side `name`, `link`, `lineup`; manager `name`, `link`; player `name`, `link`; starter `position`; match `round`, `date`, `referee`, `id`.
- Required ints: `score`. Optional ints: `position` (must be `None` for tournaments), `halfScore`, `attendance`, player `number`. Optional string: `stadium`, substitute `position`.
- `first11` must have **exactly 11** entries. `substitutes` is a list (can be empty). `actions` is a list.

**Player:** keys `name, image, date_of_birth, citizenship, height, position, foot, id`; image starts with `https://img.a.transfermarkt.technology`; DOB is `None` or parses as `%b %d, %Y`; foot ∈ {None, left, right, both}.
**Manager:** keys `name, image, date_of_birth, citizenship, id`; image starts with `https://img.a.transfermarkt.technology/portrait/header`.
**Team:** keys `name, image, stadium, id`; image starts with `https://tmssl.akamaized.net//`; stadium has keys `{name, capacity}` (optional str/int).
**Existence** (`check_exists.py`): every harvested entity link appears in the match data (and vice versa for managers).
**Final** (`check_non_relational.py`): each output count equals its parsed JSONL line count; every record in a collection has identical keys; type sets per field match the schema in §8; every team, manager and player ID referenced by a match exists in its collection.

Error handling convention: the checkers print `Error on line N, [messages] -> id`. Commented-out blocks in parsers and checkers **delete the raw HTML of failed IDs** so the next `save_html_pages` run re-downloads them. That loop was: fix → delete bad HTML → re-download → re-parse.

---

## 10. Pitch-position lookup (`data/positions/`)

The starters' `position` is Transfermarkt's lineup-graphic CSS (`"top:{y}%;left:{x}%"`). `top` runs from the own goal (80% = GK) up to the forward line (2–3% = ST), and `left` runs from 7% (left flank) to 73% (right flank). No committed script creates or reads these files. They are a manually built lookup for turning coordinates into role codes, which a downstream consumer (UI/app) would need.

- `positions.json`: flat map coordinate → role code. It covers **100% of the starter coordinates** in the dataset. Example: `"top:80%;left:40%": "GK"`, `"top:63%;left:52.5%": "RCB"`, `"top:61%;left:73%": "RB"`, `"top:43%;left:52%": "RCDM"`, `"top:23%;left:40%": "CAM"`, `"top:18%;left:65%": "RAM"`, `"top:10%;left:15%": "LW"`, `"top:3%;left:40%": "ST"`, `"top:2%;left:50%": "RST"`. Codes: `GK, CB, RCB, LCB, RB, LB, RQCB/LQCB, RAB/LAB, CDM, RCDM/LCDM, RQCDM/LQCDM, CDMA, RCDMA/LCDMA, CM, RCM/LCM, RQCM/LQCM, RCMA/LCMA, RQCMA/LQCMA, ACM, RACM/LACM, RQACM/LQACM, CAM, RCAM/LCAM, RAM/LAM, RW/LW, ST, RST/LST` (R/L = right/left; Q = wide; A = advanced).
- `lineup_data.json`: per formation (all 25 values of `lineup`), the 11 coordinates → role codes for that formation, plus `ids` (5 sample **match IDs** using the formation, all present in the dataset, kept for visual verification). It is consistent with `positions.json` (0 mismatches).
- `lineup_data.txt`: the same data as TSV (`lineup	positions(|-joined)	ids(|-joined)`).

Substitutes have no coordinates. Their `position` is already an abbreviation (`GK`, `CB`, …).

---

## 11. Load: MongoDB (`db/mongo/app.js`, Node + `mongodb` driver, `MONGO_URI` from `.env`)

Database `lineup`, collections `players`, `managers`, `teams`, `matches`. The order matters:
1. `insertFromFileToMongoDB(path, 'lineup', <collection>)` for players, managers and teams (`insertMany` of the JSON arrays; documents keep the hash `id` field).
2. `insertMatches()`: reads all three collections, builds `idMapping[hashId] = _id`, reads `./data/matches.json` (copies of the non-relational files live in `db/mongo/data/`), and replaces every team, manager and player hash ID with `new ObjectId(_id)`. The match hash `id` is dropped, and the rest of the fields are copied as-is.
3. `deleteIdField('lineup', <collection>)`: `$unset` the hash `id` from the entity collections.

`start()` only connects. The functions above were run by editing the call manually. There are no indexes and no upserts, so running the load twice duplicates documents.

---

## 12. Known bugs and pitfalls (do not replicate)

1. **The away table position is wrong.** League parsers read `away.position` from `homeBox`, so `away.position == home.position` in all 5,619 league records. Read it from `div.sb-team.sb-gast p` instead.
2. **12-hour → 24-hour conversion bug.** `12:xxPM` becomes `24:xx` (34 records: 33 league, 1 World Cup/EURO) and `12:xxAM` stays `12:xx`. Use `datetime.strptime(s, '%m/%d/%y %I:%M%p')`. League, World Cup and EURO transforms do not validate the result; CL/EL validate it and silently drop the record instead.
3. **`halfScore` is lost when the halftime box shows `AET` or `on pens`** (128 records with `halfScore: null`). Whether `score` is the 90-minute, 120-minute or shoot-out score for those matches was never verified.
4. **Tri-state flags.** `extraTime`/`penalty` are `null` for leagues and bool for tournaments. Prefer explicit `false` with real detection everywhere.
5. **Resume logic is broken or unused.** `download_links` reads a `page` column that some files don't have (teams/players), computes `start_page`/`downloaded_url_list` and never uses them, and appends without dedupe. Re-running a stage duplicates rows. Dedupe by ID on write.
6. `raise "Page not parsed"` raises a `TypeError` (strings can't be raised). It works only by accident because the caller catches every exception. Raise a real exception that carries the status code.
7. There is no throttling, retry or backoff. The player HTML downloader (and `save_images.py`) stops after **500 downloads per run** and on the first error, as a manual rate limit. Add a delay, retries and 429 handling.
8. `write_match()` re-reads three TSVs **for every match** (O(n²)-ish). Load the lookups once, or compute the IDs directly (§7.1).
9. Files are opened with `open(path, 'r')` and no encoding in the parsers. Always pass `encoding='utf-8'`.
10. The player parser's "image not found" error message says "citizenship" (wrong label).
11. Team-name filters rely on Transfermarkt's English short names (`Bor. Dortmund`, `Man Utd`). A renamed team silently drops matches. Filter on stable numeric team IDs instead.
12. The `"20" + YY` year logic only works for 2000–2099.
13. Competition folders are copy-pasted with small divergences (number parsing in the Premier League is not null-safe; the Premier League returns an error on missing stadium info while others ignore it). Prefer one parameterized parser with per-competition config.

---

## 13. Porting checklist for a similar scraper (Transfermarkt again, or mackolik, etc.)

For each item, find the equivalent on the target site and record the selector/URL. **Nothing in this section is verified for mackolik.**

1. **Fixture discovery:** which page lists a competition-season's matches (or a day's matches), how pagination or matchdays work, and where the match-detail link is.
2. **Match detail page(s):** whether lineups, formation, cards, subs and goals are on one page or on separate tabs/AJAX/JSON endpoints. Check the network tab, since many sites serve lineups as JSON, which is more robust than HTML.
3. **Stable entity IDs in URLs:** whether player, coach and team links carry a numeric ID. If so, hash or keep the **ID-bearing link** (strip season or locale parts, as was done for L8 → L9) so the same entity across seasons maps to one record.
4. **Field parity** with §4.1/§4.2: round, kickoff datetime (and its timezone and locale format), venue, attendance, referee, FT/HT score, ET/penalties, formation, starters with shirt number, a pitch position or role, captain, cards, subs in/out, goals, coach.
5. **Position representation:** pitch coordinates (needs a §10-style lookup) versus role labels.
6. **Entity pages:** name, photo, DOB (format), nationality, height, preferred position, foot; team crest and stadium/capacity.
7. **Language/locale headers** so that text labels and date formats are deterministic.
8. **Rate limits / anti-bot** (Cloudflare, cookies, JS rendering). Decide between `requests` and a headless browser.
9. Keep the pipeline contract: `list TSV (id,url,…) → raw cache <id>.html|json → parsed JSONL (+id) → validator → enrich → combine → normalize entities (link → id) → integrity check → load`.
10. Keep the deterministic ID scheme (`uuid3(NAMESPACE_URL, canonical_url)`). If you want cross-source merging with the Transfermarkt data, plan an explicit mapping table (name + DOB matching), because IDs from different sites never collide or match.

---

## 14. Dataset snapshot (as produced by the old repo, Sept 2024)

| Item | Count |
|---|---|
| Matches (total) | 9,202. Premier League 2,729 · Champions League 2,107 · Super Lig 1,314 · Europa League 851 · Serie A 831 · La Liga 473 · World Cup 380 · Bundesliga 272 · EURO 245 |
| Players | 14,868 |
| Managers | 804 |
| Teams | 296 (from 1,723 distinct team-season links) |
| Image URLs | 14,899 (≈282 MB of images) |
| Matches with no attendance / no stadium | 889 / 24 |
| Starters with no shirt number | 414 |
| Distinct formations | 25 |

### File layout and formats
```
transfermarkt/<competition>/{config.py, download_links.py, save_html_pages.py, parse_html.py,
                             check_parsed_data.py, transform_parsed_data.py}
transfermarkt/<competition>/data/{match_list.txt (TSV), raw_html/<id>.html, parsed_data.jsons, full_data.jsons}
players|managers/data/{<entity>_list.txt (TSV id,link,url), raw_html/, parsed_data.jsons}
teams/data/{teams_seasons_list.txt, teams_list.txt, teams_hashed_list.txt, raw_html/, parsed_data.jsons}
data/{match_parsed_data.jsons, image_links.txt, images/, non-relational/*.json, positions/}
config.py (root) = all cross-stage paths; each folder's config.py = its local paths.
```
`.jsons` = JSON Lines (one `json.dumps` object per line). Scripts are run from the **repo root** (paths are root-relative), each with `python <folder>/<script>.py`, in the order of §1.
