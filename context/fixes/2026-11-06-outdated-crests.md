# Fix — Outdated Crests

## Status

Complete

## Goals

Six clubs show an old crest in the apps: Paris Saint-Germain, Olympique Marseille, Arsenal, Juventus, Galatasaray and Rangers FC. Found by the user on the web client on 2026-11-06. The crests aren't wrong. These clubs have changed their crest since, and the pool runs to 2026.

**Why:** Transfermarkt shows in each match report the crest the club had on that date: a stamped file (`583_1402764257.png`), or the bare `583.png` for today's crest (`transfermarkt-source.md` § 4). `general.csv` lists each crest once, from the first match block that names the club, and the blocks start in the earliest era. So these clubs got a 2000–05 crest. 49 of the 100 crest links were stamped.

| Club (id) | Pool matches | Filed crest (seasons it covers) | Today's crest seen in reports |
| --- | --- | --- | --- |
| Paris Saint-Germain (583) | 126 | `583_1402764257` (2000–01) | `583.png` (2024→) |
| Olympique Marseille (244) | 104 | `244_1403786064` (2000–04) | `244_1775674950` (2004–26); `244.png` on club pages |
| Arsenal (11) | 276 | `11_1400911976` (2000–01) | `11.png` (2012→) |
| Juventus (506) | 125 | `506_1498891796` (2005–17) | `506.png` (2021→) |
| Galatasaray (141) | 106 | `141_1751657220` (2001–07) | `141.png` (2007→) |
| Rangers FC (124) | 1 | `124_1654071183` (2022, its only report) | `124.png` on player pages |

- **The 6 crests:**
  - the user chooses one link per club from the alternatives (today's crest at 100×100 or the larger `head` size, or the newest stamped version) and saves it as `crest-<id>.png`
  - `extract.inbox` replaces the filed crest (logged `replaced the filed image`)
  - `npm run build` keys it anew (`crests/<slug>/<sha256-12>.webp`); a key's bytes never change
  - upload, then load: 6 `clubs.crest_key` updates; `verify` passes
- **The cause, in the tracker** (`extract/tracker.py`):
  - `newest_crests(reports)`: each club's crest URL from its newest saved report
  - `general_pages` passes it to `match_block`, so a crest row keeps its place (the first block naming the club) but links today's crest
  - the S18a list (`extract.lists.images`) already did this
- **The old objects:** the 6 replaced crest objects are deleted from `ingest`'s bucket after `verify` passes (D2)
- **Tests:** a club in two reports lists the newer report's crest
- **Docs:** `transfermarkt-source.md` § 4 (what the stamp means), `enrichment-guide.md` § 6 (replacing an outdated crest), `manual-work.md` (a row)

## Your part

1. **Choose and save 6 crests:** open the alternatives (in the chat on 2026-11-06), choose one per club, and save it into `data/inbox/` as `crest-<id>.png` (`crest-583.png`, `crest-244.png`, `crest-11.png`, `crest-506.png`, `crest-141.png`, `crest-124.png`). A stamped file (`583_1522053508.png`) may keep its own name. A crest from another source works too, under the same name. ~5 min
2. **Check them** on the dark page in `data/reports/images.html` after the build
3. **Approve** the upload to `ingest`'s bucket, the load into `ingest`, and the deletion of the 6 old objects
4. **Approve the commit** at the end

## Decisions

- **D1 (2026-11-06):** fix the tracker too, so clubs saved later get today's crest. The other crests stay as filed
- **D2 (2026-11-06):** delete the 6 replaced crest objects after the load. An exception to S17's "nothing is deleted", for these 6 keys only, each confirmed before it's deleted

## Notes

- Scope: the 6 crests and the tracker's crest link. Not in scope: the other 27 clubs whose `general.csv` link now differs from the crest filed (below); re-saving them is the user's choice
- Constraints:
  - Never fetch Transfermarkt with code; the user saves every crest
  - Python never writes to the bucket; TypeScript uploads, the Neon MCP deletes on D2, with confirmation
  - Comments at most 50 characters
- Verification:
  - `uv run pytest`, `uv run ruff check`, `uv run mypy extract`
  - `npm run status`: crest links change, statuses don't
  - after the saves: the import replaces 6 crests; `npm run build`; `npm run images -- --upload` uploads 6; the dry run shows 6 club updates and nothing else; `--apply`; `npm run verify`; a rerun of the dry run shows 0 changes
- **The other 27 clubs whose crest link changed** (2026-11-06): argentina, atletico-madrid, bayern-munich, belgium, besiktas, england, fenerbahce, france, germany, inter, italy, liverpool-fc, lyon, netherlands, porto, real-madrid, republic-of-ireland, romania, russia, south-korea, spain, sweden, tottenham-hotspur, united-states, valencia, villarreal-cf, wales. A changed link may still be the same picture uploaded again

**Deviations recorded during implementation**

- **Real data, 2026-11-06:** `npm run status` after the tracker fix: 9,681 rows, 32 crest links changed, all 100 crests still `ingested`. Rangers keeps its link (one report); Marseille now links `244_1775674950`, not the bare `244.png`, because its reports show the stamped file to 2026
- **The saves:** all 6 came from the `head` links: 139×181 WebP saved under a `.png` name. The importer sniffs the bytes, so each was filed as `<id>.webp` and the old `<id>.png` removed
- **Juventus:** its crest is now a black J that nearly vanishes on a dark surface (the old 2005–17 oval didn't). The user kept it as it is; there is no crest style like `logoStyles`
- **Loaded, 2026-11-06:** new keys `crests/arsenal/f1fd90f1cbf6`, `galatasaray/14239725ef58`, `juventus/9bdca76a3a84`, `olympique-marseille/a6098f8c38e3`, `paris-saint-germain/ccfdabf4edf4`, `rangers-fc/0bc7f87c87f0` (`.webp`). Upload 6 (3,725 skipped); dry run 6 club updates, 0 played matches affected; `--apply` wrote 6 rows; `verify` passes on 1,925 matches; dry-run rerun 0 changes
- **D2 done:** the 6 old objects were deleted with the Neon MCP after the user confirmed the list; no row pointed at them. The bucket holds 100 crests again; the old URLs return 404, `verify` still passes
