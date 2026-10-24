# Phase S01 — Repo & Scaffold

## Status

Not Started

## Goals

- **TypeScript project.** `package.json` (`lineup-scraper`, `private`, `"type": "module"`, `engines.node` `>=22.22`, `license` `UNLICENSED`) and a committed `package-lock.json`. Dev dependencies only, on the backend's versions: `typescript`, `@types/node`, `vitest`, `vite-tsconfig-paths`, `oxlint`, `oxlint-tsgolint`, `prettier`, `tsx`
- **`tsconfig.json`**, ported by hand from `../lineup-backend/tsconfig.json`: `nodenext` module and resolution, `strict`, `target` ES2023, `isolatedModules`, `skipLibCheck`, `types: ["vitest/globals", "node"]`, `paths: { "@/*": ["./src/*"] }`. Drop `emitDecoratorMetadata`, `experimentalDecorators`, `strictPropertyInitialization`, the `@test/*` and `@scripts/*` paths and the build-output options. Set `noEmit: true`, since stages run through `tsx` and nothing is built
- **`vitest.config.ts`**, ported from the backend's: Node environment, `globals`, `include: ['src/**/*.spec.ts']`, `@/` resolved by `vite-tsconfig-paths`
- **`.oxlintrc.json`**, ported from the backend's: `typescript/no-explicit-any` and `typescript/no-floating-promises` as errors, `env.node`. Drop the `src/game` override. Add `no-restricted-imports` with patterns `./*` and `../*`, so a relative import fails lint (the `@/` rule)
- **`.prettierrc`**, copied as is. **`.prettierignore`**: `context`, `.claude`, `*.md`, `data`, plus `package-lock.json`
- **npm scripts**: `test` (`vitest run`), `test:watch`, `lint` (`oxlint --type-aware src/`), `typecheck` (`tsc --noEmit`), `format` and `format:check` (Prettier over `src/**/*.ts` and the root config files), `noop` (see below)
- **Python project.** `.python-version` (`3.13`), `pyproject.toml` and a committed `uv.lock`. The dev dependency group holds `ruff`, `mypy` and `pytest`, and nothing else is added yet
- **`pyproject.toml` tool config**:
  - ruff: `target-version` py313, `extend-exclude` for `src`, `node_modules`, `data`. The rules include import sorting (`I`), pyupgrade (`UP`) and bugbear (`B`), and `flake8-tidy-imports` with `ban-relative-imports = "all"`, which is the Python form of the `@/` rule
  - mypy: `strict = true`, `python_version = "3.13"`, `files = ["extract"]`
  - pytest: `testpaths = ["extract/tests"]` and `pythonpath = ["."]`, so `from extract.… import …` works without installing the package
- **`extract/` package skeleton**: `extract/__init__.py` and `extract/tests/__init__.py`, plus `extract/tests/fixtures/.gitkeep`
- **`data/` layout**: `data/curation/.gitkeep` and `data/dataset/.gitkeep` are committed. `data/cache/`, `data/raw/`, `data/work/` and `data/reports/` are gitignored and created on demand, never committed
- **`.gitignore`**, ported from the backend's base entries. Keep dependencies, env (`.env`, `.env.*`, `!.env.example`), logs, coverage, temp, OS, editor files and `.claude/settings.local.json`. Drop the build-output and `src/generated/` lines for now; S03 adds the Prisma one back. Add the four `data/` folders above, plus `.venv/`, `__pycache__/`, `.mypy_cache/`, `.ruff_cache/` and `.pytest_cache/`
- **A no-op stage in each language** to prove the wiring end to end:
  - TS: `src/config/data-dirs.ts` exports `DATA_DIRS` (the six `data/` folders, resolved from the repo root) as a constant. `src/noop/main.ts` prints each folder's path and whether it exists, and `npm run noop` runs it through `tsx`. A `src/config/data-dirs.spec.ts` imports through `@/` and checks the six names
  - Python: `extract/data_dirs.py` exports `DATA_DIRS`, the same six folders as `pathlib.Path`s from the repo root. `extract/tests/test_data_dirs.py` imports it by absolute path and checks the six names
  - Both lists are written by hand in each language and never shared (`schemas/raw/` is the only interface, and it starts in S05)

## Out of Scope

- Scrapy, `scrapy.cfg`, `extract/settings.py` and any spider: **S06**
- Prisma, `prisma/`, `prisma.config.ts`, `src/config/` env parsing, `.env.example`, `db:*` scripts: **S03**
- Zod and `schemas/raw/`: **S04 and S05**. S01 reads no file, so nothing needs parsing yet
- The stage folders (`raw`, `resolve`, `aliases`, …). Each phase creates its own folder, so none starts empty
- `.claude/settings.json` (setup doc § 7j) is repo tooling, not scaffold. Add it separately if it's wanted

## Notes

- Scope: everything needed so that `npm install`, `uv sync`, both test suites, both linters, `tsc` and Prettier all pass on an almost empty repo, and the next phases only add code.
- Depends on: none. Node v22.22.3, npm 11.21.0, uv 0.13.5 and CPython 3.13.17 (installed through uv) are already on this machine.
- Constraints:
  - The backend files (`tsconfig.json`, `.oxlintrc.json`, `.prettierrc`, `vitest.config.ts`, `.gitignore`) are **ported by hand, never imported, extended or symlinked**. The repo must build with `../lineup-backend` deleted (data contract § 11, S01 row)
  - All internal TS imports use `@/`, and all Python imports are absolute from `extract`
  - No `any` and no Python `Any`. mypy runs in strict mode
  - Comments are rare, a single line and at most 50 characters
  - Nothing under `data/cache`, `data/raw`, `data/work` or `data/reports` may be tracked
- Verification:
  - `npm install` then `uv sync` on a fresh clone
  - `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`
  - `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy extract`
  - `npm run noop` prints the six paths
  - `mkdir -p data/raw && touch data/raw/probe` leaves `git status` clean; then delete the probe
  - A relative import (`../config/data-dirs`) in a TS file and `from . import data_dirs` in Python should each fail lint. Try it once, then revert
- When the first real stage lands in each language, remove the no-op runner (`src/noop/`) if it's no longer useful. Keep `DATA_DIRS`, because later stages read their paths from it.

**Deviations recorded during implementation**

- oxlint import patterns are `./**` and `../**`, not `./*` and `../*`: the single star didn't catch `../config/x.js`
- ruff also excludes `context`, `.claude` and `*.md`, because ruff 0.17 formats code blocks inside Markdown
- `.prettierignore` also lists `.mcp.json`, a hand-copied backend file

## History
