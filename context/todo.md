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
- [ ] **Phase S06c — Collection Tools**: Link lists with save-as file names and folders; progress and check tools for saved, imported and parsed pages.
- [ ] **Phase S07 — Pool Selection**: Curated groups (derbies, big-club league clashes, UCL knockouts, UEL finals, World Cup and Euro knockouts) into the pool match list, every match once. (was B16) — 👤 you: save ~94–247 listing pages
- [ ] **Phase S08 — Entity Resolution**: Clubs, competitions, seasons and players deduped into permanent slugs, keyed on Transfermarkt ids. (was B17)
- [ ] **Phase S11 — Lineup Extract**: Transfermarkt match reports for every pool match: XIs, formations, coordinates to slots, and events. (was B20) — 👤 you: save ~2,000 match pages in batches of ~300
- [ ] **Phase S11b — Player Pages**: Every pool starter's profile: display name, full name, caps, date of birth, into the player crosswalk. — 👤 you: save ~5,000–8,000 player pages in batches
- [ ] **Phase S09 — Cultural Footprint**: Wikipedia and Wikidata articles, pageviews and match nicknames. (was B18) — 👤 you: approve each API crawl
- [ ] **Phase S10 — Memorability Engine**: Scores every pool match with era-bucket normalisation, calibrated so every group clears its threshold; pure and tested. (was B19)
- [ ] **Phase S12 — Alias Sets**: Full, common, surname, mononym, nickname and transliteration aliases, with curation.
- [ ] **Phase S13 — Guessability Gate**: All 11 starters resolved with alias sets; writes `sides` guessability. (was B21)
- [ ] **Phase S14 — Dataset Build**: Assemble, validate and write the committed dataset, deterministic, with a manifest.
- [ ] **Phase S15 — DB Loader**: Idempotent diff-sync into a chosen Neon branch, chunked, dry run, counts only; writes `transfermarkt_id`. — 👤 you: build backend request R1 first, approve each load
- [ ] **Phase S19 — Progress Dashboard**: One simple local page: pages saved, imported and parsed per list, dataset and database counts.
- [ ] **Phase S16 — Pool QA Report**: Pool size and coverage gaps per group, competition, era and club. (was B22)
- [ ] **Phase S17 — Storage Client**: Bucket choice, content-hash key scheme, idempotent uploads. (was half of B23)
- [ ] **Phase S18 — Image Ingest**: Licence check, attribution, upload, then `crest_key` and `image_key`. (was B24)

---

## Deferred

- New league and season packs, once the pipeline is cheap to extend
- Collecting real misspellings from live play into aliases (needs a backend export first)
