---
name: cleanup
description: Clean up project housekeeping tasks (add "run" to execute fixes)
argument-hint: run|check
---

Review the codebase for cleanup tasks:

1. Make sure that the history in @context/current-feature.md is in order from oldest to newest
2. Find long comment blocks for a statement (more than 1 line or 50 characters), in both `//` and `#` comments
3. Find unnecessary `console.log` statements in `src/` and `print(` calls in `extract/`
4. Find unused imports (`npm run lint` for TypeScript, `uv run ruff check` for Python)
5. Check for stale TODO comments
6. Find orphaned/unused files, including spiders, parsers or stages nothing runs
7. Check that context files match actual project state, including that `prisma/schema.prisma` and `context/docs/data-contract.md` match the backend's current versions
8. Check that `.env` has every variable the Zod env schema in `src/config/` requires and every variable the Scrapy settings read, and no variable neither knows. If something is missing, tell me.
9. Find `@ts-ignore` and `# type: ignore` comments that might be stale
10. Check that nothing under `data/cache/`, `data/raw/`, `data/work/` or `data/reports/` is tracked by git

**Mode: $ARGUMENTS**

If no argument or argument is "check":

- Only report findings, don't modify anything
- List what WOULD be cleaned up

If the argument is "run" or "fix":

- First, report all findings with numbered items
- Then ask: "Which items would you like me to fix? (enter numbers like 1,3,5 or 'all' or 'none')"
- Wait for user response before making any changes
- Only fix the items the user specifies
- Report what you changed
