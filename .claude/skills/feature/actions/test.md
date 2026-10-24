# Test Action

1. Read current-feature.md to understand what was implemented
2. Identify the parsers (`extract/`), stages, schemas, loaders and utilities (`src/`) added or modified for this feature
3. Check if tests already exist for these functions
4. For functions without tests that have testable logic, write unit tests:
   - TypeScript: Vitest, as `*.spec.ts` next to the code
   - Python: pytest, as `extract/tests/test_*.py`
   - Parsers are tested on saved pages in `extract/tests/fixtures/`, never against a live site
   - Pure stages (scoring, gate, aliases, resolution) are tested without mocks
   - Unit tests touch no network and no database; loader tests that need Postgres run against a disposable Neon branch, as a separate command
   - Test happy path and error cases
   - Do not write tests just to write them. Use your best judgement
5. Run `npm test` and `uv run pytest` to verify all tests pass
6. Report test coverage for the new feature code
