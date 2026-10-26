# Collection Phases

Which phases collect from websites, what they collect, and how it reaches the database. Python does all collecting and parsing; TypeScript never makes a request to a source.

There are two ways in:
- **Saved by hand (👤):** Transfermarkt challenges automated requests, so the user saves its pages from a link list and `extract.inbox` parses them (`transfermarkt-source.md` § 8, `manual-work.md`, `link-map.md`)
- **Fetched by the harness:** sources that allow automated access, through `extract.crawl` with the cache and throttle

## Phases that collect

| Phase | Collects | From | How | Writes | Feeds |
| --- | --- | --- | --- | --- | --- |
| **S07** Pool Selection | The match ids, dates, teams and stages of every pool group (`match-pool-scope.md` § 1) | Transfermarkt fixture lists or head-to-head pages (`link-map.md` § 2) | 👤 Saved by hand, from a link list S07 writes | `data/raw/transfermarkt/fixture/` | S08, S11 |
| **S11** Lineup Extract | Starting XIs, formations, coordinates, goals and cards, for every pool match | Transfermarkt match reports | 👤 Saved by hand, in batches, from a link list S11 writes | `data/raw/transfermarkt/match/` | S11b, S08, S13 |
| **S11b** Player Pages | Display name, full name, caps, date of birth, citizenship, for every pool starter | Transfermarkt player profiles | 👤 Saved by hand, in batches, from a link list S11b writes | `data/raw/transfermarkt/player/` | S08, S10, S12 |
| **S18** Image Import | A crest per club and a photo per player, **for pool entities only** | Wherever the user saves them from; the licence is checked before release | 👤 Saved by hand, from a list S18 writes | `data/images/` | S18's upload |

**Wikipedia is not a pipeline source** (dropped 2026-10-27, with S09). It may help decide which matches belong in `data/curation/pool-include.json`, never as data. The S06a harness stays for any automated source a later phase approves.

## Phases that collect nothing but set up collecting

| Phase | Role |
| --- | --- |
| **S02** Source Trial | Manual look at a handful of pages per source; decides the sources. Nothing is ingested |
| **S05** Raw Record Contract | The JSON Schemas every collected record is validated against |
| **S06** Fetch Harness | S06a: Scrapy with cache, throttle, retries and block handling, for automated sources. S06b: Transfermarkt parsers and the `extract.inbox` import of hand-saved pages; parser fixtures are hand-saved pages |
| **S06c** Collection Tools | Link lists with file names and folders, and the progress and check tools |

## From collection to database

1. **S07**: the user saves listing pages → the inbox parses them → the pool match list → **S08** resolves clubs and competitions into slugs
2. **S11**: the user saves the pool's match reports → **S11b**: the user saves their starters' player pages → **S08**'s crosswalk resolves the players
3. **S12** builds aliases → **S10** scores every pool match from match data → **S13** gates
4. **S14** writes `data/dataset/` → **S15** loads it into Postgres (the user approves each load; backend request R1 first) → **S19** shows it all on the dashboard
5. Later, **S18**: the user saves images for the pool → they are uploaded (S17 client) → `crest_key` and `image_key`

- Only the pool reaches Postgres and the bucket (`match-pool-scope.md`).
- Rules for every collection: `coding-standards-scraper.md` § Sources.
