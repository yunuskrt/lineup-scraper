# Phase S03 — Schema Copy & Targets

## Status

Not Started

## Goals

- **`prisma/schema.prisma`**: a verbatim copy of `../lineup-backend/prisma/schema.prisma` (494 lines, unchanged on backend `main` since `f056b66`, the commit `data-contract.md` was generated from). Keep the generator as is: `prisma-client`, `output = "../src/generated/prisma"`, `moduleFormat = "esm"`, `importFileExtension = "js"`. No `prisma/migrations/`
- **`prisma.config.ts`**, ported by hand from the backend's. Keep the `.env` loading, `schema` and `datasource`, and **remove the whole `migrations` block** (path and seed), so `prisma migrate dev` has nothing to apply here
- **Dependencies**, on the backend's versions: `@prisma/client` 7.10.0, `@prisma/adapter-pg` 7.10.0 and `zod` ^4.6.5 as dependencies, plus `prisma` 7.10.0 as a dev dependency
- **npm scripts**:
  - `postinstall` and `db:generate`: `prisma generate`, as in the backend, so a fresh clone typechecks
  - `db:check`: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. Exit 0 means no drift and exit 2 means drift (setup doc, S03 row)
  - No `db:migrate`, `db:deploy`, `db:push` or `db:seed`
- **Generated client kept out of the tooling**: `src/generated/` goes in `.gitignore` (the line S01 left out), `.prettierignore` and oxlint's `ignorePatterns`, since the generated code uses relative imports
- **Env, fail-fast**, ported by hand from `../lineup-backend/src/config/`:
  - `src/config/env.schema.ts`: `DATABASE_URL` (`z.url` with a `postgres(ql)` protocol) and `LOAD_TARGET` (see Open Questions)
  - `src/config/parse-env.ts`: `parseEnv` returning `{ success, data | error }` with `{ key, reason }` issues, and `formatEnvIssues`. Issues name keys, never values
  - `src/config/load-env.ts`: cached `loadEnv()` over `process.env`
  - `.env.example`: both keys, with placeholder values only
- **`src/db/client.ts`**: `createPrismaClient(env)`, ported from `../lineup-backend/scripts/seed/main.ts`. It uses `PrismaPg` with `connectionTimeoutMillis: 10_000`, `log: ['warn', 'error']` and `errorFormat: 'minimal'`. It refuses `LOAD_TARGET=production` unless the caller passes an explicit opt-in. S15 wires that opt-in to `--target production --confirm`
- **Tests**, colocated: `src/config/env.schema.spec.ts` and `src/config/parse-env.spec.ts` (valid env, missing `DATABASE_URL`, a non-Postgres URL, a bad `LOAD_TARGET`, and that no issue echoes a value), plus a spec for the client's production refusal. None of them opens a connection
- **Neon `ingest` branch** (data contract § 10):
  1. Create `ingest` from **`production`** via the Neon MCP, after asking. It starts with no tables and no mock data
  2. **You** deploy the migrations from `lineup-backend`: `DATABASE_URL=<ingest url> npm run db:deploy`. This repo never runs `prisma migrate` (CLAUDE.md), so this is a manual step in the backend repo
  3. `npm run db:check` here, with `.env` pointing at `ingest`, exits 0
  4. Record the branch id under Notes. The backend adds it to its data contract on the next regeneration

## Decisions

1. **`LOAD_TARGET` is `ingest` (the default), `disposable` or `production`.** `dev` is refused, because real data never goes there (setup doc § 11, decision 4). It's a declared label, not checked against the URL. S15 prints it and guards `production`
2. **One `DATABASE_URL` in `.env`**, edited to switch branches. `prisma.config.ts` and the client read the same key. There are no per-target variables

## Out of Scope

- Mirroring the CHECK constraints, `seasonIssue`, `normalizeName` and `positionForSlot`: **S04**. `schema.prisma` doesn't carry CHECKs, and `db:check` doesn't see them
- Any read or write of content rows, the loader, `--dry-run` and the target guard's CLI: **S15**
- The restricted `lineup_loader` role: **S15** (setup doc § 9)
- `db:check-aliases`: a backend script, run after loads
- Editing `context/docs/data-contract.md`. The backend owns it

## Notes

- Scope: the scraper can generate a Prisma client from its schema copy, open a connection to a named Neon branch, and prove that the copy matches the database. Nothing is read or written.
- Depends on: S01 (the TS project). `lineup-backend` already has the migrations; the backend needs no change.
- Constraints:
  - **Never run `prisma migrate` or `prisma db push` from this repo**, and never hand-written DDL (data contract § 1). `db:check` is `migrate diff`, which is read-only
  - **The schema copy is verbatim.** If it ever needs a change, that's a backend phase first (`ai-interaction.md`, Working Across Repos)
  - Backend files are **ported by hand**, never imported or symlinked. The repo must build with `../lineup-backend` deleted, apart from the one manual `db:deploy` step
  - Secrets live only in `.env` (gitignored). No connection string in the repo, the spec, a log or an error message
  - Errors name keys or paths, never values (`coding-standards-scraper.md`, Logs and errors)
  - Every Neon change is a confirmed action. Branch creation asks first, and nothing touches `production` or `dev`
  - Unit tests open no connection
- Verification:
  - Fresh-clone path: `npm install` generates the client into `src/generated/prisma`, and `git status` stays clean
  - `npm test`, `npm run lint`, `npm run typecheck` and `npm run format:check`. `uv run pytest`, `uv run ruff check` and `uv run mypy extract` stay green
  - `diff prisma/schema.prisma ../lineup-backend/prisma/schema.prisma` is empty
  - `npm run db:check` against `ingest` exits 0
  - Drift is caught: add a throwaway field to the schema copy, and `db:check` exits 2. Then revert
  - A missing or malformed `DATABASE_URL` fails fast with the key named and no value printed
- Neon `ingest` branch: id `br-steep-paper-b1z0rlqq`, parent `production`, created 2026-10-25, no tables at creation

**Deviations recorded during implementation**

- No `env.schema.spec.ts`: `parse-env.spec.ts` covers the schema through `parseEnv`, as in the backend

## History
