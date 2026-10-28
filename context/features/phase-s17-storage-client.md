# Phase S17 — Storage Client

## Status

Complete

## Goals

- **Bucket: Neon Object Storage** (decided 2026-10-28), in the project's own branches: an image uploaded to `ingest` lives on `ingest`, beside the rows that point at it. A bucket `images` on `ingest`, `public_read` (decisions D1, D2)
- **Env** (`src/config/env.schema.ts`): a separate `storageEnvSchema`, parsed only by storage commands, so `npm run load` still runs without it. Keys in AWS's own names, as the Neon console gives them: `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, plus `STORAGE_BUCKET` (default `images`). `.env.example` lists them with placeholders
- **Key scheme** `src/storage/keys.ts` (pure):
  - `crests/<club-slug>/<sha256-12>.<ext>` and `players/<player-slug>/<sha256-12>.<ext>`, the hash of the file's bytes
  - `ext` from the content type: `webp`, `png`, `svg` (`data-display-requirements.md` § 1); anything else refused
  - A key never changes once written, so it's cached forever: `Cache-Control: public, max-age=31536000, immutable`
- **Client** `src/storage/client.ts`: `@aws-sdk/client-s3` with `forcePathStyle: true` (Neon is path-style only), built from the storage env
- **Upload** `src/storage/upload.ts`: `uploadImage(client, { kind, slug, bytes, contentType })` returns `{ key, uploaded }`
  - `HeadObject` first: an existing key is skipped, so a rerun uploads nothing
  - `PutObject` with `Content-Type` and `Cache-Control`
  - Retries `503 SlowDown` with backoff (Neon's rate limit)
  - **No delete anywhere in S17.** An object the database still references is never deleted; cleaning up unreferenced objects is a later, separate step
- **Target guard** `src/storage/target.ts` (pure): the endpoint's host names its branch (`br-….storage…`). `production`'s branch (`br-square-feather-b17d6fhc`) is refused unless `LOAD_TARGET=production` with `--target production --confirm`, as the loader does (`src/load/target.ts`)
- **`npm run storage`** `src/storage/main.ts`: checks the env, the guard and the bucket (`HeadBucket`), then prints the object count under `crests/` and `players/`. Counts only; it never prints a credential or a full key list
- **E2E** `src/storage/storage.e2e-spec.ts`, run by `npm run test:e2e`, only with `LOAD_TARGET=disposable` and a disposable branch's storage endpoint (refused otherwise, before connecting):
  - a small fixture image uploads under its expected key
  - a rerun uploads nothing
  - the same bytes under another slug get another key; changed bytes get a new key
  - the public URL (`<endpoint>/<bucket>/<key>`) serves the bytes with the stored `Content-Type` and `Cache-Control`
- **Backend request R2, "Image URLs"** in `context/docs/backend-requests.md`: backend B23 adds `ASSET_BASE_URL` (`<endpoint>/<bucket>`, one per environment) and turns `crest_key` and `image_key` into `ClubRef.crestUrl` and `RevealedPlayer.imageUrl`. Needed by S20, so the pilot shows its images. Plus a row under "Shared spec changes": Tech stack, object storage, "R2, Supabase or B2, decided later" → Neon Object Storage
- **Docs:** `CLAUDE.md` § Commands (`npm run storage`), `manual-work.md` row S17

## Your part

1. **Create the bucket** (D1): in the Neon console, open project **lineup** → branch **ingest** → **Object storage** → **New bucket**, name `images`, access **public_read**. Or Claude creates it with the Neon MCP, after asking you. **Approve dropping `uploads`** (D1): Claude deletes the empty bucket on `production`, `dev` and `ingest`, asking first
2. **Create a storage credential on `ingest`** (D3): **Connect** → **Storage** tab → **Parameters only** (with the branch set to `ingest`). Copy `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` into `.env`, and add `STORAGE_BUCKET=images`. The secret never goes into the repo or the chat
3. **Approve a disposable branch** for the e2e run, made from `ingest` (it inherits the bucket, and the `ingest` credential works on it). For the run, set `.env`'s `DATABASE_URL`, `LOAD_TARGET=disposable` and `AWS_ENDPOINT_URL_S3` to that branch; Claude deletes the branch afterwards, asking first. Then set all three back to `ingest`
4. Run `npm run storage` once on `ingest`: it should report the bucket with 0 objects

## Decisions

Settled at `/feature load`, 2026-10-28 (all three as proposed; D1 extended):

- **D1. A new bucket `images` on `ingest`** (approved), **and drop `uploads`** (you added): it is empty on `production`, `dev` and `ingest` (listed 2026-10-28), and each branch holds its own copy, so it is deleted on all three, by Claude with the Neon MCP, asking first. The existing `uploads` bucket is private, was made on `production` on 2026-10-01, and nothing in the backend uses it. A named bucket keeps images apart from anything else. It goes on `ingest`, not `production`: a bucket made on a parent now doesn't reach a branch forked before, and `ingest` forked on 2026-10-24. `production` gets its own when the pool is loaded there. Alternative: reuse `uploads`, already on every branch, after making it `public_read`
- **D2. `public_read`** (approved): clients load images straight from the bucket URL, as the spec says ("Clients fetch images straight from the CDN URL — the backend does not proxy them"); writes still need the credential. Alternative: keep it private and have the backend sign a short-lived URL per image, which adds work to every response that carries one
- **D3. The credential made on `ingest`** (approved): it works on `ingest` and its disposable children, never on `production` or `dev` (Neon binds a credential to its branch's lineage). Alternative: one made on `production`, valid everywhere, so one key could touch every branch

## Notes

- Scope: the bucket, the client, the key scheme, idempotent uploads, the guard, a check command and the e2e. No image is collected, resized or linked to a row: that is S18, which calls `uploadImage` and writes `crestKey` and `imageKey` through the dataset and the loader
- Depends on: S15 (the target and `LOAD_TARGET` pattern, the e2e config). Nothing in the backend: the columns `crest_key` and `image_key` already exist (`data-contract.md` § 2.3, § 2.5)
- Neon facts used (docs read 2026-10-28): path-style only; SigV4; `HeadObject`, `PutObject` with `Content-Type` and `Cache-Control`; access level is set in the console or API, never by `PutBucketAcl` (501); a public object is at `https://<branch-id>.storage.c-<N>.<region>.aws.neon.tech/<bucket>/<key>`; free plan 5 GB per project. `ingest`'s endpoint is `https://br-steep-paper-b1z0rlqq.storage.c-5.eu-central-1.aws.neon.tech`, region `eu-central-1`
- Constraints:
  - **Postgres holds the key, never a URL or the binary** (`data-contract.md` § 2.3, § 2.5)
  - **Upload before the key is written**; never delete an object the database references (`scraper-repo-setup.md` § 8)
  - TypeScript talks only to Postgres and the bucket; Python never touches the bucket
  - Secrets live in `.env`, validated at start; errors name a key, never its value
  - Never `production` without an explicit instruction in the prompt
  - Images are for development, like the Transfermarkt data: each licence is checked before release (`backend-requests.md` § Shared spec changes)
- Verification: `npm test`, `npm run lint`, `npm run typecheck`, `uv run pytest`; `npm run test:e2e` on a disposable branch, then the branch deleted; `npm run storage` on `ingest` reports the bucket and 0 objects

**Deviations recorded during implementation**

- **Buckets, 2026-10-28** (Your part 1, done by Claude with your approval): `images` (`public_read`) created on `ingest`; `uploads`, checked empty right before, deleted on `ingest`, `dev` and `production`. `ingest` now holds only `images`; the other two have no bucket
- **`src/storage/client.ts` exposes an `ObjectStore`** (`checkBucket`, `hasObject`, `putObject`, `countObjects`) instead of the bare S3 client, and `uploadImage(store, …)` takes it. Upload logic is then unit-tested with an in-memory store; only the e2e talks to Neon
- **The `503 SlowDown` retry is the SDK's** standard retry mode (`maxAttempts: 5`, backoff with jitter), not code of our own
- **The guard is stricter than written:** for every target, not only `production`, the endpoint's branch must be that target's (`ingest` → `br-steep-paper-b1z0rlqq`); `disposable` must be none of `production`, `ingest` and `dev`; `dev` is never a target. The known ids live in `src/storage/target.ts`
- `npm run storage` reuses the loader's `parseArgs` and refuses `--apply`: it only reads
- `@aws-sdk/client-s3` pinned at `3.1152.0` (released 2026-10-14)
- **Checks, 2026-10-28:** `npm run storage` on `ingest` reported `target ingest, bucket images`, 0 objects under `crests/` and `players/`. E2E on `s17-e2e` (`br-tiny-queen-b1w508t9`, from `ingest`, created with your approval): **12 of 12 passed** (the loader's 8 and storage's 4). Its bucket then held exactly the 3 test objects; `ingest`'s bucket stayed empty, so branches keep their own objects
- **Tests added at `/feature test`:** `src/storage/client.spec.ts` (`isNotFound`, now exported: only a 404 reads as missing, so a 403 or a network error never re-uploads) and two `loadEnv` cases (a load needs no storage key; the storage keys parse once, apart). 588 TypeScript and 246 Python tests pass. A second e2e run on the same `s17-e2e` failed only the loader's two "empty branch" cases, as S15b designed (its e2e needs a fresh branch); storage's 4 passed again. `s17-e2e` was then deleted with your approval; only `production`, `dev` and `ingest` remain

## History
