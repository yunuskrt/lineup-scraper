# Phase S02 — Source Trial

## Status

Not Started

## Goals

- **`context/research/source-trial.md`**: the `/research` prompt, with the four headings the skill reads:
  - **Output**: `context/docs/source-trial.md`
  - **Research**: every source in § Sources, against the sample in § Sample, for every field in § Fields
  - **Include**: the report structure in § Report
  - **Sources**: this spec, `context/docs/data-contract.md` (§§ 2, 6), `context/docs/data-display-requirements.md` (§§ 3, 5), `context/docs/match-pool-scope.md` (§ 2), `context/coding-standards-scraper.md` (§ Sources). Tools: WebFetch, the Playwright MCP (inspection only) and WebSearch
- **`context/docs/source-trial.md`**: the report, written by running `/research source-trial`. It settles four things, each with the evidence behind it:
  1. Each source's role: **primary**, **fill gaps** or **rejected**, given separately for metadata, lineups and events
  2. The season range: whether 2000–01 onward holds, or the honest fallback of 2008–09 onward (spec § Ingestion strategy)
  3. The fetch stack: Scrapy, Scrapy plus `scrapy-playwright`, or plain httpx
  4. Which sources need a licence before the app is marketed
- **Follow-ups listed in the report, not done in this phase**: the `project-overview.md` Sources table change (a backend docs change, copied to every repo), any season-range or `competition_kind` change (backend, then web, then mobile), and notes for S06, S07, S08 and S11

## Sources

| Source | Kind | Trial for |
| --- | --- | --- |
| **Mackolik** (mackolik.com) | Scraped site | Metadata, lineups, events. The main candidate |
| **StatsBomb Open Data** | Free JSON on GitHub | World Cup and Euro spot-filling, validation |
| **openfootball / football.db** | Free data files | The fixture and result skeleton for 2000–2026 |
| **Wikipedia / Wikidata** | APIs | XIs for famous matches. Footprint itself is S09's job, so only note what's there |
| Up to two others found while researching | Any | Only if one plausibly fills a gap the four above leave |

- **Paid APIs are out of this trial** (API-Football, Sportmonks), by decision before the start. The spec still names API-Football as the primary lineup source, so the report lists that as a follow-up, and recommends a paid trial only if the free sources leave a gap.
- **Transfermarkt, FBref and worldfootball.net** are manual spot-checks only (spec § Sources). Use them to cross-check a sample XI by hand, never as a candidate for scraping.
- **LLMs are not a source.** Every date, score, name and XI in the report cites the page it came from.

## Sample

Twenty matches: five per year, across every league in scope and the `ucl`, `uel` and `world_cup` kinds. The **low-profile** slot matters most, because famous matches are documented everywhere and would overstate coverage. Pick each low-profile match from a source's fixture list **before** looking at its lineup, and say in the report how it was picked.

| # | Year | Slot | Match (identity only) |
| --- | --- | --- | --- |
| 1 | 2001 | UCL knockout | 2000–01 Champions League final, Bayern Munich v Valencia |
| 2 | 2001 | Famous league match | Premier League 2000–01, Manchester United v Arsenal at Old Trafford |
| 3 | 2001 | Süper Lig derby | Süper Lig 2000–01, Galatasaray v Fenerbahçe (either leg) |
| 4 | 2001 | Top-five rivalry | La Liga 2000–01, El Clásico (either leg) |
| 5 | 2001 | Low-profile | Serie A 2000–01, Juventus, Milan or Inter v a mid-table side |
| 6 | 2006 | Tournament knockout | 2006 World Cup final, Italy v France |
| 7 | 2006 | Low-profile tournament | 2006 World Cup group match between two lower-profile nations |
| 8 | 2006 | UCL knockout | 2005–06 Champions League final, Barcelona v Arsenal |
| 9 | 2006 | Süper Lig derby | Süper Lig 2005–06, Beşiktaş v Galatasaray (either leg) |
| 10 | 2006 | Low-profile | Bundesliga 2005–06, Bayern Munich or Borussia Dortmund v a mid-table side |
| 11 | 2011 | UCL knockout | 2010–11 Champions League final, Barcelona v Manchester United |
| 12 | 2011 | UEL knockout | 2010–11 Europa League final, Porto v Braga |
| 13 | 2011 | Famous league match | Premier League 2011–12, Manchester United v Manchester City at Old Trafford |
| 14 | 2011 | Top-five rivalry | Ligue 1 2010–11, Le Classique (either leg) |
| 15 | 2011 | Low-profile | Primeira Liga 2010–11, Porto or Benfica v a mid-table side |
| 16 | 2019 | UCL knockout | 2018–19 Champions League semi-final, second leg, Liverpool v Barcelona |
| 17 | 2019 | UEL knockout | 2018–19 Europa League final, Chelsea v Arsenal |
| 18 | 2019 | Süper Lig derby | Süper Lig 2018–19, Fenerbahçe v Galatasaray (either leg) |
| 19 | 2019 | Top-five rivalry | Serie A 2018–19, the Derby della Madonnina (either leg) |
| 20 | 2019 | Low-profile | La Liga 2018–19, Atlético Madrid v a mid-table side |

**Two edge cases, checked for dates and coverage only:** a Euro 2020 match played in June 2021, and the 2019–20 Champions League final, played in August 2020. Both test the date windows in data contract § 6.4.

The table names identities only. Every date, score and XI in the report comes from a cited page.

## Fields

Check each sample match in each source that has it. Mark every field **yes**, **partial** or **no**, with the URL it was checked on.

| Field | Needed by | What to note |
| --- | --- | --- |
| Date | S07, contract § 6.4 | Local date or UTC, and the format |
| Competition and stage text | S07 | The raw label (for example `Yarı Final`, `34. Hafta`) for the stage mapping |
| Full-time and half-time score | S07, S10 drama | Whether full time includes extra time |
| Extra time, shootout score | S10, `matches` | How each is shown |
| **Starting XI, both sides** | S11, the gate | Are starters clearly separated from substitutes? All 22 named? |
| Formation | S11, `match_teams.formation` | Its format, and whether it's given or only drawn |
| Positions and on-page order | S11 slot mapping | The labels, and whether the order is defence to attack |
| Shirt numbers | S11 | Present? |
| Goals | `match_events` | Scorer, minute, added time (`90+3`), penalty, own goal |
| Red cards | `match_events` | Including second yellows |
| Player and club ids | S08 | Is there an id in the URL or payload? Is it the same across seasons (below)? |
| Player page | S08 disambiguation | Full name, birth date, nationality |
| Name spelling | S08, S12 | The raw spelling (Turkish variants like `Şevçenko`), the encoding, NFC or not |

**Id stability:** take at least three players who appear in two sample matches several years apart, and check that the source gives each of them the same id both times.

**Access mechanics, per source:**
- Static HTML, embedded JSON, a JSON request behind the page, or an official API
- Login or key, quota, price tier
- Whether fixtures can be listed per competition-season, so S07 can enumerate the universe
- Encoding
- Any technical block seen: a CAPTCHA, a Cloudflare challenge, a login wall. **A technical block rejects the source**

## Decision Rules

- **Lineups usable for a year:** the source gives both full XIs, starters separated from substitutes, for at least 4 of that year's 5 sample matches, the low-profile one included.
- **The 2000s hold** if one source, or two combined as primary plus fill-gaps, meets that bar for 2001 and 2006. Otherwise the report recommends starting at 2008–09. That is a backend contract change first, never made in this repo.
- **Formation coverage** is reported per year. If a year lacks it, the report says so plainly: S11 must then infer the formation or exclude the match. S02 doesn't decide which.
- **Metadata source:** it must list complete fixtures per competition-season for every competition in `match-pool-scope.md` § 2.
- **Fetch stack:** Scrapy unless every chosen source is a key-based JSON API, in which case the report weighs httpx. Add `scrapy-playwright` only if a chosen source needs JavaScript for its data.

## Report

`context/docs/source-trial.md`, in this order:

1. **Verdict.** Sources and roles, the season range, the fetch stack, the licence list, each in one line with a pointer to its evidence.
2. **Per source.** Access mechanics, `robots.txt` (fetch date and the relevant rules), terms (URL, fetch date, the relevant clause quoted), technical blocks, pages viewed.
3. **The sample.** The 20 matches plus the two edge cases, each with its identifying URL in every source.
4. **Coverage matrix.** Source × match × field, as yes, partial or no, with links.
5. **Id stability.** The players checked and their ids.
6. **Disagreements.** Where two sources give different XIs, scores or minutes for the same match.
7. **Shape notes for later phases.** Stage vocabulary, the formation format, position labels, the minute format, how own goals and shootouts are shown, encoding. Grouped by S06, S07, S08 and S11.
8. **Follow-ups.** Changes this report triggers in other repos or docs, each with its owner.

## Out of Scope

- No spider, parser, raw record or saved fixture. Parser fixtures come from spider responses in S06, never from the browser.
- No edit to `project-overview.md`, `data-contract.md` or `match-pool-scope.md`. The report recommends; the changes follow in their owners' phases.
- No database, no bucket, no Neon branch.

## Decisions

1. **Paid APIs (API-Football, Sportmonks): skipped entirely.** Only scraped and free sources are trialled. No API key is needed.
2. **Transfermarkt, FBref and worldfootball.net: manual cross-check only.** They verify sample XIs by hand and are never evaluated as scrape candidates.

## Notes

- Scope: a documentation phase. The one artifact is the report and the prompt that produces it. Both test suites and linters stay green because no code changes.
- Depends on: S01 (the repo exists). Every later fetching phase depends on this one, and the season range in the backend contract may too.
- Constraints:
  - **No LLM is a source** (HC 4). Every date, score, name and XI cites a page. The sample table gives identities, never facts.
  - **Look, don't collect.** The Playwright MCP and WebFetch are for reading pages, checking JavaScript and finding JSON requests. Nothing is copied out as a record.
  - **Never crawl.** A handful of pages per match per source, slowly; about 40 page views per source at most, counted in the report.
  - `robots.txt` and terms are recorded but don't block until release. **A technical block stops that source**, with no workaround (`coding-standards-scraper.md` § Sources).
  - The report names which sources need a licence before marketing.
- Verification:
  - The report covers every source × sample match × field, or says why a cell is empty
  - Every fact has a URL and an access date
  - Each of the four verdicts follows from § Decision Rules and the matrix
  - Page counts per source stay within the limit
  - `npm test`, `uv run pytest` and both linters still pass, since nothing changed

**Deviations recorded during implementation**

- Mackolik took ~80 page views, not ~40: every match id needs a club or season listing page first
- E2 is the Euro 2020 final (July 2021), not a June group match: it was first on Mackolik's Euro page
- The two "other" sources were 11v11.com and football-lineups.com; both are rejected (Cloudflare challenge)
- Report verdict: Mackolik is primary for all three roles; no free source has formations for most matches

## History
