# Lineup — Scraper

Know the XI. Beat the Clock.

## Architecture

Four separate repositories, one backend:

| Repo             | Stack               | Role                                                  | Runs on           |
| ---------------- | ------------------- | ----------------------------------------------------- | ----------------- |
| `lineup-backend` | NestJS              | REST, auth, Socket.IO, rules engine, schema owner     | Railway / Fly.io  |
| `lineup-web`     | Next.js             | Browser client — renders and transmits input          | Vercel            |
| `lineup-mobile`  | Expo React Native   | iOS + Android client — renders and transmits input    | EAS → both stores |
| `lineup-scraper` | Python + TypeScript | Offline ETL: extract, transform, load data and images | A laptop, by hand |

**This repo.** It produces the match pool: it extracts real matches and XIs, resolves them, scores them, gates them and loads them into Postgres and the bucket. It is never deployed and serves no traffic.

**No code is shared between repos.** No package, no submodule, no cross-repo import. This repo keeps its own copy of the database schema; **the backend owns it**. This repo must build with the other three deleted.

## Context Files

- @context/project-overview.md
- @context/coding-standards.md
- @context/coding-standards-scraper.md
- @context/ai-interaction.md
- @context/current-feature.md
- @context/docs/data-contract.md

`project-overview.md` is the shared spec and must stay identical in all four repos.

@context/todo.md is for developer-side use. **Do not modify the project context based on this file.**

## Commands

- **Install**: `npm install` and `uv sync`
- **Test**: `npm test` and `uv run pytest`
- **Lint**: `npm run lint` and `uv run ruff check` and `uv run mypy extract`
- **Extract**: `uv run scrapy crawl <spider> -a <arg>=<value>` (S06 fixes the exact form)
- **Transform and load**: `npm run <stage>` (each phase names its stage)
- **Schema**: `npm run db:generate`, `npm run db:check` (fails if `schema.prisma` drifted from the database)
- **There is no migrate command.** Schema changes are backend phases.

**IMPORTANT:**

- **Do not add 'co-authored by Claude'** to any commit message
- History entries in `current-feature.md` must not exceed 75 characters
- Do not edit `todo.md` unless told to via prompt or skill
- When a phase completes, ask to tick it in `todo.md` in the same commit
- Never run `prisma migrate` or `prisma db push`. Never write a non-content table
- Never load into the `production` branch without an explicit instruction in the prompt
- No LLM is a source for a lineup, score, date, player name or alias
- Python never writes to Postgres or the bucket; TypeScript never fetches a source
- Until release, `robots.txt` and terms don't block a source; never bypass a technical block, the throttle or the cache (`coding-standards-scraper.md` § Sources)
