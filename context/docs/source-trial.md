# Source Trial (S02)

> **Superseded for the source choice on 2026-10-26.** This repo now uses Transfermarkt: Mackolik has no formations, which the data contract requires (`docs/transfermarkt-source.md`). The evidence below stays valid as a record of Mackolik and the other sources.

Which sources the scraper uses, for what, and over which seasons. Produced by `/research source-trial` from `context/research/source-trial.md`, against the spec `context/features/phase-s02-source-trial.md`.

- **Every URL was accessed on 2026-10-25** unless a row says otherwise.
- Every date, score, name and XI here comes from the page cited beside it. Nothing comes from memory.
- Pages were read with `curl` (one request at a time, 2–5 s apart, User-Agent `lineup-scraper-source-trial/0.1 (development research)`), WebFetch and the Playwright MCP (inspection only). Nothing was saved as a record or a fixture.
- Paid APIs (API-Football, Sportmonks) were left out by decision. Transfermarkt, FBref and worldfootball.net were not used.

---

## 1. Verdict

| Question | Answer | Evidence |
| --- | --- | --- |
| **Metadata** (fixtures, dates, scores, stages) | **Mackolik: primary.** openfootball: fill gaps (cross-checks). StatsBomb, Wikipedia, Wikidata: rejected for this role | § 2.1, § 4.1; openfootball covers 2000s only for England and the World Cup (§ 2.3) |
| **Lineups** (starting XIs) | **Mackolik: primary.** StatsBomb: fill gaps (formations and positions where it has the match). Wikipedia: fill gaps (finals only, cross-check). Wikidata: rejected | Mackolik had both full XIs, starters separated, for **22 of 22** sample matches (§ 4.1) |
| **Events** (goals, penalties, red cards) | **Mackolik: primary.** StatsBomb: fill gaps. openfootball: cross-check (World Cup scorers) | § 4.1, § 7 |
| **Season range** | **2000–01 onward holds** for XIs. Mackolik meets the bar for every sample year: 5 of 5 in 2001, 2006, 2011 and 2019, low-profile matches included | § 4.1, § Decision Rules |
| **Formations** | **Not available from any free source for most matches**, in any year. Mackolik has none. StatsBomb and Wikipedia have them only for matches they cover (finals, World Cups and Euros from 2018, Barcelona). **S11 must infer formations or exclude matches** | § 4, § 7 S11 |
| **Fetch stack** | **Scrapy**, without `scrapy-playwright`. Mackolik serves its data as static HTML plus JSON from plain GET endpoints; nothing needs JavaScript | § 2.1, § 7 S06 |
| **Licence before marketing** | **Mackolik** (its terms forbid copying its data), **StatsBomb** (research-use terms), **Wikipedia** (CC BY-SA, unverified here). openfootball is CC0 and needs none; Wikidata's CC0 is unverified here | § 2 |
| **Rejected for a technical block** | **11v11.com** and **football-lineups.com**: both answer with a Cloudflare challenge | § 2.5, § 2.6 |

---

## 2. Per source

### 2.1 Mackolik (`arsiv.mackolik.com`)

| | |
| --- | --- |
| Access | Old ASP.NET site, server-rendered. **`https://www.mackolik.com/` redirected to `arsiv.mackolik.com/Default.aspx`** for this client; the newer site's match pages were not reached (one guessed URL returned 404) |
| `robots.txt` | `https://www.mackolik.com/robots.txt` and `https://arsiv.mackolik.com/robots.txt` are identical: `User-Agent: *` `Allow: /`, `Disallow: /api/`, `Disallow: /_nuxt/`. `GPTBot`, `Amazonbot`, `Google-Extended`, `CCBot` and `anthropic-ai` get `Disallow: /`. None of the endpoints used below is under `/api/` |
| Terms | `https://www.mackolik.com/static-kullanim-kosullari.html` (Platform Kullanım Koşulları), operator Mackolik İnternet Hizmetleri Ticaret A.Ş. The *Fikri Mülkiyet Hakları* clause says copying or using the information or software used to build the platform's database, and copying, distributing or processing any data on the platform, is "kesinlikle yasak" (strictly forbidden). No element may be published elsewhere or used to compete with the company. Turkish law; Istanbul (Çağlayan) courts. **A licence is needed before marketing** |
| Technical blocks | None. Plain `curl` worked on every page and endpoint; no CAPTCHA, challenge or login |
| Encoding | UTF-8 (`text/html; charset=utf-8`) on pages and endpoints |
| Pages viewed | **About 80**: 2 `robots.txt`, 1 terms, 2 static scripts, 4 browser navigations, 9 competition-season pages, 14 club-season pages, 1 league season page, 1 empty fixture call, 1 stage call, 1 cup index, 12 match pages, 24 lineup endpoints, 2 wasted (a request with id `0`), 1 404, plus the redirect check. **Over the spec's ~40** (§ Notes) |

**How the data is reached** (all plain GET):

| What | URL |
| --- | --- |
| Competition season (cups) | `/Cups/Default.aspx?id=<cupId>&season=<season>`. UCL `48`, UEFA Cup / Europa League `178`, World Cup `180`, Euro `179`. The World Cup page lists all 64 matches; UCL and UEL pages show only the final |
| One stage of a cup | `/AjaxHandlers/CupHandler.aspx?command=legMatches&id=<stageId>` returns an HTML fragment with match links. Stage ids come from the season page's tabs |
| Club season | `/Takim/<clubId>/<slug>/<yyyy>/<yyyy>` lists every match of that club's season (48–73 per page), grouped by competition, with `side='home'`, the opponent id in `data-opponent`, the date and the match link |
| League season | `/Standings/Default.aspx?sId=<seasonId>`. Matchdays via `/AjaxHandlers/FixtureHandler.aspx?command=getWeeks&id=<sId>` and `command=getMatches&id=<sId>&week=<n>` (only `week=0` was tried, and it returned `[]`; untested with a real week). Season ids via `/AjaxHandlers/CompetitionHandler.aspx?op=groupYears&group=<g>` and `op=seasons&group=<g>&year=<y>` |
| Match header | `/Mac/<matchId>/<slug>`: competition and stage, `Tarih : dd.mm.yyyy HH:MM`, venue, referee, managers |
| **Lineups and events** | **`/Match/MatchData.aspx?t=dtl&id=<matchId>&s=0`** returns JSON (sent as `text/html`): `d` (scores), `h` and `a` (players), `e` (events). The match page loads it with XHR |

Season lists reach back to 1955/56 for the UCL (`/Sampiyonlar-Ligi`) and 1930 for the World Cup (`/Kupa/180/Dunya-Kupasi`).

### 2.2 StatsBomb Open Data (`github.com/statsbomb/open-data`)

| | |
| --- | --- |
| Access | Static JSON over HTTPS from `raw.githubusercontent.com`; no key |
| `robots.txt` | Not applicable (GitHub raw files) |
| Terms | `README.md`: data made "freely available for public use for research projects and genuine interest in football analytics"; anyone who publishes, shares or distributes research based on it should "state the data source as StatsBomb and use our logo". The binding `LICENSE.pdf` (165 KB) could not be read as text here. The socceraction docs (`https://socceraction.readthedocs.io/en/latest/documentation/data/statsbomb.html`) describe it as public non-commercial data; that is a third-party reading. **Treat as needing a licence before marketing** |
| Technical blocks | None |
| Pages viewed | 9 (`competitions.json`, 3 match lists, 1 lineup, 1 event file, README, licence twice) |

Coverage that touches the scope (`data/competitions.json`): Champions League 1999/2000 and 2003/04–2018/19 (the 2010/11 and 2018/19 files hold **one match each, the final**); FIFA World Cup 2018 and 2022; UEFA Euro 2020 (51 matches) and 2024; La Liga 2004/05–2020/21; Premier League 2003/04 and 2015/16; Serie A, Bundesliga and Ligue 1 2015/16; Ligue 1 2021/22 and 2022/23; Europa League only 1988/89.

### 2.3 openfootball (`github.com/openfootball`)

| | |
| --- | --- |
| Access | Plain text (Football.TXT) and JSON files in GitHub repos |
| Terms | `football.json/LICENSE.md`: **CC0 1.0 Universal**. No licence needed |
| Technical blocks | None |
| Pages viewed | 18 (GitHub API directory listings and raw files) |

| Repo | Seasons found |
| --- | --- |
| `england` | 2000-01 to 2026-27 |
| `deutschland` | 2010-11 to 2026-27 (plus `rsssf`, `openliga` folders, not opened) |
| `espana` | 2012-13 to 2026-27 |
| `italy` | 2013-14 to 2026-27 |
| `champions-league` | 2011-12 to 2025-26 |
| `europe/france` | 2014-15 to 2026-27 |
| `europe/portugal`, `europe/turkey` | 2018-19 to 2026-27 |
| `worldcup` | 1930 to 2026 (2006: `cup.txt`, `cup_finals.txt`, `squads.txt`) |
| `football.json` | 2010-11 to 2026-27 (2010-11 has only `at`, `de`, `en`) |

**Not a 2000–2010 skeleton** outside England and the World Cup. No lineups in any file opened. `england/2000-01/1-premierleague.txt` gives matchday, date, kick-off time and full-time and half-time scores.

### 2.4 Wikipedia and Wikidata

| | |
| --- | --- |
| Access | MediaWiki Action API (`/w/api.php`: `action=query`, `action=parse`), Wikidata `wbgetentities` |
| `robots.txt` | `https://en.wikipedia.org/robots.txt`, `User-agent: *`: `Disallow: /w/` (with exceptions for `/w/api.php?action=mobileview&` and `/w/load.php?`), `Disallow: /api/` (except `/api/rest_v1/?doc`), `Disallow: /wiki/Special:`. A comment says "Friendly, low-speed bots are welcome viewing article pages, but not dynamically-generated pages please". **The Action API sits under the disallowed `/w/`**; S09 must settle which route it uses |
| Terms | Article text is CC BY-SA and Wikidata data is CC0: **unverified here**, since no licence page was fetched. If confirmed, attribution and share-alike apply to Wikipedia text before marketing |
| Technical blocks | None |
| Pages viewed | Wikipedia 8 (robots, 2 WebFetch of a season article, 1 batched title query, 4 parses); Wikidata 2 |

- **Own article** (one batched query): the six finals in the sample (#1, #6, #8, #11, #12, #17), the 2020 UCL final and the Euro 2020 final. `Liverpool 4–0 Barcelona` redirects to `2018–19 UEFA Champions League knockout phase`, which has **no** XI tables. No article was found under the titles `Manchester United 1–6 Manchester City` or `Manchester United 6–1 Arsenal`.
- **Final articles carry XI tables**: position, shirt number, linked player, cards, then substitutes. Example from `2001 UEFA Champions League final`: `|GK ||'''1''' ||{{flagicon|GER}} [[Oliver Kahn]]`.
- **Wikidata** match items (`Q772884` for the 2001 final, `Q268567` for the 2006 World Cup final) list participants under `P710` (28 and 27) with team (`P54`) and shirt number (`P1618`). Position (`P413`) appears on 5 and 4 of them; "replaces" and "replaced by" (`P1365`, `P1366`) appear once. **Starters and substitutes can't be told apart**, so it's not a lineup source. It is useful for S08 (ids and English labels).

### 2.5 11v11.com (other source 1)

- `robots.txt` (`https://www.11v11.com/robots.txt`) disallows only feedback, tag and forum paths.
- Its match page `https://www.11v11.com/matches/manchester-united-v-arsenal-25-february-2001-5315/` returned **HTTP 403** with the page title "Just a moment..." and "Enable JavaScript and cookies to continue". That is a Cloudflare challenge.
- **Rejected for a technical block.** It was not retried. Pages viewed: 2.

### 2.6 football-lineups.com (other source 2)

- `robots.txt` (`https://www.football-lineups.com/robots.txt`): `Crawl-delay: 30`; `Disallow` covers `/ajax/`, `/search/`, `/inc/` and others; `GPTBot` gets `Disallow: /`.
- Its home page `https://www.football-lineups.com/` returned **HTTP 403** with the same "Just a moment..." challenge.
- **Rejected for a technical block.** Pages viewed: 2.

---

## 3. The sample

**How the low-profile matches were picked**, before any lineup was opened:
- **Clubs:** the club's first home league match against an opponent outside the curated list (`match-pool-scope.md` § 2), taken in the order of Mackolik's club season page.
- **World Cup:** the first group match on Mackolik's 2006 World Cup page between two teams that appear in no knockout match on that page.

Mackolik URLs are `https://arsiv.mackolik.com/Mac/<id>/<slug>`. Dates are Mackolik's displayed date: the match page's `Tarih`, or the club-page row where no match page was fetched (marked †).

| # | Year | Slot | Match | Mackolik | Date | Other sources |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2001 | UCL knockout | UEFA Şampiyonlar Ligi Final 2000/2001, Bayern München v Valencia | `439931/Bayern-Munih-Valencia` | 23.05.2001 | Wikipedia `2001 UEFA Champions League final`; Wikidata `Q772884` |
| 2 | 2001 | Famous league | İngiltere Premier Lig 2000/2001, Manchester United v Arsenal | `354940/Manchester-United-Arsenal` | 25.02.2001 | openfootball `england/2000-01/1-premierleague.txt` |
| 3 | 2001 | Süper Lig derby | Türkiye Süper Ligi 2000/2001, Galatasaray v Fenerbahçe | `19232/Galatasaray-Fenerbahce` | 26.11.2000 | — |
| 4 | 2001 | Top-five rivalry | İspanya LaLiga 2000/2001, Barcelona v Real Madrid | `783844/Barcelona-Real-Madrid` | 21.10.2000 | Wikipedia `List of El Clásico matches` (row 141) |
| 5 | 2001 | Low-profile | İtalya Serie A 2000/01, Milan v Vicenza | `402952/Milan-Vicenza` | 1.10.2000 † | — |
| 6 | 2006 | Tournament knockout | Dünya Kupası 2006 Final, İtalya v Fransa | `132378/Italya-Fransa` | 9.07.2006 | Wikipedia `2006 FIFA World Cup final`; Wikidata `Q268567`; openfootball `worldcup/2006--germany/cup_finals.txt` |
| 7 | 2006 | Low-profile tournament | 2006 World Cup group match, Kosta Rika v Polonya | `105454/Kosta-Rika-Polonya` | not captured | — |
| 8 | 2006 | UCL knockout | UCL 2005/2006 final, Barcelona v Arsenal | `119580/Barcelona-Arsenal` | not captured | Wikipedia `2006 UEFA Champions League final` |
| 9 | 2006 | Süper Lig derby | Türkiye Süper Lig 2005/06, Beşiktaş v Galatasaray | `92755/Besiktas-Galatasaray` | 7.05.2006 † | — |
| 10 | 2006 | Low-profile | Almanya Bundesliga 2005/06, Bayern München v Mönchengladbach | `79926/Bayern-Munchen-Monchengladbach` | 5.08.2005 † | — |
| 11 | 2011 | UCL knockout | UEFA Şampiyonlar Ligi Final 2010/2011, Barcelona v Manchester United | `660387/Barcelona-Manchester-United` | 28.05.2011 | StatsBomb match `18236`; Wikipedia `2011 UEFA Champions League final` |
| 12 | 2011 | UEL knockout | UEL 2010/2011 final, Porto v Sporting Braga | `660600/Porto-Sporting-Braga` | not captured | Wikipedia `2011 UEFA Europa League final` |
| 13 | 2011 | Famous league | İngiltere Premier Lig 2011/2012, Manchester United v Manchester City | `678469/Manchester-United-Manchester-City` | 23.10.2011 | — |
| 14 | 2011 | Top-five rivalry | Fransa 1. Lig 2010/11, Paris Saint-Germain v Marseille | `413057/Paris-Saint-Germain-Marseille` | 7.11.2010 † | — |
| 15 | 2011 | Low-profile | Portekiz Premier Lig 2010/11, Benfica v Académica | `419175/Benfica-Academica` | 15.08.2010 † | — |
| 16 | 2019 | UCL knockout | UEFA Şampiyonlar Ligi Yarı Final 2018/2019, Liverpool v Barcelona | `3187253/Liverpool-Barcelona` | 7.05.2019 | Wikipedia knockout-phase article (no XI) |
| 17 | 2019 | UEL knockout | UEL 2018/2019 final, Chelsea v Arsenal | `3197677/Chelsea-Arsenal` | not captured | Wikipedia `2019 UEFA Europa League final` |
| 18 | 2019 | Süper Lig derby | Türkiye Süper Lig 2018/19, Fenerbahçe v Galatasaray | `3088483/Fenerbahce-Galatasaray` | 14.04.2019 † | — |
| 19 | 2019 | Top-five rivalry | İtalya Serie A 2018/19, Milan v Inter | `3101843/Milan-Inter` | 17.03.2019 † | — |
| 20 | 2019 | Low-profile | İspanya LaLiga 2018/19, Atlético Madrid v Rayo Vallecano | `3096686/Atletico-Madrid-Rayo-Vallecano` | 25.08.2018 † | — |
| E1 | 2020 | Edge case | UEFA Şampiyonlar Ligi Final 2019/2020, Paris Saint-Germain v Bayern München | `3450294/PSG-Bayern-Munih` | 23.08.2020 | Wikipedia `2020 UEFA Champions League final` |
| E2 | 2021 | Edge case | Euro 2020 Final 2021, İtalya v İngiltere | `3560181/Italya-Ingiltere` | 11.07.2021 | StatsBomb Euro 2020 (`matches/55/43.json`); Wikipedia `UEFA Euro 2020 final` |

E2 is the Euro 2020 final (July 2021) rather than the June group match the spec named. It was the first match listed on Mackolik's Euro 2020 page, and it tests the same date rule.

---

## 4. Coverage matrix

**yes** = present and usable · **partial** = present with a gap · **no** = absent · **—** = source doesn't have the match · **not captured** = only the lineup endpoint was fetched for that match, and it carries no date.

### 4.1 Mackolik, all 22 matches

These fields are the same for every match and are not repeated per row:
- **Formation: no.**
- **Positions: no.**
- **Player and club ids: yes.**
- **Stage text:** yes for cups; for leagues, only the competition name appears on the match page. The matchday should come from the fixture-week handler, which was only tried with `week=0`.
- **Lineup endpoint:** `/Match/MatchData.aspx?t=dtl&id=<id>&s=0`.

| # | Date | FT / HT score | ET / shootout | XI (listed per side) | Shirt numbers | Goals (minute, penalty flag) | Red cards |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | yes | 1-1 / 0-1 | yes: `UZ 1-1`, `Pen 5-4` | yes (14/14) | **no** (all 0) | yes (2 penalties) | none listed |
| 2 | yes | 6-1 / 5-1 | — | yes (13/13) | yes | yes | none listed |
| 3 | yes | 0-0 / 0-0 | — | yes (18/16) | yes | — (0-0) | none listed |
| 4 | yes | 2-0 / 1-0 | — | yes (14/13) | partial (1 of 22 is 0) | yes | none listed; 6 yellows at minute `0` |
| 5 | yes † | 2-0 / 1-0 | — | yes (14/14) | **no** (all 0) | yes | none listed |
| 6 | yes | 1-1 / 1-1 | yes: `et 1-1`, `pt 5-3` | yes (14/14) | yes | yes (Zidane `d:2`) | yes (110', `d:2`) |
| 7 | not captured | 1-2 / 1-1 | — | yes (14/14) | yes | yes | none listed |
| 8 | not captured | 2-1 / 0-1 | — | yes (14/14) | yes | yes | yes (18', `d:2`) |
| 9 | yes † | 1-2 / 0-0 | — | yes (18/18) | yes | yes | none listed |
| 10 | yes † | 3-0 / 1-0 | — | yes (14/13) | yes | yes | yes (43', `d:1`) |
| 11 | yes | 3-1 / 1-1 | — | yes (14/13) | yes | yes | none listed |
| 12 | not captured | 1-0 / 1-0 | — | yes (13/14) | yes | yes | none listed |
| 13 | yes | 1-6 / 0-1 | — | yes (18/18) | yes | yes, with assists | yes (47', `d:2`) |
| 14 | yes † | 2-1 / 2-1 | — | yes (13/14) | yes | yes | none listed |
| 15 | yes † | 1-2 / 0-1 | — | yes (14/13) | yes | yes | yes (51', `d:1`) |
| 16 | yes | 4-0 / 1-0 | — | yes (18/18) | yes | yes, with assists | none listed |
| 17 | not captured | 4-1 / 0-0 | — | yes (22/23) | yes | yes (one `d:2`) | none listed |
| 18 | yes † | 1-1 / 0-0 | — | yes (21/21) | yes | yes, with assists | yes (45', `d:2`) |
| 19 | yes † | 2-3 / 0-1 | — | yes (23/18) | yes | yes (one `d:2`) | none listed |
| 20 | yes † | 1-0 / 0-0 | — | yes (18/18) | yes | yes, with assists | none listed |
| E1 | yes | 0-1 / 0-0 | — | yes (23/23) | yes | yes | none listed |
| E2 | yes | 1-1 / 0-1 | yes: `et 1-1`, `pt 3-2` | yes (23/23) | yes | yes | none listed |

**Starters vs substitutes.** The JSON doesn't flag starters. In every one of the 22 matches above, plus a 2001 cup semi-final (`678892`), the **first 11** entries of `h` and `a` are the starters:
- No player who comes on in a substitution event (`type 4`) is among the first 11.
- Every player taken off is.
- The rendered page draws 11 rows, then a spacer row, then the bench.

**Per year, for the decision rule:**

| Year | Both full XIs, starters separated | Low-profile included |
| --- | --- | --- |
| 2001 | 5 / 5 | yes (#5) |
| 2006 | 5 / 5 | yes (#7, #10) |
| 2011 | 5 / 5 | yes (#15) |
| 2019 | 5 / 5 | yes (#20) |

### 4.2 Other sources, where they have the match

| # | Source | Date | FT/HT | ET/Pen | XI | Formation | Positions | Shirt # | Goals | Ids |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wikipedia | not checked | not checked | not checked | **yes** (2 × 11) | no string found | **yes** (`GK`, `CB`, `RWB`…) | yes | not checked | wiki links |
| 1 | Wikidata | — | — | — | **no** (28 participants, no starter flag) | no | 5 of 28 | yes | no | QIDs |
| 2 | openfootball | yes (`Sun Feb 25`, 13:00) | yes (6-1, 5-1) | — | no | no | no | no | no | no |
| 6 | Wikipedia | not checked | not checked | not checked | **yes** (2 × 11) | not parsed | **yes** (`GK`, `RB`, `CB`, `LB`, `RM`…) | yes | not checked | wiki links |
| 6 | openfootball | yes (`Sun Jul 9`) | yes (1-1 a.e.t.) | yes (5-3 pen.) | no | no | no | no | yes (`Materazzi 19'; Zidane 7' (pen.)`) | no |
| 6 | Wikidata | — | — | — | **no** (27 participants) | no | 4 of 27 | yes | no | QIDs |
| 11 | StatsBomb | yes (`2011-05-28`, `20:45:00.000`) | yes | — | **yes** (`start_reason == "Starting XI"`, 11 each) | **yes** (`41221`, `4222`) | **yes** (`Right Back`, `Left Center Back`, `Left Wing`…) | yes | yes (type, minute) | yes |
| E2 | StatsBomb | listed in `matches/55/43.json` | not checked | not checked | not checked | not checked | not checked | — | — | — |
| 8, 12, 17, E1, E2 | Wikipedia | own article exists (not parsed) | | | | | | | | |
| 16 | Wikipedia | knockout-phase article only | | | **no** | | | | | |

Every other cell (source × match) is **—**: the source doesn't have that match (§ 2.2–2.4).

**Formation coverage per year**, across all sources and the sample:

| Year | Matches with a formation | Where |
| --- | --- | --- |
| 2001 | 0 / 5 | Wikipedia #1 gives positions, not a formation string |
| 2006 | 0 / 5 | Wikipedia #6 gives positions |
| 2011 | 1 / 5 | StatsBomb #11 |
| 2019 | 0 / 5 | — |

---

## 5. Id stability (Mackolik)

Player ids found in two or more sample matches, from the lineup JSON. No name appeared with more than one id across the 23 matches fetched.

| Player (as Mackolik writes it) | Id | Matches (Mackolik ids) | Spans |
| --- | --- | --- | --- |
| Thierry Henry | 5805 | 354940 (2001), 119580 (2006), 132378 (2006) | Club and national team, two seasons |
| Carles Puyol | 8419 | 783844 (2000), 119580 (2006), 660387 (2011) | 11 years |
| Xavi | 8425 | 783844 (2000), 660387 (2011) | 11 years |
| Claude Makelele | 8294 | 783844 (Real Madrid), 132378 (France), 413057 (PSG) | Three teams |
| Pablo Aimar | 8200 | 439931 (Valencia, 2001), 419175 (Benfica, 2010) | Two clubs, 9 years |
| Willy Sagnol | 6961 | 439931 (2001), 79926 (2005), 132378 (France, 2006) | Club and national team |

Club ids are stable too: the same id appears in every season URL tried (Galatasaray `1`, Manchester United `32`, Barcelona `83`, Milan `156`).

---

## 6. Disagreements

| Match | Field | Values | Reading |
| --- | --- | --- | --- |
| #4 Barcelona v Real Madrid | Date | Mackolik match page `21.10.2000 01:00`; Mackolik club page `startDate` `2000-10-20T22:00`; Wikipedia `List of El Clásico matches` row 141 `21 October 2000` | **Mackolik's two fields disagree with each other.** The displayed date agrees with Wikipedia; the schema timestamp is a day early |
| #5 Milan v Vicenza | Date | Club-page row `1.10.2000`; `startDate` `2000-09-30T22:00` | Same pattern; no second source checked |
| #2 Manchester United v Arsenal | Kick-off time | Mackolik `25.02.2001 02:00`; openfootball `Sun Feb 25 13:00` | Date agrees, **time is wrong** on Mackolik |
| #11 Barcelona v Manchester United | Kick-off time | Mackolik `21:45`; StatsBomb `20:45:00.000` | Different time bases. **Don't use Mackolik times** |
| #6 Italy v France | Zidane's penalty minute | Mackolik `6`; openfootball `7'` | One minute apart |
| #11 | All four goal minutes | Mackolik 27, 34, 54, 69; StatsBomb `minute` 26, 33, 53, 68 | StatsBomb's `minute` is elapsed time; consistently one lower |
| `678892` (2001 Türkiye Kupası semi-final, out of scope) | Date | Mackolik `7.02.2001 20:30`; Wikipedia `2000–01 Galatasaray S.K. season`: 6 February 2001 | One day apart |
| #1, #6 | XIs | Wikipedia's XIs vs Mackolik's first 11 | **Agree** on all 44 starters (by surname) |
| #16 | XIs | Mackolik's first 11 vs FotMob, as quoted in a web-search summary of `https://www.fotmob.com/livescores/3010097` | Agree; the summary is a secondary reading |

---

## 7. Shape notes for later phases

### S06 Fetch harness

- **Mackolik needs no JavaScript.** Pages are server-rendered; lineups and events come from `/Match/MatchData.aspx?t=dtl&id=<id>&s=0`, which returns JSON with `content-type: text/html; charset=utf-8`. Parse the body as JSON whatever the header says.
- No block seen at one request every 2–5 s. `robots.txt` disallows only `/api/` and `/_nuxt/` for `*`, but it disallows **`anthropic-ai`** entirely. The dev-phase policy lets the harness ignore that; the report records it.
- **Request budget per match:** one lineup call. The id comes from a club or competition season page, and each club page covers 48–73 matches. The ~3,600 lineup pages in `match-pool-scope.md` § 3 means about 3,600 lineup calls plus a few hundred listing pages.
- StatsBomb and openfootball are GitHub repos. A shallow `git clone` (or GitHub's archive download) can replace thousands of per-file requests. Unauthenticated GitHub API listings are rate-limited, so prefer raw file URLs or a clone.
- Wikipedia: the Action API is under `/w/`, which `robots.txt` disallows for `*`. Wikimedia's rules for API clients (such as a User-Agent policy) weren't fetched here. S09 checks them and decides.
- The trial used a User-Agent without contact details. S06 sets the real one, and its contact is the user's call.

### S07 Match metadata

- **Ids:** competitions are UCL `48`, UEFA Cup / Europa League `178` (one id across the rename; its season list includes 2000/2001), World Cup `180`, Euro `179`. Süper Lig season ids are `96` (2000/01), `856` (2005/06), `5539` (2010/11) and `51830` (2018/19); others come from `CompetitionHandler.aspx`.
- **Club ids:** Galatasaray 1, Fenerbahçe 2, Beşiktaş 3, Arsenal 20, Chelsea 26, Liverpool 30, Manchester City 31, Manchester United 32, Tottenham 37, Real Madrid 79, Valencia 80, Barcelona 83, Atlético Madrid 86, Bayern 119, Inter 155, Milan 156, PSG 195, Lyon 201, Benfica 270.
- **The universe is enumerable** from club season pages (every match of a curated club, with competition headings, side and opponent id) and cup season and stage pages (every UCL and World Cup match).
- **Stage labels seen** (raw, for the mapping file): `Final`, `Yarı Final`, `Çeyrek Final`, `Play Off`, `Grup A`…`Grup H`, `1.Eleme Turu`, `2.Eleme Turu`, `3.Eleme Turu`, `2. Tur A Grubu`…`2. Tur D Grubu` (UCL 2000/01's second group stage). Leg rows read `1. Maçlar`. Club pages use `Kupa Çeyrek Final`, `Süper Kupa` and `Efes Pilsen Kupası` for domestic cups, which are out of scope.
- **League matchday isn't on the match page.** It should come from `FixtureHandler.aspx?command=getMatches&id=<sId>&week=<n>`, but only `week=0` was tried (it returned `[]`), so **this is untested**. openfootball has `Matchday N` for England.
- **Dates: use the displayed `Tarih` (match page) or the club-page row date, never `startDate`**, which ran a day early for two 2000 matches (§ 6). **Ignore kick-off times.** Format is `d.mm.yyyy` (single-digit day: `1.10.2000`, `7.05.2019`).
- **Score keys:** `d.s` is the final score; `d.st` is `MS` (full time) or `Pen`; `d.ht` is half time; `d.ft`, `d.et` and `d.pt` are filled only when the match went to extra time or penalties (`et` is the score after extra time, `pt` the shootout). Whether `s` includes extra-time goals wasn't tested on a match with goals in extra time.
- **Season labels:** club competitions read `2000/2001`; tournaments read `2006`. **Mackolik files Euro 2020 under season `2021`** and titles it `Euro 2020 Final 2021`. The 2019–20 UCL final is dated `23.08.2020` under `2019/2020`. Both are the date-window exceptions in data contract § 6.4.
- **Names are Turkish:** national teams (`İtalya`, `Fransa`, `Kosta Rika`, `Polonya`, `İngiltere`), competitions (`İngiltere Premier Lig`, `Fransa 1. Lig`, `Portekiz Premier Lig`) and some clubs in slugs (`Bayern-Munih`).

### S08 Entity resolution

- **Mackolik ids are stable** across seasons, clubs and national teams (§ 5). They make a sound crosswalk key.
- **Mackolik names are not display names.**
  - Turkish players keep their diacritics: `Rüştü Reçber`, `Emre Belözoğlu`, `Hasan Ali Kaldırım`.
  - Most other names are ASCII-folded: `Hasan Salihamidzic`, `Michal Zewlakow`, `Pawel Brozek`, `Michael Umana`, `Raul Gonzalez`, `Marc-Andre ter Stegen`. There are exceptions (`Sergio Agüero`) and odd forms (`Perez Munoz Alfonso`).
  - Common names and nicknames are used: `Xavi`, `Pedro`, `Chicharito`, `Capone`, `Jardel`, `Guly`, `Koke`, `Canizares`.
- **Canonical names are available** from StatsBomb (full legal name plus a `player_nickname`: `Pedro Eliezer Rodríguez Ledesma` / `Pedro`) and Wikidata labels (match items link participants by QID). Mackolik spellings become aliases.
- Player pages exist at `/Futbolcu/<id>/<slug>`. None was opened, so their fields (birth date, nationality) are **unverified**.

### S11 Lineup extract

- **Starters:** the first 11 entries of `h` and `a`. Verified on 23 matches (§ 4.1). Each entry is `[playerId, name, shirtNumber]`; the shirt number is `0` when unknown (all 22 starters in #1 and #5).
- **The first entry was the goalkeeper** in the three matches checked against StatsBomb or Wikipedia (#1, #6, #11). The order of the other ten was **not** verified to run defence to attack.
- **No formation and no positions on Mackolik**, in any year. S11 must infer them (from StatsBomb or Wikipedia where available, otherwise by rule) or exclude the match. S02 doesn't decide which (spec § Decision Rules).
- **Events** (`e`: `[side 1|2, minute, playerId, name, type, extra]`):
  - Type `1` is a goal: `d:1` an ordinary goal, `d:2` a penalty (both 2001-final goals; Zidane 2006; Lautaro 2019).
  - Type `2` is a yellow card.
  - Type `3` is a red card. `d:1` occurred where the player already had a yellow (#10, #15); `d:2` where he had none (#6, #8, #13, #18). That reads as second yellow versus straight red, **inferred from six cases**.
  - Type `4` is a substitution: `d` is the id of the player taken off, `sub` their name.
  - From 2011, goals carry `astId` and `astName` (assist).
  - **No own goal appeared** in the sample, so its encoding is unknown. Check it in S06 or S11.
- **Added time is not recorded.** Every goal after 90 minutes is minute `90` (#13 has three). Extra-time minutes are kept (`93`, `100`, `108`, `110`, `111`). `match_events.added_time` stays `NULL`, and a "90'+ winner" can't be told from a 90th-minute one.
- **Minute `0`** appears on yellow cards in #4. The contract's `minute` is 1–120, so drop or skip those events (yellow cards aren't stored anyway).
- Data contract § 6.6 still holds: write `position = positionForSlot(formation, slot)`. Never copy a source's position label, including StatsBomb's.

---

## 8. Follow-ups

| Change | Where | Owner |
| --- | --- | --- |
| Sources table: Mackolik **primary** for metadata, lineups and events; StatsBomb and Wikipedia **fill gaps**; openfootball **cross-check**; Wikidata for S08 names; 11v11.com and football-lineups.com **rejected** (Cloudflare). API-Football is no longer "primary": it wasn't trialled, and Mackolik covered every sample match | `project-overview.md` § Sources (shared spec) | Backend docs change, then copied to web, mobile and the scraper |
| Season range: **no change**. 2000–01 onward holds for XIs | — | — |
| Formations: no free source covers most matches. Decide inference or exclusion, and whether a paid trial is worth it for formations only | S11 spec | Scraper |
| Euro 2020 filed as `2021`; the 2019–20 UCL final in August 2020 | S04 `seasonIssue` exceptions (setup doc § 11, decision 8) | Scraper |
| Use displayed dates, never `startDate` or kick-off times; cross-check pre-2008 dates against openfootball or Wikipedia where they exist | S07 spec | Scraper |
| Licences before marketing: Mackolik, StatsBomb, Wikipedia (CC BY-SA, to confirm) | Release checklist | User |
| The real User-Agent and its contact | S06 | User |
| Own-goal encoding and Mackolik player-page fields | S06 or S11 fixture work | Scraper |
| Formation availability on the newer `www.mackolik.com` site (not reached; it redirected) | S06 or S11, if a way in exists without a workaround | Scraper |
