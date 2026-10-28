# Backend Requests

Schema or contract changes the scraper needs. The backend owns the schema (`data-contract.md` § 12), so each one is a **backend phase first**, deployed to every Neon branch, before the scraper copies `schema.prisma` and the regenerated contract.

| # | Request | Needed by | Asked | Status |
| --- | --- | --- | --- | --- |
| R1 | Transfermarkt ids on clubs, players and matches | S15 | 2026-10-27 | **Done** (2026-10-28) |

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

## Shared spec changes

`project-overview.md` must stay identical in all four repos, so the scraper never edits it alone. These decisions of 2026-10-27 differ from it, and need one change applied to every repo's copy:

| Section | Says now | Decided |
| --- | --- | --- |
| Data Architecture § Ingestion strategy | Ingest metadata for the full range, score it, take lineups for a shortlist | Curated match groups, each kept whole (`match-pool-scope.md`); built as a 3-match pilot, then grown by hand |
| § A Scoring signals, § Sources | Cultural footprint from Wikipedia and Wikidata | Dropped: no Wikipedia signal; scores come from match data |
| § A Rules, Hard Constraint 13 | The memorability threshold decides what enters the pool | The groups decide; scores are calibrated so every group match clears the threshold the backend serves by |
| Data Architecture, images | Prefer generated silhouettes, initials or Wikimedia Commons | The user saves crests and photos by hand; each licence is checked before release |
