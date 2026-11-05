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

Columns: `#,Link,Save as,Folder,Status`; `general.csv` adds `Type` after `#`: Fixture, Logo, Match Report, Player, Crest or PlayerPhoto. Logo rows (S18c) follow the listings, one per pool competition, and go to `images.csv`.

Each link appears once. A player or club already listed under an earlier match isn't listed again.

## Statuses

| Link | Ladder |
| --- | --- |
| Listing page | `to save` → `saved` → `parsed` |
| Match report, player page | `to save` → `saved` → `parsed` → `validated` → `ingested` |
| Crest, photo | `to save` → `saved` → `uploaded` → `ingested` |

`error: <reason>` replaces the status when something is wrong.

## Save and import (repeat)

1. Pick links whose status is `to save` in `general.csv`, in any order and any mix of types. `uv run python -m extract.links open general --count 10` (or **Open next links**, up to 50) opens the next ones in the file's order
2. Save each into `data/inbox/` under its `Save as` name:
   - a page: ⌘S, **Webpage, HTML Only** (the importer reads the page's own URL, so a wrong name does no harm)
   - an image: ⌘S on the image itself. **Keep its name**: the importer reads the id from it
3. `uv run python -m extract.inbox && npm run status` (or **Import**, which runs both):
   - `extract.inbox` imports and parses every file, whatever its type. A file already stored prints `already saved, skipping`
   - `npm run status` updates the 5 CSVs. **New rows appear only here**, so run it after every import:
     - crests and player pages, right under a match, once its report is parsed
     - a photo, right under its player, once the player page is parsed
     - a crest or player already listed under an earlier match isn't listed again

All 238 listing pages are parsed, so every row left is a match report, a crest, a player page or a photo. The order is free: each link is listed once, keyed on its id, and saving one twice costs nothing. **A match loads only once all 22 of its starters' pages are saved**, so saving many match reports first grows the progress fast but loads nothing new for a while; finish a few blocks now and then to see matches reach `ingest` sooner. The total work is the same.

## Build and ingest (whenever you like)

**From the dashboard** (`npm run dashboard`): press **Run batch** (import, status, build, upload images, dry run), read the counts and `data/reports/gate.md`, then **Load into `ingest`** (load, verify, status) and commit `data/dataset/` and `data/curation/`. The same steps by hand:

4. `npm run build`, then read `data/reports/gate.md`, `images.md` and `images.html`
5. `npm run images -- --upload` (`already uploaded, skipping` for the rest)
6. `git add data/dataset data/curation && git commit`: the build also adds the new matches', clubs' and players' permanent slugs to `data/curation/crosswalk/`
7. `npm run load`: the dry run, counts only. Then `npm run load -- --apply` (`already ingested, skipping` for the rest)
8. `npm run verify`
9. `npm run status`

## When to run `npm run status`

After every import, build, upload and load. It only reads, so it's safe any time.

## Errors

| Status | Do |
| --- | --- |
| `error: challenge page` | Save the page again once the site loads normally |
| `error: <parse error>` | Keep the page (it waits in `data/inbox/refused/`) and ask for a fix; then `uv run python -m extract.inbox --retry` |
| `refused …: list layout: no formation` | Nothing: the report has no formation, so `npm run status` leaves the match out of the pool and its row disappears |
| `error: gate: <side> slot <n>: <rule>` | Fix in `data/curation/` (`enrichment-guide.md` § 6), then from step 4 |
| A row stuck at `saved` | The file is still in `data/inbox/`: run step 3 |

A refused file moves to `data/inbox/refused/`, so the next import doesn't repeat it: it prints one line, `refused earlier, waiting in data/inbox/refused/: N`. `--retry` puts them through again; a file you save again under the same name replaces its refused copy.

## Check-ins

`npm run dashboard` (`enrichment-guide.md` § 7) shows it all in your browser: progress per link type and per group, competition, season, era and club; the floors; every link; the import history; what's failing; and the size of each table and of the bucket. Run `npm run status` first, and press **Reload views** after each step.

You can also ask Claude in this repo for any of these.

Whole pool: 238 listing pages, ~2,000 match reports, 5,000–8,000 player pages, ~5,300–8,300 images.
