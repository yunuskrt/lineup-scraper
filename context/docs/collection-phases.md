# Collection Phases

Which phases collect from websites, what they collect, and how it reaches the database. Python does all collecting and parsing; TypeScript never makes a request to a source.

There are two ways in:
- **Saved by hand (👤):** Transfermarkt challenges automated requests, so the user saves its pages and `extract.inbox` parses them (`transfermarkt-source.md` § 8, `manual-work.md`)
- **Fetched by the harness:** sources that allow automated access, through `extract.crawl` with the cache and throttle

## Phases that collect

| Phase | Collects | From | How | Writes | Feeds |
| --- | --- | --- | --- | --- | --- |
| **S07** Match Metadata Extract | Fixtures, scores, dates, stages, competitions for the whole universe | Transfermarkt fixture lists (`transfermarkt-source.md` § 2) | 👤 Saved by hand, from a link list S07 generates | `data/raw/transfermarkt/fixture/` | S08, S10 |
| **S09** Cultural Footprint | Match articles, pageviews, nicknames | Wikipedia and Wikidata APIs | Harness; each crawl approved by the user | `data/raw/wikipedia/`, `data/raw/wikidata/` | S10 |
| **S11** Lineup Extract | Starting XIs, formations, coordinates, goals and cards, **for the shortlist only** | Transfermarkt match reports | 👤 Saved by hand, in batches, from a link list S11 generates | `data/raw/transfermarkt/match/` | S12, S13 |
| **S18** Image Ingest | Player images, club crests, their licence metadata, **for pool entities only** | Wikimedia Commons (or none: initials). Not Transfermarkt images | Harness, approved by the user | `data/raw/images/` | S18's upload |

**May collect:** S08, Transfermarkt player pages (👤 saved by hand), only if names clash, and Wikidata labels (harness); S12, if extra aliases come from Wikidata (harness).

## Phases that collect nothing but set up collecting

| Phase | Role |
| --- | --- |
| **S02** Source Trial | Manual look at a handful of pages per source; decides the sources. Nothing is ingested |
| **S05** Raw Record Contract | The JSON Schemas every collected record is validated against |
| **S06** Fetch Harness | S06a: Scrapy with cache, throttle, retries and block handling, for automated sources. S06b: Transfermarkt parsers and the `extract.inbox` import of hand-saved pages; parser fixtures are hand-saved pages |

## From collection to database

1. **S07**: the user saves fixture lists → the inbox parses them → **S08** resolves clubs and competitions into slugs
2. **S09** fetches footprint → **S10** scores everything and picks the shortlist
3. **S11**: the user saves the shortlist's match reports → **S08**'s crosswalk resolves the players → **S12** builds aliases → **S13** gates
4. **S14** writes `data/dataset/` → **S15** loads it into Postgres (the user approves each load)
5. **S18** fetches images for the pool → uploads them (S17 client) → writes `crest_key` and `image_key`

- Only the pool reaches Postgres and the bucket (`match-pool-scope.md`).
- Rules for every collection: `coding-standards-scraper.md` § Sources.
