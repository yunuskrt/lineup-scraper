# Phase S18b — Image Processing & Upload

## Status

Complete

## Goals

- **`npm run images`** `src/images/` (offline):
  - for every club and player in the dataset with an image filed by S18a (`data/images/transfermarkt/`), matched on `transfermarktId`
  - converts it with `sharp` (pinned) to a **128×128 WebP** (D1), as the web's display requirements recommend (`data-display-requirements.md` § 1):
    - crest: the whole crest shown, aspect kept, on a transparent background (`fit: contain`)
    - photo: a square crop (`fit: cover`), cut from the top of the portrait so the face stays whole (D1, settled at `/feature load`), with a per-image override in `data/curation/images.json`
  - writes the contact sheet `data/reports/images.html` (D1): every output as the app draws it, beside its source
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
2. **Check every pilot image** once `npm run images` has run: open `data/reports/images.html` in your browser. It shows all 71 as the app will (photos in circles, crests on the dark panel). A face cut badly gets a crop override in `data/curation/images.json` (Claude adds it when you name the player); a bad source (a white square behind a crest) is replaced by saving a better one (S18a). Nothing is edited by hand
3. **Approve uploading the pilot's images to `ingest`'s bucket** (`npm run images -- --upload`, 71 objects). It writes no row: the keys reach `ingest`'s database with the pilot's load in S20

## Decisions

**Your requirement** (set at S18a's `/feature load`, 2026-10-29): the link between a `players` or `clubs` row and its image must never be lost; from a row you can check its photo in the bucket easily, and back. S18b keeps it four ways, each tested:

- the row's `image_key` / `crest_key` is the object's exact key, so a row leads straight to its object
- the key's folder is the row's slug: `players/oliver-kahn/<hash>.webp` is `players.slug = 'oliver-kahn'`; in the Neon console's bucket browser, a player's folder holds that player's photos
- each object carries metadata `slug` and `transfermarkt-id` (`x-amz-meta-*`), so an object leads back to its row even when found by itself
- the loader refuses a key whose folder isn't its row's slug, and `npm run images` reports any row with no image

Settled at `/feature load`, 2026-10-29 (D2 and D3 as proposed; D1 with your condition):

- **D1. One 128×128 WebP per image** (approved, **with your condition: never lose the important part, the whole crest and the player's face**). How S18b keeps it:
  - **crest:** never cropped. The whole crest is fitted inside the square (`fit: contain`), aspect kept, on a transparent background; the pilot's are 100×100 already square
  - **photo:** the web crops a centred square and masks it to a circle (`data-display-requirements.md` § 1), so the face must sit in the middle of the square. Transfermarkt's header photos are 139×181 head-and-shoulders portraits with the head in the upper part, so the square is cut from the **top** of the photo, not its centre (dropping shoulders, never the top of the head), then scaled to 128
  - **a per-image override** in `data/curation/images.json` (`top`, `centre`, `bottom`, or a pixel offset), for any photo that still frames the face badly; manual decisions live in curation, never in code
  - **a contact sheet** `data/reports/images.html`: every output as the app draws it, photos in a circle on the dark disc, crests on the dark panel, at the app's sizes, with the source beside it, so you check every face and crest in one page before anything is uploaded
  - Alternative: several sizes per image (more keys, nothing reads them yet)
  - Why 128×128 WebP: the size the web's requirements recommend for both crests and photos (sharp at 3× phones), WebP for size and transparency
- **D2. Only the dataset's clubs and players** (approved): "only the pool is loaded" (`coding-standards-scraper.md` § Data rules), so an image of a player whose match didn't pass the gate is kept on disk but not processed or uploaded. Alternative: every filed image
- **D3. Keys ride in the committed dataset** (approved): `data/dataset/` stays the one input of the loader, and the loader proves each key's object exists in the target bucket before writing. Since keys hash the WebP's bytes, `sharp` is pinned; a new `sharp` that changes the bytes gives new keys, which is safe (new objects, the old ones stay). Alternative: the loader looks the keys up itself at load time, so the dataset never holds them

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

**Deviations recorded during implementation**

- **Stage order: gate → `images` → dataset.** `npm run images` picks the dataset's clubs and players by running the dataset's own pure `buildDataset` on the same sources (their reading moved from `src/dataset/main.ts` to `src/dataset/sources.ts`), so one pass suffices: no dataset build before the images and again after
- **The key-folder rule lives in the dataset schema** (`src/dataset/schema.ts`): a `crestKey` must start `crests/<slug>/` and an `imageKey` `players/<slug>/`. `npm run dataset` refuses to write a mismatch, and the loader's preflight refuses to load one, with no separate check
- **The bucket check** is `checkImages` in `src/load/main.ts` with `src/load/images.ts` (`datasetImageKeys`, `missingImages`): one listing per prefix, run only when the dataset holds a key, behind S17's guard
- **S17's `ObjectStore` grew** `listKeys`, `readMetadata` and metadata on `putObject`; `uploadImage` takes `metadata`. The specs share one in-memory bucket, `src/storage/spec-store.ts`
- `npm run images` takes `--upload`, `--target` and `--confirm` (`src/images/args.ts`); `keys.json` sits in `data/work/images/` beside the files
- **sharp `0.35.5`** pinned (released 2026-09-27). WebP quality 90 with full alpha for crests, 85 for photos, effort 6, metadata stripped. Three runs gave the same `keys.json`, so the same bytes
- **Default crop `top` at first**, checked by Claude on a preview of all 71 masked as the app masks them: every crest whole, every face inside its circle, none cut at the forehead or chin. `data/curation/images.json` starts as `{ "photoCrops": {} }`
- **Default crop changed to `centre`** after your check (2026-10-29): with `top`, 18 photos lost the chin (`ayhan-akman`, `bixente-lizarazu`, `bulent-korkmaz`, `christian`, `fabio-pinto`, `fatih-akyel`, `florent-malouda`, `francesco-totti`, `franck-ribery`, `gennaro-gattuso`, `gianluca-zambrotta`, `hasan-salihamidzic`, `juan-sanchez`, `ogun-temizkanoglu`, `stefan-effenberg`, `tuncay-sanli`, `yusuf-simsek`, `zinedine-zidane`). Compared on all 65: `centre` shows every face whole, the 18 included, and none of the other 47 worse (a little hair lost at most); sharp's `attention` strategy was tried and dropped, as it cut foreheads and missed 3 of the 18. One rule fits because every pilot photo is Transfermarkt's 139×181 header shot
- **Review by exception, not by eye on thousands:** `images.md` lists the photos whose source isn't 139×181 (`STANDARD_PHOTO`), the only ones the centre rule wasn't checked on; you look at those, and the contact sheet stays for spot checks. Pilot: 0 such photos
- **Deferred, your call:** an ML face detector to frame odd photos, once the project is done; nothing in the pipeline depends on it
- No placeholder line in `images.md`: S18a never lists or files a placeholder
- **Pilot run, 2026-10-29:** 6 crests and 65 photos, 0 missing, 0 below the size floor, 344 KB in all. The rebuilt dataset carries all 71 keys; the manifest counts `crests: 6`, `photos: 65`
- 622 TypeScript tests pass, lint and typecheck clean
- **Review fix:** `filedImages` reads each image folder once per run (a map by id), not once per club or player, so 8,000 photos don't mean 8,000 folder reads; keys unchanged, the dry run still finds all 71 in the bucket
- **Pilot upload to `ingest`, 2026-10-29** (Your part 3, with your approval): `npm run images -- --upload` uploaded 71, a rerun 0 (71 already there); `npm run storage` reads `crests: 6`, `players: 65`; the dry-run load passes the bucket check ("images: all 71 in the bucket") and would make 335 changes, nothing written. The keys reach `ingest`'s tables with S20's load
- **`/feature test`:** a case for a photo that isn't 139×181 (it must reach the "check by eye" list); 623 TypeScript and 292 Python tests pass, lint and typecheck clean
- **E2E, 2026-10-29,** on `s18b-e2e` (`br-old-star-b1x3rj28`, from `ingest`, created with your approval; empty tables and an empty bucket checked first): **17 of 17 passed** (the loader's 8, storage's 4, images' 5): 71 uploaded then 0 on a rerun, every dataset key in the bucket, `oliver-kahn`'s object carries `slug` and `transfermarkt-id`, Valencia's crest served publicly as `image/webp` byte for byte, and the loaded rows hold the dataset's keys (no `NULL` key). The real commands agreed: `npm run images -- --upload` gave "uploaded 0, already there 71", and `npm run load` (dry run) printed "images: all 71 in the bucket" with 0 changes to `clubs` and `players`. The branch was kept until after `/feature test`, at your request, then deleted with your approval; only `production`, `dev` and `ingest` remain

## History
