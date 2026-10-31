# Phase S19b — Dashboard Actions & Guided Batch

## Status

Complete

## Goals

Buttons on the S19a dashboard that run the existing commands one at a time, stream their output into the page and refresh the views when they end. A guided batch takes a set of newly saved pages up to a dry run, and a confirmed load takes it into `ingest`.

- **The action table** (`src/dashboard/actions.ts`). A fixed allowlist; each action is a list of steps, each step an argv array run without a shell:

  | Action | Steps | Needs `LOAD_TARGET=ingest` |
  | --- | --- | --- |
  | Refresh status | `npm run status` | no |
  | Open next links | `uv run python -m extract.links open general --count N` | no |
  | Import | `uv run python -m extract.inbox`, then `npm run status` | no |
  | Build | `npm run build`, then `npm run status` | no |
  | Upload images | `npm run images -- --upload`, then `npm run status` | yes |
  | Check schema | `npm run db:check` | yes |
  | Dry run | `npm run load` | yes |
  | Verify | `npm run verify` | yes |
  | **Run batch** | Import → `npm run status` → `npm run build` → `npm run images -- --upload` → `npm run load` (dry run). It stops there and shows the dry-run counts | yes |
  | **Load into `ingest`** | `npm run load -- --apply` → `npm run verify` → `npm run status`, after a confirmation | yes |

  - the only parameter anywhere is `N` for Open next links: an integer from 1 to 50, default 10
  - Open next links only opens your browser, as the command does today
- **The runner** (`src/dashboard/runner.ts`):
  - **one action at a time:** a second request while one runs gets `409` and the page says what's running
  - runs the steps in order and stops at the first that exits non-zero, naming it (`build: npm run gate failed`)
  - streams stdout and stderr line by line to the page over Server-Sent Events (`GET /api/run/stream`)
  - keeps the last result of each action in memory: when, exit code, the failed step and the output tail. S19a's Failures view lists a failed last run
  - the views refresh when an action ends
  - the spawn function is injected, so the runner is tested without running anything
- **The load gate.** Load into `ingest` is enabled only when all of these hold:
  - `LOAD_TARGET` is `ingest`; `production` and `disposable` are refused, with the reason shown
  - a Dry run, or a Run batch, passed in this server session
  - `data/dataset/manifest.json` hasn't changed since that dry run (its hash)
  - nothing else is running
  - the confirmation dialog names the target and repeats the dry-run counts per table. Nothing loads without your click on it
- **Uncommitted dataset warning:** before Dry run and Load, if `git status --porcelain -- data/dataset` lists anything, the page says "data/dataset/ has uncommitted changes" (D1)
- **Request guard** (on top of S19a's `Host` check):
  - actions are `POST /api/actions/<id>` only, with a random token the server makes at start and puts into the page it serves
  - a request with no token, a wrong token or a foreign `Origin` gets `403`. Another site open in your browser can't press a button
- **The page:**
  - an Actions bar with the buttons in run order
  - an output panel that streams the running action
  - buttons disabled, with the reason as a tooltip, while something runs or a gate isn't met
  - after Run batch, the dry-run counts and the Load into `ingest` button
- **Docs:**
  - `enrichment-guide.md` § 2: the dashboard button beside each command
  - `enrichment-guide.md` § 7: the buttons table as built, with Upload images, Verify, Refresh status, Run batch
  - `collection-runbook.md`: "Build and ingest" as Run batch, then Load into `ingest`
  - `CLAUDE.md` § Commands
  - `manual-work.md`: the S19 row

## Your part

1. **After `/feature start`, once Claude says the buttons work** (~15 min, on today's data):
   - **Open next links** with `N` = 2: two links of `general.csv` open in your browser. Save them into `data/inbox/`
   - **Import**: the 2 files import, then the views move
   - **Run batch**: it runs to the dry run and shows the counts. On today's data, expect nothing new to load unless a new match passed the gate
   - **Load into `ingest`**: only if the dry run shows changes, and only by your click on the confirmation. Then check that Verify passed in the output
   - **Build** once more, then **Dry run**: 0 changes
2. **Check the guards:**
   - with `LOAD_TARGET=disposable` in `.env`, the load buttons stay disabled with the reason. Set it back to `ingest` after
3. **Approve the commit** at `/feature complete`

Saving pages here is optional and small (2 pages); the rest of the pool stays your own pace.

## Decisions

Settled at `/feature load`, 2026-10-30: all three as proposed.

- **D1. Uncommitted `data/dataset/` warns, it doesn't block** (approved). The load reads the files, not git; the commit stays yours (`git add data/dataset && git commit`).
  - Alternative: refuse Dry run and Load until `data/dataset/` is committed
- **D2. Load into `ingest` also runs Verify and Refresh status** (approved). It stops before them if the load fails.
  - Alternative: Load only; Verify is its own button
- **D3. Run batch includes Upload images** (approved) before the dry run, since the dry run stops unless every image key is in the bucket. The upload writes to the bucket without a separate confirmation: pressing Run batch is the approval, and an existing key is never uploaded again.
  - Alternative: Run batch stops after Build; Upload images is its own confirmed step

## Notes

- Scope: the action table, the runner, the guards, the buttons and the output panel. Not in scope: a `production` button (loading there stays a terminal command with `--target production --confirm`); a scraping or fetching button; committing from the dashboard; a log of runs on disk (not chosen, 2026-10-30); a cancel button
- Depends on: S19a (server, page, views), S20 (`npm run build`, `npm run verify`), the Collection Tracker (`npm run status`, `open general`)
- Decided with you on 2026-10-30, before this spec: a tiny Node server, a guided batch that stops at the dry run, a link browser and a sizes panel, and players and images counted under their match block
- Constraints:
  - **Never fetch Transfermarkt with code:** Open next links only opens your browser; no button fetches, crawls or drives a browser
  - Never load into `production`; the dashboard can't, whatever `.env` says
  - Every write is an existing command with its own guards (`load`'s preflight and `db:check`, `images`' skip of existing keys); the dashboard adds none of its own
  - Python never writes to Postgres or the bucket; TypeScript never fetches a source. The dashboard only runs the existing commands
  - Output streamed to the page is the commands' own, already counts and paths only
  - No shell: argv arrays from the allowlist; `N` is the only input, checked as an integer from 1 to 50
  - Comments at most 50 characters; `@/` imports
- Verification:
  - `npm test`: the allowlist (no unknown id, `N` bounds), the runner (one at a time, `409`, stops at the first failing step and names it, last result kept), the load gate (target, a passed dry run, manifest hash, busy), the token and `Origin` checks, the batch step order. All use an injected spawn and no process
  - `npm run lint`, `npm run typecheck`, `npm run format:check`
  - on the real data: Your part 1–2; after a load, a second Dry run shows 0 changes

**Deviations recorded during implementation**

- **Each branch command also gets `--target ingest`** (upload, dry run, load, verify), so the command itself refuses another branch, not just the page's gate
- **`.env` is read fresh:** Node's `loadEnvFile` never overrides a variable already set, so a child started with the dashboard's environment would keep the `LOAD_TARGET` of when it started. Commands now get the shell's environment from before `.env` was loaded and read `.env` themselves; the gates re-read `LOAD_TARGET` from `.env` on every check. Changing `.env` while the dashboard runs takes effect on the next press
- **The load gate also closes when the dry run found 0 changes** ("The dry run found nothing to load"). A load uses its dry run up, and a new Dry run or Run batch clears the previous one when it starts
- **The confirmation shows the dry run's own output** (the loader's per-table counts and its change count), not a re-parsed table
- **A press with no `Origin` header is refused too**, not just a foreign one; a body may hold only `count`
- **`--no-open`** starts the dashboard without opening a browser (used for the smoke test)
- **npm steps run as `npm run --silent`**, so the output has no npm banner lines
- **`host.ts`** holds the port, the host and the host and origin checks, so `guard.ts` and `server.ts` don't import each other
- **Failures lists a failed button** (source "Action": the step that failed and its exit code)
- **Smoke test on the real data, 2026-10-30,** on port 4329 (your S19a dashboard still held 4319):
  - the guards: no token, a foreign or missing origin → `403`; an unknown action, `count` 500, an extra key or a body that isn't JSON → `400`; Load before a dry run → `403` "Run a dry run first"
  - **Dry run** streamed over SSE: 0 changes, all 71 images in the bucket; a second press while it ran got `409`; Load then stayed closed, "The dry run found nothing to load"
  - **Verify** passed (all 3 matches servable and playable); **Check schema** passed; **Refresh status** pressed in the page streamed its output and refreshed the views
  - Claude ran no Import, Build, Upload or Load: those are Your part
- 753 TypeScript tests (29 new) and 321 Python tests pass; typecheck, lint, format clean
- **Fixed during Your part, 2026-10-31: `npm run status` rejected the gate's failures.** The gate writes each failure as text (`failureText`: `"home slot 1: no player"`), but the Collection Tracker's reader expected `{at, rule}` objects. It never showed until a build ran with a match failing the gate: your Run batch built Porto – Benfica and Arsenal – Liverpool, which wait for 39 player pages. So the last step of Load into `ingest` failed after the load and the verify had both passed. `src/status/main.ts` now reads the text through `parseGateFailure` (`src/status/remote.ts`, tested against `failureText`); `npm run status` passes again
- **Your Load into `ingest`, 2026-10-31:** 3 `memorability_scores` updates written. Scores are percentiles within an era bucket, so the 2 newly scored 2000-01 matches raised the 3 pilot scores (for example 65 → 82.5 and 75 → 87.5), with a new `computedAt`. Verify passed (all 3 matches); a second dry run shows 0 changes. `data/dataset/` (manifest and 3 match files) goes into this feature's commit
- **Your part 1–2, 2026-10-31:** done. Run batch, a confirmed load, Build then Dry run (0 changes, Load closed), and the guard with `LOAD_TARGET=disposable` all behaved as written; `.env` is back on `ingest`
- **Run batch's `npm run resolve` gave the whole pool its permanent slugs:** `data/curation/crosswalk/` grew to 100 clubs, 11 competitions, 2,002 matches and 68 players (from 37, 5, 61 and 65); no existing slug changed. These are committed with this feature, since slugs are permanent once given
- **`/feature test`:** `system.spec.ts` runs the real spawner on a local `node -e` (no network, no shell): lines with their stream, the exit code, argv passed as given (`$HOME; ls` stays text) and `127` for a missing command. `server.spec.ts` now also covers the event stream (start, step, end; nothing after the page leaves). 758 TypeScript tests (34 new in this feature) and 321 Python tests pass; typecheck, lint, format clean. Not unit tested, on purpose: `manifestHash`, `isDatasetDirty` and `currentTarget` (file and git reads; `targetFrom` is tested), `main.ts`, and the page's `app.js` (no component tests), all proved in Your part

## History
