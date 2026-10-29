# Phase S18b — Image Processing & Upload

## Status

Not Started

## Goals

- **`npm run images`** `src/images/` (offline):
  - for every club and player in the dataset with an image filed by S18a (`data/images/transfermarkt/`), matched on `transfermarktId`
  - converts it with `sharp` (pinned) to a **128×128 WebP** (D1), as the web's display requirements recommend (`data-display-requirements.md` § 1):
    - crest: the whole crest shown, aspect kept, on a transparent background (`fit: contain`)
    - photo: a centred square crop (`fit: cover`)
  - names it with S17's `imageKey` (`crests/<slug>/<sha256-12>.webp`, `players/<slug>/<sha256-12>.webp`, the hash of the WebP's bytes)
  - writes the files to `data/work/images/<key>`, the slug → key map to `data/work/images/keys.json` (sorted, 2-space JSON), and `data/reports/images.md`: images missing, sources smaller than 64 px (crest) or 80 px (photo), and placeholders
  - a rerun with the same sources gives byte-identical files and the same keys
- **`npm run images -- --upload`**: uploads every mapped file to the `LOAD_TARGET` branch's bucket with S17's `uploadImage`, behind S17's guard (`production` also needs `--target production --confirm`). Prints counts: uploaded, already there. Never deletes
- **The dataset carries the keys** (D3): `npm run dataset` reads `keys.json` and fills `crestKey` and `imageKey` (`null` when there's no image); the manifest counts crests and photos
- **The loader checks the bucket** (`src/load/preflight.ts` or a new check beside it): before any write, every `crestKey` and `imageKey` in the dataset must exist in the target's bucket (one listing per prefix). Otherwise it stops with a count and "run `npm run images -- --upload` first". The load then writes `crest_key` and `image_key` through its normal diff, so a rerun writes nothing. `npm run load` needs the storage keys only when the dataset has an image
- **E2E** (`npm run test:e2e`, disposable branch): the pilot's images upload; the load writes their keys; every key in the database names an object in the branch's bucket; a rerun uploads nothing and writes nothing
- **Docs:** `CLAUDE.md` § Commands (`npm run images`), `enrichment-guide.md` (save images, import, `images`, `--upload`, then dataset and load), `manual-work.md` row S18b

## Your part

1. **Approve a disposable branch** for the e2e run, as in S17: Claude creates it from `ingest` and deletes it afterwards, asking each time. For the run, `.env`'s `DATABASE_URL`, `LOAD_TARGET=disposable` and `AWS_ENDPOINT_URL_S3` point at it; then all three go back to `ingest`
2. **Look at the pilot's images** once `npm run images` has run: open a few files in `data/work/images/` and read `data/reports/images.md`. A crest or photo that looks wrong (cropped head, white square behind a crest) is replaced by saving a better one (S18a), never edited by hand
3. **Approve uploading the pilot's images to `ingest`'s bucket** (`npm run images -- --upload`, 71 objects). It writes no row: the keys reach `ingest`'s database with the pilot's load in S20

## Decisions

**Your requirement** (set at S18a's `/feature load`, 2026-10-29): the link between a `players` or `clubs` row and its image must never be lost; from a row you can check its photo in the bucket easily, and back. S18b keeps it four ways, each tested:

- the row's `image_key` / `crest_key` is the object's exact key, so a row leads straight to its object
- the key's folder is the row's slug: `players/oliver-kahn/<hash>.webp` is `players.slug = 'oliver-kahn'`; in the Neon console's bucket browser, a player's folder holds that player's photos
- each object carries metadata `slug` and `transfermarkt-id` (`x-amz-meta-*`), so an object leads back to its row even when found by itself
- the loader refuses a key whose folder isn't its row's slug, and `npm run images` reports any row with no image

To settle at `/feature load`:

- **D1. One 128×128 WebP per image** (proposed): the size the web's requirements recommend for both crests and photos (sharp at 3× phones), WebP for size and transparency. Alternative: several sizes per image (more keys, nothing reads them yet)
- **D2. Only the dataset's clubs and players** (proposed): "only the pool is loaded" (`coding-standards-scraper.md` § Data rules), so an image of a player whose match didn't pass the gate is kept on disk but not processed or uploaded. Alternative: every filed image
- **D3. Keys ride in the committed dataset** (proposed): `data/dataset/` stays the one input of the loader, and the loader proves each key's object exists in the target bucket before writing. Since keys hash the WebP's bytes, `sharp` is pinned; a new `sharp` that changes the bytes gives new keys, which is safe (new objects, the old ones stay). Alternative: the loader looks the keys up itself at load time, so the dataset never holds them

## Notes

- Scope: TypeScript only: processing, keys, upload, the dataset fields and the loader's bucket check. The files come from S18a
- Depends on: S18a (filed images), S17 (keys, client, guard), S14 and S15 (dataset, loader)
- Backend: nothing new for S18b; the columns exist. The app shows images only after backend request **R2** (`backend-requests.md`), needed by S20
- Attribution (`scraper-repo-setup.md` § 11, decision 5): not stored now. The images are development-only, like the Transfermarkt data, and each licence is checked before release (`backend-requests.md` § Shared spec changes); storing credits then is a backend migration first
- Constraints:
  - **Upload before the key is written**; never delete an object the database references (S17)
  - Postgres holds the key, never a URL or the binary
  - TypeScript fetches no source; it reads only files S18a filed
  - Output is deterministic: sorted, stable keys, byte-identical on a rerun
  - Logs print counts and paths, never a credential
  - Never `production` without an explicit instruction in the prompt
- Verification: `npm test` (resizing on small fixture images, the key map, the dataset fields, the bucket check with an in-memory store), `npm run lint`, `npm run typecheck`, `uv run pytest`; `npm run images` on the pilot; `npm run test:e2e` on a disposable branch, then deleted

## History
