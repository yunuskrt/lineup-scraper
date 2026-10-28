# Phase S15b — Loader Apply

## Status

Complete

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
- **A restricted role** `lineup_loader` (decision D2: **deferred**, the owner role stays until the pool grows), created on `ingest` with your approval: `SELECT, INSERT, UPDATE, DELETE` on the 11 content tables (`data-contract.md` § 2) and `SELECT (match_id)` on `game_sessions` (S15a D3); nothing else. Your `.env` then uses that role's connection string. Branches made from `ingest` inherit it
- **E2E** `src/load/load.e2e-spec.ts`, run by `npm run test:e2e` (a separate command; `npm test` stays offline), only against a **disposable** Neon branch (decision D3; `LOAD_TARGET=disposable`, refused otherwise):
  - the pilot dataset loads, and the database holds exactly its counts
  - a rerun changes 0 rows and leaves every `updated_at` as it was
  - one swapped slot rewrites that side's 11 rows only; a removed alias is deleted; a changed score updates one row
  - a match removed from the dataset loses its score row and keeps its match row
  - the database's CHECKs and the backend's play-time rules hold for both sides of every loaded match (`data-contract.md` § 9.2–9.3), read back with SQL
- **Docs:** `CLAUDE.md` § Commands (`--apply`, `test:e2e`), `manual-work.md` row S15b, `enrichment-guide.md` § 2 step 9, `data-contract.md` stays the backend's (no edit)

## Your part

1. **Approve the disposable branch.** Claude creates a branch from `ingest` for the e2e run and deletes it afterwards, asking each time. You copy its connection string from the Neon console (**Branches → <the branch> → Connect**) into `.env` as `DATABASE_URL` with `LOAD_TARGET=disposable` for the run, then set both back. The string never goes into the repo or the chat
2. Nothing loads into `ingest` here. The pilot's load into `ingest` is S20's, with your approval then

## Decisions

Settled at `/feature load`, 2026-10-28 (D1 and D3 as proposed; D2 the alternative):

- **D1. One transaction per competition season** (approved): as `scraper-repo-setup.md` § 8 planned. A season's matches commit together, nothing spans two seasons, and a rerun after a failure finds the finished seasons equal and writes nothing for them. Alternative: one transaction for everything (simpler, but a 2,000-match load times out)
- **D2. The restricted role later** (you chose the alternative). Proposed was to create it now, since `scraper-repo-setup.md` § 9 places it in S15. With it, no bug can touch users, sessions or guesses, whatever the code does. Chosen instead: **keep the owner role until the pool grows**, so S15b creates no role and needs no `GRANT`. The loader still writes only the content tables (the planner's tables, enforced by the code and the e2e). The role is created before the pool grows past the pilot, as its own step
- **D3. E2E on a disposable branch made from `ingest`** (approved): `coding-standards.md` allows database tests only on a disposable branch, never on shared data. A branch from `ingest` has the schema and no rows; it's deleted after the run. Alternative: the backend's rolled-back-transaction pattern on `ingest` itself, which can't test the chunked commits

## Notes

- Scope: executing the plan and the e2e (the role is deferred by D2). The planner, the reader, the preflight and the guards are S15a's and stay as they are
- Depends on: S15a
- Ported by hand from `../lineup-backend/scripts/seed/main.ts` (transaction options, counts-only output) and `test/schema/schema-test-utils.ts` (reading back for checks). Never imported
- Constraints:
  - **Write only the content tables** (`data-contract.md` § 2); never `users`, `auth_*`, `game_*`, `guesses`, `user_stats` or `_prisma_migrations` (§ 3)
  - **Never delete** a competition, season, club, player or match; only aliases, club aliases, a side's lineup, a match's events and a match's score row (§ 4)
  - **Never `production`** without an explicit instruction in the prompt, and then only after a clean dry run (CLAUDE.md)
  - Never `prisma migrate`, `prisma db push` or DDL
  - Ids from the Prisma client; dates written as `new Date('YYYY-MM-DDT00:00:00Z')` (§ 2.7)
  - After a load, the backend's alias guard (`data-contract.md` § 5) can be run from `lineup-backend`
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`, and `npm run test:e2e` on the disposable branch, then the branch deleted

**Deviations recorded during implementation**

- **`src/load/chunks.ts`** (added, pure): splits S15a's plan into D1's transactions (parents; players by 500 with their aliases; one per competition season; retirements), and leaves out empty ones, so a rerun opens no transaction
- **`src/load/apply.ts`** writes by natural unique keys (`slug`, `competitionId_label`, `clubId_alias`, `playerId_normalized`, `matchId_side`, `matchId`); ids are looked up inside each transaction, never generated
- **`vitest.e2e.config.ts`** and `npm run test:e2e` (added): the e2e file is `*.e2e-spec.ts`, outside `npm test`; it refuses any target but `disposable`, before connecting
- The S15a guard's `--apply` refusal is lifted; `production` still needs `--target production --confirm`
- The restricted role is not built (D2); nothing in the code depends on it
- E2E run, 2026-10-28, on `s15b-e2e` (`br-odd-sea-b1img3j1`, from `ingest`, created and deleted with your approval): 7 of 7 passed in 12 s. The pilot loaded to exactly 335 rows; a rerun wrote nothing and moved no `updated_at`; a swapped slot rewrote that side's 11 rows only; a removed alias and a changed score wrote one row each; the retired derby kept its match row; both XIs of both scored matches kept every play-time rule. A read afterwards: no user, session or guess row
- E2E rerun after the review, 2026-10-28, on `s15b-e2e-2` (`br-empty-fog-b1ye0qz1`, created and deleted with your approval): **8 of 8 passed**, adding an alias's raw text updated in place, a club alias swapped, and a match's events replaced (2 deleted, 1 created), with the review's split alias loop in place

## History
