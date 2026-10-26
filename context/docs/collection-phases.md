# Collection Phases

Which phases fetch from websites, what they collect, and how it reaches the database. Python fetches everything; TypeScript never makes a request to a source.

## Phases that fetch

| Phase | Collects | From | Writes | Feeds |
| --- | --- | --- | --- | --- |
| **S07** Match Metadata Extract | Fixtures, scores, dates, stages, competitions for the whole universe | Transfermarkt fixture lists (`transfermarkt-source.md` § 2) | `data/raw/transfermarkt/fixture/` | S08, S10 |
| **S09** Cultural Footprint | Match articles, pageviews, nicknames | Wikipedia and Wikidata APIs | `data/raw/wikipedia/`, `data/raw/wikidata/` | S10 |
| **S11** Lineup Extract | Starting XIs, formations, coordinates, goals and cards, **for the shortlist only** | Transfermarkt match reports | `data/raw/transfermarkt/match/` | S12, S13 |
| **S18** Image Ingest | Player images, club crests, their licence metadata, **for pool entities only** | Wikimedia Commons (or none: initials). Not Transfermarkt images | `data/raw/images/` | S18's upload |

**May fetch:** S08, for Transfermarkt player pages (DOB for disambiguation) and Wikidata labels; S12, if extra aliases come from Wikidata. The fetch is a Python step in that phase.

## Phases that fetch nothing but set up fetching

| Phase | Role |
| --- | --- |
| **S02** Source Trial | Manual look at a handful of pages per source; decides the sources. Nothing is ingested |
| **S05** Raw Record Contract | The JSON Schemas every fetched record is validated against |
| **S06** Fetch Harness | Scrapy with cache, throttle and retries; parser fixtures saved from real responses |

## From fetch to database

1. **S07** fetches metadata → **S08** resolves clubs and competitions into slugs
2. **S09** fetches footprint → **S10** scores everything and picks the shortlist
3. **S11** fetches lineups for the shortlist → **S08**'s crosswalk resolves the players → **S12** builds aliases → **S13** gates
4. **S14** writes `data/dataset/` → **S15** loads it into Postgres
5. **S18** fetches images for the pool → uploads them (S17 client) → writes `crest_key` and `image_key`

- Only the pool reaches Postgres and the bucket (`match-pool-scope.md`).
- Rules for every fetch: `coding-standards-scraper.md` § Sources.
