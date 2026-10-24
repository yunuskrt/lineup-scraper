# Review Action

1. Read current-feature.md to understand the goals
2. Review all code changes made for this feature
3. Check for:
   - ✅ Goals met
   - ❌ Goals missing or incomplete
   - ⚠️ Code quality issues or bugs
   - 🚫 Scope creep (code beyond goals)
4. Check the scraper rules:
   - No outbound request in `src/`; no Postgres or bucket access in `extract/`
   - Python never normalises a name; raw text stays as fetched (NFC only)
   - Every record written by Python is validated against `schemas/raw/`
   - Output is deterministic: sorted, stable key order, a rerun is byte-identical
   - Slugs come from the crosswalk and are never regenerated
   - Only content tables are written; no competition, season, club, player or match is deleted
   - No `prisma migrate` or `db push`; `db:check` runs before a load
   - Logs and errors print counts and paths, never an XI or an alias list
   - `robots.txt`, the rate limit and the cache are respected
   - Substitutes are never stored as answers (HC 17); no LLM output is used as data (HC 4)
5. Final verdict: Ready to complete or needs changes
