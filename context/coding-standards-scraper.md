# Coding Standards — Scraper (Python + TypeScript)

For `lineup-scraper`. Read alongside `coding-standards.md`, which always applies. Where this file differs, it wins for this repo.

## Layout

- `extract/` is the Python package (import name `extract`): Scrapy spiders, parsers and the record writer. It runs from the repo root via `pyproject.toml` and `scrapy.cfg`.
- `src/` is TypeScript: one folder per stage (`raw`, `resolve`, `aliases`, `score`, `gate`, `dataset`, `load`, `storage`, `qa`), plus `db/`, `config/` and `names/`.
- `schemas/raw/` holds the JSON Schema files generated from `src/raw/`. They are the only interface between the two languages. Never edit them by hand.
- `prisma/schema.prisma` is a copy of the backend's. There is no `prisma/migrations/`.
- `data/` is described in `docs/data-contract.md`: what is committed and what is not.

## The two languages

- **Python:** fetch, cache and parse. No database, no bucket, no name normalisation.
- **TypeScript:** everything after the raw records. No outbound request except Postgres and the bucket.
- **Parsers are pure:** HTML or JSON in, records out. They are tested on saved pages in `extract/tests/fixtures/`, never against the live site.
- **Spiders stay thin:** they choose URLs and pass responses to a parser.
- **Stages are pure:** files in, files out. Scoring, the gate and alias building are pure functions with unit tests and no mocks, like the backend's `src/game/`.

## Sources (development phase)

The app is unreleased, and the real data is for development only.

- A source's `robots.txt` and terms of use don't block collection. `ROBOTSTXT_OBEY` is off. S02 still records both for every source.
- Never bypass a technical block: no CAPTCHA solving, login or paywall workarounds, proxy or IP rotation. A block stops that source.
- Stay gentle: one request at a time per domain, AutoThrottle, retries with backoff, an honest `USER_AGENT`, and the HTTP cache, so each page is fetched once.
- **The Playwright MCP is for looking, never for collecting.** Use it to read a source's pages, check whether they need JavaScript, find the JSON requests behind them and study the DOM for a parser. Records come only from spiders and parsers; a site that needs JavaScript uses `scrapy-playwright`.
- Parser fixtures are saved from the spider's response, not from the browser's rendered page. **Transfermarkt is the exception:** its fixtures are pages the user saved by hand as HTML only (`docs/manual-work.md`), because no code fetches it.
- The dataset stays in this private repo.
- **Before the app is marketed**, every source is licensed or replaced. The S02 report lists which ones need it.
- **Transfermarkt** (the source since 2026-10-26, `docs/transfermarkt-source.md`):
  - **Pages are saved by the user, never fetched by code.** It challenges automated requests (AWS WAF). No spider, script, browser UA or Playwright session collects it; `extract.inbox` parses what the user saved (`docs/transfermarkt-source.md` § 8).
  - The English site only.
  - Take match dates only from the page's `datum/YYYY-MM-DD` link, never from the date text.
  - Key every entity on its numeric id; never filter or join on a team or player name.
  - Port from the old repo by reading it; never run or import its code. Don't port the reference's § 12 bugs (`docs/transfermarkt-source.md` § 6).

## Python

- Python 3.13 via uv. `uv.lock` is committed.
- Type hints everywhere. `mypy --strict` passes. No `Any`.
- Ruff for lint and format.
- Absolute imports from the package root (`from extract.parsers.match import parse_match`). This is the Python form of the `@/` rule.
- PEP 8 naming: `snake_case` functions and modules, `PascalCase` classes, `SCREAMING_SNAKE_CASE` constants.
- Tests: pytest, `extract/tests/test_*.py`.
- Every record is validated against `schemas/raw/` before it's written. An invalid record fails the run.

## TypeScript

- Same as the backend: Node 22, ESM, strict, Zod 4, Vitest, oxlint, Prettier, `@/` imports. Tests are `*.spec.ts` beside the code.
- Every file read from disk is parsed with Zod. Types come from `z.infer`.

## Data rules

- **Raw text stays raw.** Source strings are stored as fetched, apart from NFC normalisation.
- **Slugs are permanent.** Once `data/curation/crosswalk/` gives an entity a slug, it never changes. The loader keys on slugs; a new slug is a new row.
- **Manual decisions live in `data/curation/`** (merges, splits, display names, extra aliases, excluded matches), never in code.
- **Only the pool is loaded.** The dataset, the database and the bucket get only matches in the pool, plus their clubs and players (`docs/match-pool-scope.md`).
- **Output is deterministic:** sorted by slug, stable key order, 2-space JSON, trailing newline. A rerun with no new input gives a byte-identical dataset.
- **Timestamps** come from the source or the run's start, never from the middle of a loop.

## Database

- Prisma 7 with `@prisma/adapter-pg`, as in the backend.
- Write only the content tables listed in `docs/data-contract.md`.
- Diff, then write: create what's missing, update what differs, never touch what's equal. A rerun writes nothing.
- Never delete a competition, season, club, player or match. Game history points at them with `Restrict`.
- `npm run db:check` runs before every load.

## Logs and errors

- The loader and anything that can run against a shared branch prints counts and paths, never an XI or an alias list.
- Validation errors name a path, never a value, as the backend seed does.
- QA reports name entities, and they stay local, under `data/reports/` (gitignored).

## Comments

- Same rule as everywhere: rare, one line, at most 50 characters. `#` in Python, `//` in TypeScript.
