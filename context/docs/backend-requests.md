# Backend Requests

Schema or contract changes the scraper needs. The backend owns the schema (`data-contract.md` § 12), so each one is a **backend phase first**, deployed to every Neon branch, before the scraper copies `schema.prisma` and the regenerated contract.

| # | Request | Needed by | Asked | Status |
| --- | --- | --- | --- | --- |
| R1 | Transfermarkt ids on clubs, players and matches | S15 | 2026-10-27 | **Done** (2026-10-28) |
| R2 | Image URLs: bucket keys become `crestUrl` and `imageUrl` (backend B23) | S20 | 2026-10-28 | Pending |

---

## R1. Transfermarkt ids

**Why:** the user wants every club, player and match row to carry the id of the page it came from, so a row can be traced to its source and checked against it. Decided 2026-10-27.

**Change:**

| Table | Column | Type | Null | Constraint |
| --- | --- | --- | --- | --- |
| `clubs` | `transfermarkt_id` | `TEXT` | yes | `UNIQUE`; `CHECK (transfermarkt_id ~ '^[0-9]+$')` |
| `players` | `transfermarkt_id` | `TEXT` | yes | Same |
| `matches` | `transfermarkt_id` | `TEXT` | yes | Same |

- **Nullable:** the mock seed rows have none, and a later source may not either. Postgres allows many `NULL`s under `UNIQUE`.
- **Text, not integer:** the raw records keep ids as digit strings (`src/raw/envelope.ts`).
- **Not the loader's key.** Slugs stay the natural key (`data-contract.md` § 1.4). The new column is a second unique key the loader writes and checks.
- **Never sent to a client.** No REST or socket payload changes, so web and mobile have nothing to do.
- **Before release:** Transfermarkt must be licensed or replaced. Replacing it leaves these columns as history; dropping them is a later backend migration.

**Then, in the scraper:** copy `schema.prisma` and `data-contract.md`, add the column to the dataset schema (S14) and the loader (S15), and `npm run db:check` must pass.

- **Dataset side done** (S14, 2026-10-28): `transfermarktId` is in `src/dataset/schema.ts` and `data/dataset/`, nullable and unique per list.
- **Built** (2026-10-28): backend `2482cd6`, migration `20261028105720_transfermarkt_ids`, deployed to `dev` and `ingest` (`production` gets it with B45). The scraper copied `schema.prisma` and `data-contract.md`; `npm run db:check` against `ingest` reports no drift. S15 writes the columns.

---

## R2. Image URLs

**Why:** S17 puts images in Neon Object Storage and S18 writes their keys into `clubs.crest_key` and `players.image_key`. The backend sends `null` for both today (`src/matches/match-refs.ts`: "URLs arrive with B23"), so the pilot shows no image until it turns keys into URLs. Decided 2026-10-28.

**Storage, as built in S17:**

- Neon Object Storage, which branches with the database: each branch has its own objects, beside the rows that point at them
- Bucket `images`, access `public_read`: anyone can read an object, only a credential can write
- An object's URL is `<endpoint>/<bucket>/<key>`, path-style. On `ingest`: `https://br-steep-paper-b1z0rlqq.storage.c-5.eu-central-1.aws.neon.tech/images/<key>`
- Keys: `crests/<club-slug>/<sha256-12>.<ext>` and `players/<player-slug>/<sha256-12>.<ext>`, with `ext` one of `webp`, `png`, `svg`. A key's bytes never change; objects carry `Cache-Control: public, max-age=31536000, immutable` and their real `Content-Type`

**Change (no migration):**

- An `ASSET_BASE_URL` env var, validated at boot: `<endpoint>/<bucket>`, one per environment (`ingest`'s above for development against real data; `production`'s once it has a bucket). Optional: unset, every image stays `null`
- `crest_key` → `ClubRef.crestUrl` and `image_key` → `RevealedPlayer.imageUrl` as `${ASSET_BASE_URL}/${key}`, wherever they're sent (`match-refs.ts`, `squad-loader.service.ts`, the history and profile views). `null` stays `null`
- The backend never proxies or fetches an image; clients load the URL straight from the bucket (spec § Data Architecture). Images are shown with `<img>`, so no CORS rule is needed

**Then:** web tightens `imageUrlSchema` to absolute URLs (`scraper-repo-setup.md` § 10). Nothing in the scraper changes: it writes keys, never URLs.

---

## Shared spec changes

`project-overview.md` must stay identical in all four repos, so the scraper never edits it alone. These decisions of 2026-10-27 differ from it, and need one change applied to every repo's copy:

| Section | Says now | Decided |
| --- | --- | --- |
| Data Architecture § Ingestion strategy | Ingest metadata for the full range, score it, take lineups for a shortlist | Curated match groups, each kept whole (`match-pool-scope.md`); built as a 3-match pilot, then grown by hand |
| § A Scoring signals, § Sources | Cultural footprint from Wikipedia and Wikidata | Dropped: no Wikipedia signal; scores come from match data |
| § A Rules, Hard Constraint 13 | The memorability threshold decides what enters the pool | The groups decide; scores are calibrated so every group match clears the threshold the backend serves by |
| Data Architecture, images | Prefer generated silhouettes, initials or Wikimedia Commons | The user saves crests and photos by hand; each licence is checked before release |
| Tech Stack, Object storage | "A bucket with a free tier (Cloudflare R2, Supabase Storage or Backblaze B2 — decided later)" | Neon Object Storage, in the same project: bucket `images`, `public_read`, branched with the database (S17, 2026-10-28) |
