# Context

These are the context files referenced by `CLAUDE.md` in the repo root. The ones listed first are loaded on startup; everything else is read on demand.

Loaded on startup:

- `project-overview.md` - Full project spec. Shared by all four repos and identical in each
- `coding-standards.md` - Conventions shared by all four repos
- `coding-standards-scraper.md` - Python and TypeScript rules for this repo; wins any conflict here
- `ai-interaction.md` - Workflow and communication guidelines
- `current-feature.md` - The feature in progress, plus the history of completed ones
- `docs/data-contract.md` - The tables, columns, CHECKs and rules the dataset must satisfy; owned by the backend
- `todo.md` - Ordered scraper build phases (`S` prefix), used with `/todo`

Read on demand:

- `docs/` - Setup record, build order, display requirements from the web, source-trial report, backend specs (`docs/backend-specs/`, read-only)
- `docs/match-pool-scope.md` - Which matches become playable: scope, budgets, floors and ceilings (S07–S18)
- `docs/collection-phases.md` - Which phases fetch from websites, what they collect, and how it reaches the database
- `docs/transfermarkt-source.md` - The data source: link types, verified selectors, ids, slots and pitfalls
- `docs/legacy_transfermarkt_scraper_reference.md` - How the old Transfermarkt scraper worked (selectors from 2024; read with the source doc)
- `features/` - Phase specs, named `phase-s<NN>-<kebab-title>.md` (split: `phase-s11a-…`)
- `fixes/` - Fix specs, shaped like `features/`
- `research/` - Research prompts for `/research`

Workflow per phase: `/todo current` → `/todo spec` → `/feature load <spec>` → `/feature start` → `/feature review` → `/feature test` → `/todo done` → `/feature complete`.
