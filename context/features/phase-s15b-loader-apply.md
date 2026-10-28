# Phase S15b — Loader Apply

## Status

Not Started

## Goals

- **`npm run load -- --apply`** executes S15a's plan, after printing it. It writes only the content tables, in the plan's order: parents first, then each match with everything under it
- **Chunked transactions** (decision D1), so about 2,000 matches never hit one transaction's timeout and an interrupted load resumes on rerun:
  - one transaction for competitions, seasons and clubs with their aliases
  - players and their aliases in chunks of 500 players
  - **one transaction per competition season** for its matches, match teams, lineups (a side rewritten whole: delete its 11 rows, insert 11), events (replaced whole) and scores
  - retirements (S15a D2) last, in one transaction
  - each with the seed's `maxWait` 10 s and a 120 s timeout (`../lineup-backend/scripts/seed/main.ts`)
- **Diff, then write**: every row is looked up by its natural key, only what differs is written, and `updated_at` stays put on what's equal (`data-contract.md` § 1.5). **A rerun writes nothing**
- **Counts after the run**, per table: rows, created, updated, deleted. Never a name, an alias or an XI
- **A restricted role** `lineup_loader` (decision D2), created on `ingest` with your approval: `SELECT, INSERT, UPDATE, DELETE` on the 11 content tables (`data-contract.md` § 2) and `SELECT (match_id)` on `game_sessions` (S15a D3); nothing else. Your `.env` then uses that role's connection string. Branches made from `ingest` inherit it
- **E2E** `src/load/load.e2e-spec.ts`, run by `npm run test:e2e` (a separate command; `npm test` stays offline), only against a **disposable** Neon branch (decision D3; `LOAD_TARGET=disposable`, refused otherwise):
  - the pilot dataset loads, and the database holds exactly its counts
  - a rerun changes 0 rows and leaves every `updated_at` as it was
  - one swapped slot rewrites that side's 11 rows only; a removed alias is deleted; a changed score updates one row
  - a match removed from the dataset loses its score row and keeps its match row
  - the database's CHECKs and the backend's play-time rules hold for both sides of every loaded match (`data-contract.md` § 9.2–9.3), read back with SQL
- **Docs:** `CLAUDE.md` § Commands (`--apply`, `test:e2e`), `manual-work.md` row S15b, `enrichment-guide.md` § 2 step 9, `data-contract.md` stays the backend's (no edit)

## Your part

1. **Approve the role.** Claude creates `lineup_loader` on `ingest` through the Neon MCP and runs the `GRANT`s, after asking. You copy its connection string from the Neon console (**Branches → ingest → Connect**, role `lineup_loader`) into `.env` as `DATABASE_URL`; the string never goes into the repo or the chat
2. **Approve the disposable branch.** Claude creates a branch from `ingest` for the e2e run and deletes it afterwards, asking each time. You put its connection string in `.env` with `LOAD_TARGET=disposable` for the run, then set both back
3. Nothing loads into `ingest` here. The pilot's load into `ingest` is S20's, with your approval then

## Decisions

Proposed; settle each at `/feature load`.

- **D1. One transaction per competition season.** Proposed: as `scraper-repo-setup.md` § 8 planned. A season's matches commit together, nothing spans two seasons, and a rerun after a failure finds the finished seasons equal and writes nothing for them. Alternative: one transaction for everything (simpler, but a 2,000-match load times out)
- **D2. The restricted role now.** Proposed: `scraper-repo-setup.md` § 9 places it in S15. With it, no bug can touch users, sessions or guesses, whatever the code does. Alternative: keep the owner role until the pool grows
- **D3. E2E on a disposable branch made from `ingest`.** Proposed: `coding-standards.md` allows database tests only on a disposable branch, never on shared data. A branch from `ingest` has the schema, no rows and the role; it's deleted after the run. Alternative: the backend's rolled-back-transaction pattern on `ingest` itself, which can't test the chunked commits

## Notes

- Scope: executing the plan, the role, the e2e. The planner, the reader, the preflight and the guards are S15a's and stay as they are
- Depends on: S15a
- Ported by hand from `../lineup-backend/scripts/seed/main.ts` (transaction options, counts-only output) and `test/schema/schema-test-utils.ts` (reading back for checks). Never imported
- Constraints:
  - **Write only the content tables** (`data-contract.md` § 2); never `users`, `auth_*`, `game_*`, `guesses`, `user_stats` or `_prisma_migrations` (§ 3)
  - **Never delete** a competition, season, club, player or match; only aliases, club aliases, a side's lineup, a match's events and a match's score row (§ 4)
  - **Never `production`** without an explicit instruction in the prompt, and then only after a clean dry run (CLAUDE.md)
  - Never `prisma migrate`, `prisma db push` or DDL. The role's `CREATE ROLE` and `GRANT`s are run once, with your approval, through the Neon MCP, never from the repo's code
  - Ids from the Prisma client; dates written as `new Date('YYYY-MM-DDT00:00:00Z')` (§ 2.7)
  - After a load, the backend's alias guard (`data-contract.md` § 5) can be run from `lineup-backend`
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`, and `npm run test:e2e` on the disposable branch, then the branch deleted

## History
