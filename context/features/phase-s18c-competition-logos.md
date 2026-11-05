# Phase S18c — Competition Logos

## Status

Complete

## Goals

- **A logo link list** `s18c-logos` (`extract/lists/logos.py`, `uv run python -m extract.lists.logos`): one row per pool competition (11 today), from `data/curation/crosswalk/competitions.json`
  - the link is the best Transfermarkt logo found in the saved fixture lists (`data/pages/transfermarkt/fixture/`): the square `logo/homepageWappen150x150/<code>.png` first, else `logo/header/<code>.png`
  - when a saved page shows neither, the link you found by hand, from `data/curation/logos.json` (`{ "links": { "<slug>": "<image URL>" } }`, seeded with the 3 in Data); a curated link wins over a page's, so a better logo can replace one; with neither, the row says "no link" and the competition's fixture page
  - save-as name `logo-<competition-slug>.<ext>`, folder `data/inbox/`
- **The inbox files logos** (`extract/images.py`, `extract/inbox.py`): a file named `logo-<slug>.<png|jpg|webp|svg>` whose slug is in the competition crosswalk is filed as `data/images/logos/<slug>.<ext>` (not under `transfermarkt/`: a logo may come from another source, D1). New bytes for a filed slug replace it, as for crests. An unknown slug is refused into `data/inbox/refused/` with the list of valid names. The import log records it as kind `logo`
- **`npm run images` makes logos** (`src/images/`): for every dataset competition with a filed logo, a **128×128 WebP** (D3), never cropped (`fit: contain`, transparent background, as crests), with `data/curation/images.json` `logoStyles` applied (D2)
  - key `competitions/<competition-slug>/<sha256-12>.webp` through S17's `imageKey`, with a new kind `competition` → prefix `competitions` (`src/storage/keys.ts`)
  - `keys.json` gains `logos: [{ key, slug, transfermarktCode }]`; `images.md` lists competitions with no logo, sources under **40 px** (the web's floor, § 1), and **low-contrast logos** (D2)
  - the contact sheet `images.html` shows each logo as the filter chip draws it: 20 px and 40 px, on `#0A0F0C` (chip at rest) and `#1A241E` (pressed)
- **`npm run images -- --upload`** uploads logos with S17's `uploadImage`, metadata `slug` and `transfermarkt-code` (D4); same guard, never deletes
- **The dataset carries `logoKey`** (`src/dataset/`): `competitions.json` gains `logoKey` (`null` when none). The schema refuses a key that doesn't start `competitions/<slug>/` or that isn't `.webp`, `.png` or `.svg`; the manifest counts `logos`
- **The loader writes `logo_key`** (`src/load/`): through its normal diff of `competitions`, so a rerun writes nothing; the bucket check before any write covers the `competitions/` prefix
- **`npm run verify`** checks every stored `logo_key` is in the bucket and counts logos against the manifest; **`npm run storage`** prints the `competitions` object count
- **The tracker and the dashboard** count logos: `npm run status` adds a `Logo` type to `general.csv` (right after the listings) and to `images.csv`; the dashboard's progress shows it like the other link types
- **Docs:** `CLAUDE.md` § Commands (the logo list, `logos` in `images` and `verify`), `enrichment-guide.md`, `manual-work.md` row S18c, `transfermarkt-source.md` (the logo URLs)

## Your part

1. **At `/feature load`:** settle D1–D4 below
2. **Save the 11 logos** once the list exists (`uv run python -m extract.links show s18c-logos`, or `open`): each into `data/inbox/` under its "Save as" name (`logo-premier-league.png`). Every link is the image itself: 8 from the saved pages, 3 you found on the competition pages (2026-11-05). How to save: `context/docs/manual-work.md` § How to save a page. Then `uv run python -m extract.inbox`. About 10 minutes
3. **Check the logos** in `data/reports/images.html` after `npm run build`: each must read on the dark chip at 20 px. Name any that should be made white (D2), or replace its source with a light or one-colour version saved under the same name
4. **Approve a disposable branch** for the e2e run, as in S18b (Claude creates it from `ingest` and deletes it afterwards, asking each time)
5. **Approve the upload and the load into `ingest`**: 11 objects, then `competitions: 11 update` in the dry run, then the load (dashboard **Run batch**, then **Load into ingest**)

## Decisions

**Settled at `/feature load`, 2026-11-05: D1–D4 as proposed.**

- **D1. Source: Transfermarkt's logos, any source allowed.** The list links Transfermarkt's square `homepageWappen150x150` logo (150×150) where a saved page shows it, else the page `header` logo. The pipeline doesn't care where a file came from: a light version from elsewhere, saved under the same name, simply replaces it. Logos are trademarks, like crests: development only, checked before release. Alternative: Wikimedia Commons SVGs, which are often the full logo with a wordmark
- **D2. Logos must read on the dark chip** (`data-display-requirements.md` § 1: "many competition logos are dark … use a light or one-colour version"):
  - `npm run images` measures each logo's contrast against `#0A0F0C` (the mean luminance of its visible pixels) and lists the low ones in `images.md`
  - `data/curation/images.json` gains `logoStyles: { "<slug>": "white" }`: the logo is turned into a one-colour white version (its shape kept, every visible pixel white). A manual decision, so it lives in curation, never in code
  - Alternative: no automatic style; you replace a dark logo's source by hand
- **D3. Always a 128×128 WebP**, as crests: the whole logo fitted in the square, transparent background, SVG sources rasterised. One format and one path for all images, byte-identical on a rerun. The web recommends SVG or a square 128×128 transparent PNG or WebP. Alternative: keep an SVG source as an `.svg` key (sharper, but a second path, and SVG bytes aren't normalised)
- **D4. Keyed on the competition slug.** Competitions have no `transfermarkt_id` column, so the filed file, the key's folder and the object's `slug` metadata all use the slug; the object also carries `transfermarkt-code` (`GB1`) from the crosswalk, so it leads back to Transfermarkt. Alternative: file by Transfermarkt code (`gb1.png`), as the browser names it

## Data

The 11 pool competitions and the logos the saved fixture lists show (checked 2026-11-05 on `data/pages/transfermarkt/fixture/`):

| Slug | Code | Kind | `homepageWappen150x150` | `header` |
| --- | --- | --- | --- | --- |
| `premier-league` | GB1 | league | yes | yes |
| `laliga` | ES1 | league | yes | yes |
| `serie-a` | IT1 | league | yes | yes |
| `bundesliga` | L1 | league | yes | yes |
| `ligue-1` | FR1 | league | yes | yes |
| `liga-portugal` | PO1 | league | — | yes |
| `super-lig` | TR1 | league | — | yes |
| `champions-league` | CL | ucl | yes | — |
| `uefa-cup-europa-league` | EL | uel | — | — |
| `euro` | EURO | euro | — | — |
| `world-cup` | FIWC | world_cup | — | — |

The image URLs are `https://img.a.transfermarkt.technology/logo/<variant>/<code lowercase>.png`. The cup and tournament fixture lists show no header logo. You found these 3 on the competition pages (2026-11-05); they seed `data/curation/logos.json`:

| Slug | Link | Note |
| --- | --- | --- |
| `uefa-cup-europa-league` | https://img.a.transfermarkt.technology/logo/medium/el.png?lm=1789377130 | `medium` variant |
| `euro` | https://img.a.transfermarkt.technology/logo/medium/euro_1763046126.png?lm=1789378702 | `medium`; the file name carries a version suffix |
| `world-cup` | https://img.a.transfermarkt.technology/logo/medium/fiwc_1767770821.png?lm=1789378702 | `medium`; the file name carries a version suffix |

No URL is guessed: the list holds only URLs seen in saved pages or curated by you. The three variants differ in size and shape (`homepageWappen150x150` is square; `header` and `medium` may not be), which D3 absorbs: every logo is fitted whole into the 128×128 square, never cropped or stretched. The browser's own names (`el.png`, `euro_1763046126.png`) aren't recognised: save under the list's name.

## Notes

- Scope: logos for the pool's competitions only (11), end to end: list, filing, processing, upload, dataset, load, verify, tracker. Club crests and player photos don't change
- Depends on: S18a and S18b (lists, filing, processing, upload), S17 (keys, client, guard), S14, S15 and S20 (dataset, loader, verify), the collection tracker and S19 (status, dashboard)
- Backend: `competitions.logo_key` (R3b, backend `a266849`, migration `20261105075429_competition_logo_key`), on `dev` and `ingest`. The backend sends `<ASSET_BASE_URL>/<logo_key>` as `logoUrl`; until a logo loads, the web shows the competition kind's icon
- Done before this spec, on this branch: `prisma/schema.prisma` copied from the backend, `context/docs/data-contract.md` replaced by the backend's `scraper-data-contract.md`, the Prisma client regenerated, `npm run db:check` passes, and `npm run dataset` rewrote the manifest's schema hash (the dry run then shows 0 changes)
- Constraints:
  - `logo_key` is a bucket key, never a URL, no leading `/`, `competitions/<slug>/<sha256-12>.<ext>`, `ext` one of `webp`, `png`, `svg` (`data-contract.md` § 2.1)
  - **Upload before the key is written**; never delete an object; a key's bytes never change (clients cache by URL, § 2.12)
  - Never fetch Transfermarkt with code: the user saves every logo. TypeScript reads only filed files
  - Only the pool is loaded: a logo is processed only for a dataset competition
  - Output is deterministic: sorted, 2-space JSON, byte-identical on a rerun
  - Logs print counts and paths, never a credential; never `production` without an explicit instruction
- Verification: `npm test` (filing names, the list, contain-fit and the white style on small fixture images, the contrast measure, keys, dataset fields, the bucket check with the in-memory store), `uv run pytest`, `npm run lint`, `npm run typecheck`; `npm run test:e2e` on a disposable branch (11 logos upload, the load writes `logo_key`, a rerun uploads and writes nothing); then the real run on `ingest`: dry run `competitions: 11 update`, load, a rerun with 0 changes, `npm run verify` passing

**Deviations recorded during implementation**

- **No-link competitions are printed, not listed:** `extract.lists.logos` names each one with its fixture page to look on; a list row must be a link to save. Today all 11 have a link
- **A curated link must be a Transfermarkt logo URL of that competition** (`logo/<variant>/<code>[_<n>].<ext>`): the tracker and `open general` rebuild every row from its URL, so the URL must name its competition. A file from any other source is still accepted by its name (D1)
- **A logo URL's code maps to the slug through `data/curation/crosswalk/competitions.json`** (`extract/images.py` `logo_slugs`); a code outside the pool is not a logo link
- **Your check of the logos (step 3, 2026-11-05):** all 11 load in their own colours, no `logoStyles` for now (5 measure below 3:1: `champions-league` 1.0, `ligue-1` 1.3, `premier-league` 1.3, `super-lig` 1.8, `uefa-cup-europa-league` 1.9). The 4 weaker sources load as they are: `serie-a` and `liga-portugal` on a white square, `euro` the Euro 2028 logo, `world-cup` the FIFA wordmark. A better file saved under the same name, or a `logoStyles` entry, replaces any of them later
- **Logo sources:** 6 are Transfermarkt's 150×150 squares (PNG), `liga-portugal` and `super-lig` the 139×181 headers, the 3 curated ones 58×76 `medium`; Transfermarkt served 5 as WebP, filed with their real extension
- **The e2e suites cut the pilot from the full dataset** (`src/load/e2e-pilot.ts`: `pilotOf`, `pilotKeys`): since the pool was loaded, `data/dataset/` holds 1,925 matches, so both suites, pinned to S20's 3 matches, would have loaded and uploaded all of it. The pilot's counts are today's: 66 players and 166 aliases (S20: 65 and 164, before later pages and curation), and 75 images (6 crests, 66 photos, 3 logos)
- **The e2e branch starts from a copy of `ingest`, emptied:** with your approval, `s18c-e2e`'s content tables were truncated (CASCADE, which also emptied its copy of your test games). Its bucket still shows `ingest`'s crests and photos: a child branch can't delete inherited objects (0 deleted). So the images e2e counts what is absent at the start, which must include the 3 pilot logos, instead of assuming an empty bucket
- **E2E, 2026-11-05,** on `s18c-e2e` (`br-raspy-bar-b1tst8tl`, from `ingest`, emptied with your approval): **18 of 18 passed** (images 6, loader 8, storage 4). The 3 pilot logos uploaded under `competitions/` and nothing on a rerun; `champions-league`'s object carries `slug` and `transfermarkt-code: CL`; the loader wrote each pilot competition's `logo_key` and a rerun wrote nothing. `ingest` was checked unchanged afterwards (1,925 matches, 36 game sessions, no logo yet). The branch was then deleted with your approval; only `production`, `dev` and `ingest` remain
- **Real run on `ingest`, 2026-11-05** (your approvals): `npm run images -- --upload` uploaded 11 (3,720 already there); the dry run showed `competitions: 11 update` and nothing else; the load wrote 11 rows; a rerun showed 0 changes; `npm run verify` passed with `logos 11` and 3,731 keys in the bucket; `npm run status` shows all 3,731 images ingested. A logo's public URL answers `200 image/webp`
- **Review fixes (`/feature review`):** the page scan also reads versioned logo names (`euro_1763046126.png`), as the URL classifier does (one test added); every new comment within 50 characters; a broken competition crosswalk is reported by name, never quoted; `CLAUDE.md` and `collection-runbook.md` list the `Logo` type. A rebuild gave a byte-identical `keys.json` and a dry run with 0 changes
- **`/feature test`:** 9 cases added where the logo logic had none: the dataset build's `logoKey` fill and `logos` count, the loader row's `logoKey`, logos in the bucket check, a `keys.json` from before logos, a bad `transfermarktCode`, a `logo` line in the dashboard's history, and the list command end to end (7 links from a saved page and a curated link, 4 named with no link). 789 TypeScript and 355 Python tests pass, lint and typecheck clean

## History
