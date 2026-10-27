# Phase S07a — Pool Config & Listing Links

## Status

Complete

## Goals

- **Pool config** `data/curation/pool.json`, the groups of `docs/match-pool-scope.md` § 1–2 as data, never code:
  - `competitions`: each with its Transfermarkt code (`GB1`, `ES1`, `IT1`, `L1`, `FR1`, `PO1`, `TR1`, `CL`, `EL`, `FIWC`, `EURO`), its `kind` (`league`, `ucl`, `uel`, `world_cup`, `euro`), its seasons (`saison_id` values, 2000–2025; World Cups 2001–2021 and Euros 1999–2023, since both use `saison_id` = year − 1) and whether its link is verified
  - `clubs`: the 24 curated clubs, each with its Transfermarkt `verein` id and league code. **Every id is taken from a saved page** (the 8 fixtures, the S07 pages), never from memory. An id no saved page shows yet stays `null` and is reported
  - `derbies`: the 7 pairs, by club id
  - `knockoutStages`: the stage prefixes each group keeps: `QF`, `SF`, `FI` for the Champions League; `FI` for the UEFA Cup / Europa League; `Ro16`, `QF`, `SF`, `FI` (and `FI 3rd`) for World Cups and Euros. Taken from the saved pages: `cl-2000`, `cl-2023` and `fiwc-2005` carry `QF 1`, `SF 2`, `FI`, `FI 3rd`, `Ro16 3`
- **Its schema** in `src/pool/config.ts` (Zod), exported to `schemas/curation/pool.schema.json` by `npm run schemas`, beside the raw schemas. Python reads the config only through that schema (`jsonschema`, already a dependency). Ids are digit strings; every derby club and every league code must exist in the config
- **Listing link list** `extract/lists/listings.py`, run as `uv run python -m extract.lists.listings`. It reads the config and writes `data/work/link-lists/s07-listings.json` with `write_link_list` (S06c), each entry tagged `group` and `competition` and `season`:
  - The Champions League and UEFA Cup / Europa League fixture lists, every season (26 + 26)
  - The World Cup (6) and Euro (7) fixture lists
  - For derbies and clashes, the league fixture lists, 7 leagues × 26 seasons = 182 (D1). Their link pattern is proven by `it1-2000`; only the codes `GB1`, `ES1`, `L1`, `FR1`, `PO1` and `TR1` are unverified
  - Unverified link patterns are tagged `group: unverified-<code>` in a second list, `s07-verify.json`, so the first saved page of each settles it
- **Pilot list** `data/work/link-lists/s07-pilot.json`: the 2 pages of `## Your part`
- **Tests:** `test_listings.py` (one entry per season and competition, tags, unverified links in their own list, a `null` club id reported); `src/pool/config.spec.ts` (the config file passes; a derby with an unknown club, a non-digit id, a season outside 2000–2025 fail)
- **Docs:** `link-map.md` § 2 and § 9 record what the saved pages verified; `transfermarkt-source.md` § 2 adds the codes that were verified

## Your part

👤 2 pages, about 5 minutes, after `/feature start`, from the `s07-pilot` list.

1. Run `uv run python -m extract.links open s07-pilot`. It opens:
   - The 2002–03 Süper Lig fixture list (the pilot derby, decision D2): https://www.transfermarkt.com/super-lig/gesamtspielplan/wettbewerb/TR1?saison_id=2002
   - The Euro 2004 fixture list, to verify the Euro link: https://www.transfermarkt.com/europameisterschaft-2004/gesamtspielplan/pokalwettbewerb/EURO/saison_id/2003 (the old `EM04` link redirects here; checked by the user on 2026-10-27)
2. Save each into `data/inbox/` under the name the command prints, then run `uv run python -m extract.inbox`
3. If a page shows an error or "not found" instead of fixtures, say which. No other link is guessed

## Decisions

Settled at `/feature load`, 2026-10-27:

- **D1. How the league groups are listed: league season fixture lists** (decided 2026-10-27). Head-to-head pages are dropped: their link pattern couldn't be confirmed without a saved sample, and the fixture-list pattern is already proven by `it1-2000`. 182 league pages
- **D2. The pilot derby: Fenerbahçe 6–0 Galatasaray, `spielbericht/1118844`** (chosen by the user, 2026-10-27). The saved `tr1-2002` list gives it: `2002-11-06`, `6.Matchday`, result `6:0`, home `36` (Fenerbahçe), away `141` (Galatasaray). Its match report is saved in S11
- **D3. The Euro code: `EURO`, with `saison_id` = tournament year − 1** (decided 2026-10-27). The user's browser redirected `…/pokalwettbewerb/EM04` to `…/pokalwettbewerb/EURO/saison_id/2003`, as `WM06` went to `FIWC/saison_id/2005`. Euro 2000 is therefore `saison_id` 1999: the config accepts 1999 for that tournament only, while its season label stays `2000`. The saved page confirms it: `euro-2003` has 31 rows, stages `QF`, `SF` and `FI` without leg numbers

## Out of Scope

- The pool match list from the saved listing pages: **S07b**
- Saving the whole listing list (~247 pages): that's your enrichment, after S20. S07 saves only the pages in `## Your part`
- Slugs, competitions and seasons as database rows: **S08**
- Match reports and their link list: **S11**

## Notes

- Scope: the pool as config, and every listing link the pool needs. Python writes the lists; the config's schema is Zod.
- Depends on: S06c (`write_link_list`, `extract.links`), S06b (the fixture parser, the import).
- From `match-pool-scope.md` § 5: S07 uses § 1 (the groups) and § 2 (clubs and pairs). Seasons 2000–01 to 2025–26; World Cups 2002–2022; Euros 2000–2024. **The 2026 World Cup is out** (`start_year` 2026 is refused by the database). Domestic cups, the Club World Cup and the Conference League are out (no `competition_kind`).
- Constraints:
  - Key every club on its numeric `verein` id; never on a name (`transfermarkt-source.md` § 6, pitfall 10)
  - No id, date or score from memory or an LLM: ids from saved pages only
  - Never fetch Transfermarkt with code; `extract.links open` hands links to your browser
  - `data/curation/pool.json` is committed; the link lists under `data/work/` are not
- Verification: `uv run pytest`, `ruff`, `mypy`, `npm test`, `npm run lint`, `npm run typecheck`. On the real store: `extract.progress s07-listings s07-pilot` shows the pilot pages imported and the full listing count

**Deviations recorded during implementation**

- **22 curated clubs, not 24.** `match-pool-scope.md` § 2.2 lists 22 (6+3+3+2+3+2+3), and its 29 pairs need exactly those; its "24 clubs" line is corrected. The goal's "24" stays as written
- **4 club ids are `null`:** Liverpool, Chelsea, Tottenham and Marseille appear on no saved page yet. The other 18 come from `cl-2000`, `cl-2023`, `it1-2000`, `tr1-2002` and the match reports. `extract.lists.listings` names the 4 on every run
- **Clubs carry a config `key`** (`fenerbahce`), so a derby can name a club whose id is still `null`. It isn't a database slug; S08 makes those
- **Seasons are `{first, last, step}`**, not a list: leagues and European cups 2000–2025 step 1, World Cups 2001–2021 and Euros 1999–2023 step 4
- **Refinements stay in Zod:** the JSON Schema export drops them, so Python (`extract/pool_config.py`) checks the shape only, and `src/pool/config.spec.ts` checks the committed file against every rule. `npm run schemas` now also writes `schemas/curation/pool.schema.json`
- **`group` tags join a competition's groups** (`derbies+clashes`, `ucl-knockouts+derbies`), since one fixture list serves several groups
- **`TR1` and `EURO` are verified** by the two saved pages; `s07-verify` holds one sample each for `GB1`, `ES1`, `L1`, `FR1`, `PO1` and `EL`
- **URL slugs aren't checked:** the saved `tr1-2002` page reports `/x/gesamtspielplan/…` as its own address, so Transfermarkt seems to ignore the slug; the key comes from the code and `saison_id`
- The pilot pages are a constant in `extract/lists/listings.py` (`PILOT_PAGES`), from D2 and D3
- Real store, 2026-10-27: `s07-listings` 247 pages, 6 imported (`it1-2000`, `cl-2000`, `cl-2023`, `fiwc-2005`, `tr1-2002`, `euro-2003`); `s07-pilot` 2/2 imported and parsed
- Review: the Python set of World Cup and Euro kinds is `YEAR_BEFORE_KINDS`, not `TOURNAMENT_KINDS`, which the data contract (§ 8) uses for the pool's list with `ucl`

## History

- 2026-10-27: pool.json (22 clubs, 18 ids), schema, 247 listing links, verify and pilot lists
