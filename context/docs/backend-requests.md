# Backend Requests

Schema or contract changes the scraper needs. The backend owns the schema (`data-contract.md` § 12), so each one is a **backend phase first**, deployed to every Neon branch, before the scraper copies `schema.prisma` and the regenerated contract.

| # | Request | Needed by | Asked | Status |
| --- | --- | --- | --- | --- |
| R1 | Transfermarkt ids on clubs, players and matches | S15 | 2026-10-27 | Open |

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
