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

**Goal (decided 2026-10-27).** Not to collect the whole pool. The repo delivers the link lists, the pipeline, a local dashboard and the method (`context/docs/enrichment-guide.md`), proven end to end on a 3-match pilot. The user then saves pages and grows the database in their own time: 100 matches next, then the rest.

**Data source.** Transfermarkt (English site), decided 2026-10-26; Mackolik is superseded. Facts, verified selectors and pitfalls: `context/docs/transfermarkt-source.md`. The old Transfermarkt scraper is described in `context/docs/legacy_transfermarkt_scraper_reference.md`. `project-overview.md` § Sources names it primary (backend `95d7fce`, 2026-10-26). **Transfermarkt pages are saved by the user in their own browser**, because the site challenges automated requests; code only parses them (`transfermarkt-source.md` § 8).

**Manual work.** Some phases need the user: saving pages and images, approving loads. The full list is `context/docs/manual-work.md`; a phase's `todo.md` line ends in a 👤 note, and its spec has a `## Your part` section.

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
- **Extract, automated sources**: `uv run python -m extract.crawl <spider> -a <arg>=<value>`. It exits 1 if the spider was blocked or a record was invalid; plain `scrapy crawl` exits 0 even then
- **Import hand-saved pages**: `uv run python -m extract.inbox` (S06b). It reads `data/inbox/`, parses, files pages under `data/pages/` and logs each file to `data/work/import-log.ndjson`. After a parser change, `--reparse` rebuilds the raw records from `data/pages/` (S11)
- **Link lists and progress** (S06c): `uv run python -m extract.links show|open|new <list>`, `uv run python -m extract.progress`, `uv run python -m extract.check <link | kind:key>`
- **Listing link lists** (S07a): `uv run python -m extract.lists.listings` writes `s07-listings`, `s07-verify` and `s07-pilot` from `data/curation/pool.json`
- **Pool match list** (S07b): `npm run pool` writes `data/work/pool/matches.json` and `data/reports/pool.md` from the saved fixture lists
- **Resolve** (S08a, S08b): `npm run resolve` assigns permanent slugs to competitions, clubs, matches and players (`data/curation/crosswalk/`) and writes `data/work/resolved/`; run `npm run pool` first
- **Match-report link lists** (S11): `uv run python -m extract.lists.match_reports` writes `s11-match-reports` (every pool match) and `s11-pilot` from `data/work/pool/matches.json`
- **Player link lists** (S11b): `uv run python -m extract.lists.player_pages` writes `s11b-players` (every starter of every saved pool match report, each once) and `s11b-pilot`
- **Image link lists** (S18a): `uv run python -m extract.lists.images` writes `s18-images` (the crest of every club in a saved pool match report, the photo of every starter with a saved profile, each once) and `s18-pilot`, links straight to the images. `extract.inbox` files saved images by id under `data/images/` (gitignored)
- **Lineups** (S11): `npm run lineups` reads the saved match reports of resolved matches into formations, slots, scores and events (`data/work/lineups/matches.json`, `data/reports/lineups.md`); run `npm run resolve` first
- **Aliases** (S12): `npm run aliases` builds each player's aliases from the saved pages and `data/curation/aliases.json` (`data/work/aliases/players.json`, `data/reports/aliases.md`); run `npm run lineups` first
- **Scores** (S10): `npm run scores` scores every match with a saved report from its stage, rivalry, drama and star power, normalised within each era bucket, so every pool match clears its threshold (`data/work/scores/matches.json`, `data/reports/scores.md`); run `npm run lineups` first
- **Gate** (S13): `npm run gate` checks both XIs of every scored match against the backend's play-time rules and writes each side's `guessability` beside `starPower` (`data/work/gate/matches.json`, `data/reports/gate.md`); run `npm run aliases` and `npm run scores` first
- **Images** (S18b): `npm run images` turns each saved crest and photo of the dataset's clubs and players into a 128×128 WebP (crests never cropped; photos cut to a centred square, `data/curation/images.json` per-player crops; `images.md` lists photos that aren't Transfermarkt's 139×181, the ones to check by eye), keys it `crests/<slug>/…` or `players/<slug>/…` and writes `data/work/images/` (with `keys.json`), `data/reports/images.md` and the contact sheet `data/reports/images.html`; run `npm run gate` first and `npm run dataset` after. `-- --upload` uploads them to the `LOAD_TARGET` branch's bucket with `slug` and `transfermarkt-id` metadata
- **Dataset** (S14): `npm run dataset` assembles the matches that passed the gate, with their competitions, clubs and players, validates them whole against the dataset schema, and rewrites `data/dataset/` (committed) with a manifest; image keys come from `npm run images`; run `npm run gate` first
- **Load** (S15a): `npm run load` is a dry run against `LOAD_TARGET` (`.env`): it checks the manifest, the schema hash, the dataset schema and `db:check`, then prints per table what a load would create, update or delete, counts only. With image keys in the dataset it also needs the storage keys and stops unless every image is in the target's bucket (S18b). `-- --apply` (S15b) then writes that plan in chunked transactions (parents, players by 500, one per competition season, retirements); a rerun writes nothing. `production` also needs `--target production --confirm`
- **Build** (S20): `npm run build` runs `pool`, `resolve`, `lineups`, `aliases`, `scores`, `gate`, `images` and `dataset` in order, one `npm run <stage>` at a time, and stops at the first that fails, naming it. It never uploads: `npm run images -- --upload` stays a separate step
- **Verify** (S20): `npm run verify` reads `LOAD_TARGET` after a load and checks every dataset match as the backend will serve and play it (score threshold, 2 sides, formations, 11 starters, positions, aliases on both sides, the `sides` block), that `normalized` equals `normalizeName(alias)`, that every stored image key is in the bucket, and that the counts equal the manifest. It also flags a served match that left the dataset. Read only; exits 1 and names the match and the rule
- **Loader e2e** (S15b): `npm run test:e2e`, only with `LOAD_TARGET=disposable` and `DATABASE_URL` on a throwaway Neon branch made from `ingest`; `npm test` stays offline. Since S17 it also runs the storage e2e, which needs `AWS_ENDPOINT_URL_S3` on that branch too
- **Storage** (S17): images go to Neon Object Storage, bucket `images` (`public_read`) on the `LOAD_TARGET` branch, under `crests/<slug>/<sha256-12>.<ext>` and `players/<slug>/<sha256-12>.<ext>`; an existing key is never uploaded again, and nothing is deleted. `npm run storage` checks the `AWS_*` and `STORAGE_BUCKET` keys in `.env`, that the endpoint is `LOAD_TARGET`'s branch, and the bucket, then prints object counts
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
- **Never fetch Transfermarkt with code**: no spider, script, browser UA or Playwright MCP session. Only the user saves its pages
- **Tell the user about manual work first.** When a phase, spec or step needs them, open the reply with a short "👤 Your part" block (what, how many, where it goes). Keep `manual-work.md`, the 👤 note and the spec's `## Your part` in step
