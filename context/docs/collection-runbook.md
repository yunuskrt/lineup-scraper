# Collection Runbook

The short version of `enrichment-guide.md`. Follow `data/inbox-lists/general.csv` from top to bottom.

## The files

All in `data/inbox-lists/` (local, never committed), rewritten by `npm run status`:

| File | Holds |
| --- | --- |
| `general.csv` | Every link, in the order to save: the 238 listing pages, then one block per match (its report, then its crests, starters and photos) |
| `listings.csv` | Listing pages (fixture lists) |
| `match-reports.csv` | Match reports |
| `players.csv` | Player pages |
| `images.csv` | Crests and photos |

Columns: `#,Link,Save as,Folder,Status`; `general.csv` adds `Type` after `#`: Fixture, Match Report, Player, Crest or PlayerPhoto.

Each link appears once. A player or club already listed under an earlier match isn't listed again.

## Statuses

| Link | Ladder |
| --- | --- |
| Listing page | `to save` → `saved` → `parsed` |
| Match report, player page | `to save` → `saved` → `parsed` → `validated` → `ingested` |
| Crest, photo | `to save` → `saved` → `uploaded` → `ingested` |

`error: <reason>` replaces the status when something is wrong.

## Save and import (repeat)

1. `uv run python -m extract.links open general --count 10`: opens the next 10 links still `to save`
2. Save each into `data/inbox/` under its `Save as` name:
   - a page: ⌘S, **Webpage, HTML Only**
   - an image: ⌘S on the image itself
3. `uv run python -m extract.inbox`: imports and parses. A file already stored prints `already saved, skipping`
4. `npm run status`: updates the 5 CSVs. New rows appear:
   - match reports, once their listing page is parsed
   - crests, player pages and photos, right under a match, once its report is parsed
   - a photo, once its player page is parsed

Save all 238 listing pages first; then go match by match.

## Build and ingest (after a batch of matches)

**From the dashboard** (`npm run dashboard`): press **Run batch** (import, status, build, upload images, dry run), read the counts and `data/reports/gate.md`, then **Load into `ingest`** (load, verify, status) and commit `data/dataset/`. The same steps by hand:

5. `npm run build`, then read `data/reports/gate.md`, `images.md` and `images.html`
6. `npm run images -- --upload` (`already uploaded, skipping` for the rest)
7. `git add data/dataset && git commit`
8. `npm run load`: the dry run, counts only. Then `npm run load -- --apply` (`already ingested, skipping` for the rest)
9. `npm run verify`
10. `npm run status`

## When to run `npm run status`

After every import, build, upload and load. It only reads, so it's safe any time.

## Errors

| Status | Do |
| --- | --- |
| `error: challenge page` | Save the page again once the site loads normally |
| `error: <parse error>` | Keep the page and ask for a fix; then `uv run python -m extract.inbox --reparse --all` |
| `error: gate: <side> slot <n>: <rule>` | Fix in `data/curation/` (`enrichment-guide.md` § 6), then from step 5 |
| A row stuck at `saved` | The file is still in `data/inbox/`: run step 3 |

## Check-ins

`npm run dashboard` (`enrichment-guide.md` § 7) shows it all in your browser: progress per link type and per group, competition, season, era and club; the floors; every link; the import history; what's failing; and the size of each table and of the bucket. Run `npm run status` first, and press **Reload views** after each step.

You can also ask Claude in this repo for any of these.

Whole pool: 238 listing pages, ~2,000 match reports, 5,000–8,000 player pages, ~5,300–8,300 images.
