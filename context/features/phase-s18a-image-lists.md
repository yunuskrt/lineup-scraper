# Phase S18a — Image Lists & Import

## Status

Complete

## Goals

- **Image URLs in the raw records**, read from pages already saved (no new page to save):
  - `transfermarkt-player`: `imageUrl`, the header photo's `src` (`img.data-header__profile-image`, `…/portrait/header/<id>-<stamp>.jpg`); `null` when the page shows Transfermarkt's placeholder (`…/default…`)
  - `transfermarkt-match`: `crestUrl` on each side, that club's square crest (`…/wappen/normquad/<clubId>_<stamp>.png`); `null` when missing or a placeholder
  - Schemas in `src/raw/transfermarkt-player.ts` and `src/raw/transfermarkt-match.ts`, `npm run schemas` regenerates `schemas/raw/`; parsers in `extract/parsers/transfermarkt/player.py` and `match.py`, tested on the saved fixtures; `uv run python -m extract.inbox --reparse` refills `data/raw/`
- **Image link lists** `extract/lists/images.py`, `uv run python -m extract.lists.images`:
  - `s18-images`: the crest of every club in a saved match report of a pool match, and the photo of every player with a saved profile, each once
  - `s18-pilot`: the pilot's 6 crests and 65 photos
  - Same shape as the other lists (`extract/links.py`, `data/work/inbox-lists/`): link (the image URL itself), save-as name, folder `data/inbox/`, status from what's already imported. Clubs and players with no image URL are listed apart, as "no image on Transfermarkt"
- **Save-as names:** `crest-<clubId>.<ext>` and `player-<playerId>.<ext>`, where `ext` is the source's (`png`, `jpg`). With D1, the browser's own names are also accepted: `<clubId>_<stamp>.png` is a crest and `<playerId>-<stamp>.jpg` a photo, so nothing needs renaming
- **Import** in `extract/inbox.py` (`uv run python -m extract.inbox`, as for pages):
  - an image file in `data/inbox/` is recognised by its name, checked by its first bytes (PNG, JPEG, WebP, or SVG text), and filed as `data/images/transfermarkt/crest/<clubId>.<ext>` or `…/player/<playerId>.<ext>` (D2)
  - each file gets an `import-log.ndjson` line (kind `crest` or `player`, id, size, result)
  - refused and listed, never filed: an unknown name, a file that isn't an image, an empty file, an HTML page saved by mistake under an image name
  - the same bytes again are a duplicate; different bytes for an id already filed replace it, and the log keeps both lines
- `extract/data_dirs.py` gains `images`; `.gitignore` gains `data/images/`
- `extract.progress` and `extract.check` count images too (saved, still to save)
- **Docs:** `CLAUDE.md` § Commands, `manual-work.md` rows S18a and S18b, `link-map.md` (the image URL patterns), `transfermarkt-source.md` (the two selectors)

## Your part

1. After `/feature start`, once the list exists: open `data/work/inbox-lists/s18-pilot.md`. It has **71 links: 6 crests and 65 photos**
2. Open each link in your browser; it shows the image alone. Save it with **⌘S** (Ctrl+S) into **`data/inbox/`**. With D1 the browser's own file name is fine; otherwise use the name in the list's "Save as" column
3. Run `uv run python -m extract.inbox`. It files every image and lists anything it refused, such as a page saved by mistake, so you can save that one again
4. About 20 minutes in all. These images are for development only, like the pages: each one's licence is checked before release

## Decisions

Settled at `/feature load`, 2026-10-29:

- **Your requirement (all of S18):** the link between a `players` or `clubs` row and its image must never be lost: from a row, you can find its image in the bucket at a glance, and back. S18a keeps it by filing every image under its Transfermarkt id, the same id as the row's `transfermarkt_id`; S18b carries it into the bucket (see its § Decisions)
- **D1. Accept the browser's own file names** (you left naming to Claude; chosen as proposed). Transfermarkt's image URLs already end in the id (`27_1400571853.png`, `206-1663667692.jpg`), so ⌘S saves a name the importer can read: 71 saves with no renaming. The list's "Save as" name works too. Alternative: only the list's names (`crest-27.png`), one rename per image
- **D2. Images stay local, in `data/images/` (gitignored)** (approved), like `data/pages/`: they are the user's saved copies, needed to rebuild or upload again, and too many to commit (about 8,000 for the whole pool). Alternative: commit them, so another laptop can rebuild without saving them again

## Notes

- Scope: Python only, plus the raw schema change it needs: URLs in the records, the lists, and filing what the user saves. No resizing, no key, no upload: that is S18b
- Depends on: S17 (the key scheme S18b will use), S11 and S11b (the saved match reports and profiles)
- Constraints:
  - **Never fetch Transfermarkt with code**, its image server (`img.a.transfermarkt.technology`) included: the user saves each image (`transfermarkt-source.md` § 8)
  - Key every image on the Transfermarkt id, never on a name
  - Raw text stays raw: URLs are stored as found, query string included; the list may drop the query
  - Python never touches the bucket
  - Every record is validated against `schemas/raw/` before it is written
- Verification: `uv run pytest` (parsers on the saved fixtures; the importer on small image files in `extract/tests/fixtures/`), `uv run ruff check`, `uv run mypy extract`, `npm test` (the regenerated schemas); then the pilot list, your saves and an import with 71 filed and 0 refused

**Deviations recorded during implementation**

- **Image kinds are `crest` and `photo`**, and photos file under `data/images/transfermarkt/photo/`, not `player/`: `player` is already a page kind, and the log, `extract.check` and the lists would otherwise mix a player's page with their photo. The save-as name is `photo-<id>`, not `player-<id>`
- **Images are page kinds** in `extract/pages.py`: `classify` knows the image host, so `extract.links show|open`, `extract.progress` and `extract.check` (`crest:27`) work on image lists unchanged. A filed image counts as `parsed` (nothing to parse). The name, format and filing rules live in `extract/images.py`
- **A second photo URL form**, `s_<id>_<clubId>_<date>_<n>.jpg`, is a real photo, not a placeholder: 7 of the pilot's 65 use it (`7573`, `7438` …). The parser and the importer accept it, and the browser's name for it reads back
- **A bare `<id>.png`** (Fenerbahçe's crest is `36.png`) can't say crest or photo, so the list names it `crest-36.png`, and the importer refuses a bare name with that fix in the reason. In the pilot list only that one needs renaming
- **One crest per club, from its newest report:** Galatasaray shows `141_1751657220.png` (2002) and `141.png` (2023); the list takes the newest
- **Photos are of pool starters** with a saved profile (as `s11b-players`), not of every saved profile: 66 profiles are saved, 65 of them are pilot starters
- **Formats:** PNG, JPEG, WebP and SVG, read from the first bytes; the file is filed under the format it really is (`photo-411295.jpg` holding PNG bytes is filed `.png`). GIF is refused
- **The log line has no size:** `import-log.ndjson` keeps its shape (ids and outcomes only). An image line has `kind` `crest` or `photo`, `key` the id, `url` null, `records` 0, and `reason` `replaced the filed image` when new bytes replace a filed image
- `extract.lists.images` also writes the to-save Markdown (`data/work/inbox-lists/s18-*.md`) at once
- **Raw examples** (`schemas/raw/examples/`) gained the two fields, plus two invalid cases (a crest URL with no scheme, a missing image URL). `--reparse` ran on 2026-10-29: 6 fixture, 5 match, 66 player pages; the rebuilt stages left `data/dataset/` byte-identical
- **Pilot list, 2026-10-29:** `s18-pilot` has 71 links (6 crests, 65 photos), and so has `s18-images`, since only the pilot's reports are saved so far
- **Review fixes:** the importer looks up only the one id it files (`stored_image`), not the whole image folder per file, so a batch stays fast at 8,000 images; an SVG that starts `<!DOCTYPE svg` is no longer mistaken for an HTML page
- **Tests added at `/feature test`:** `extract.progress` counts images (filed, in the inbox, missing; none "unparsed"), `extract.check crest:36` reports a filed image and exits 0, and an import with no images folder leaves images in the inbox. 292 Python and 590 TypeScript tests pass
- **Your saves, 2026-10-29:** all 71 recognised in `data/inbox/`; `extract.inbox` filed 6 crests (PNG, 100×100) and 65 photos (JPEG, 139×181), 0 refused, 71 log lines; `extract.progress s18-pilot` reads 71/71. Every size clears S18b's floor (64 px crest, 80 px photo)

## History
