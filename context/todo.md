# Lineup — Scraper Build Phases

Phase IDs use the `S` prefix. Line order is build order; the current phase is the first `- [ ]` line.

Workflow per phase: `/todo current` → `/todo spec` → `/feature load <spec>` → `/feature start` → `/feature review` → `/feature test` → `/todo done` → `/feature complete`.

This todo file is for developer-side use.

**👤 = your manual work.** A line ending in ` — 👤 you: …` needs you (saving pages, approvals). The steps are in that phase's spec under `## Your part`, and the full list is `docs/manual-work.md`.

## Scraper

- [x] **Phase S01 — Repo & Scaffold**: npm TypeScript and uv Python projects side by side, lint, format, tests, `data/` layout.
- [x] **Phase S02 — Source Trial**: Terms, robots.txt and field coverage of Mackolik and alternatives on 20 matches. (was P01)
- [x] **Phase S03 — Schema Copy & Targets**: `schema.prisma` copy, Prisma client, `db:check` drift guard, Neon targets.
- [x] **Phase S04 — Dataset Schema**: Zod schema for the final dataset, ported `normalizeName`, mirrors of every DB CHECK.
- [x] **Phase S05 — Raw Record Contract**: Zod raw records exported to JSON Schema, validated by Python before writing.
- [x] **Phase S06 — Fetch Harness**: Scrapy harness for automated sources (S06a); Transfermarkt parsers and `extract.inbox` import of hand-saved pages (S06b). (was B15)
- [x] **Phase S06c — Collection Tools**: Link lists with save-as file names and folders; an import log for history; check and progress commands that skip what's already saved.
- [x] **Phase S07 — Pool & Link Lists**: Curated groups as config, the full listing-page link list, and the pool match list from saved listings, every match once. (was B16)
- [x] **Phase S08 — Entity Resolution**: Clubs, competitions, seasons and players deduped into permanent slugs, keyed on Transfermarkt ids. (was B17)
- [x] **Phase S11 — Lineup Extract**: Match reports to XIs, formations, coordinates to slots, and events; the match-report link list. (was B20)
- [x] **Phase S11b — Player Pages**: Full name and caps added to the parser; the player link list, each player once.
- [x] **Phase S12 — Alias Sets**: Full, common, surname, mononym, nickname and transliteration aliases, with curation.
- [x] **Phase S10 — Memorability Engine**: Match-data signals, era-bucket normalisation, calibrated so every group clears its threshold; pure and tested. (was B19)
- [x] **Phase S13 — Guessability Gate**: All 11 starters resolved with alias sets; writes `sides` guessability. (was B21)
- [x] **Phase S14 — Dataset Build**: Assemble, validate and write the committed dataset, deterministic, with a manifest.
- [x] **Phase S15 — DB Loader**: Idempotent diff-sync into a chosen Neon branch, chunked, dry run, counts only; writes `transfermarkt_id`.
- [ ] **Phase S19 — Dashboard**: Local app: progress counts and percentages by group, competition and season; history; every failure with its reason; buttons to open links, import, build and load into `ingest`. (absorbs S16)
- [ ] **Phase S20 — Pilot & Enrichment Guide**: The 3 pilot matches end to end into `ingest`, and the guide for growing the pool yourself. — 👤 you: approve the load, play the pilot in the app

### Later: images

- [ ] **Phase S17 — Storage Client**: Bucket choice, content-hash key scheme, idempotent uploads. (was half of B23)
- [ ] **Phase S18 — Image Import**: An image list and folder per club and player, then resize, upload, `crest_key` and `image_key`. (was B24) — 👤 you: save the images

### After S20: your enrichment

Not phases: you run the guide (`docs/enrichment-guide.md`) in your own time, and ask for fixes when something breaks.

- About 100 matches next, spread over the groups and eras, reusing every club and player already saved
- Then the rest of the pool (`docs/match-pool-scope.md`), at your pace

---

## Deferred

- New league and season packs, once the pipeline is cheap to extend
- Collecting real misspellings from live play into aliases (needs a backend export first)

## Dropped

- **S09 Cultural Footprint** (2026-10-27): Wikipedia isn't part of the pipeline. It may still help choose matches, never as data
- **S16 Pool QA Report** (2026-10-27): folded into the S19 dashboard
