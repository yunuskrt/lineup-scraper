# Link Map

Which pages the project reads, how each one leads to the next, and which database columns each one feeds. Selectors are in `transfermarkt-source.md` § 4, columns in `data-contract.md` § 2, the pool in `match-pool-scope.md`.

Checked against the 8 saved pages in `extract/tests/fixtures/transfermarkt/` on 2026-10-27.

---

## 1. The chain

```text
Config: the pool groups (match-pool-scope.md § 1)       no page; S07 writes the links
 └─ Listing page                                        247 pages                   S07
     │   fixture lists: leagues, CL, EL, World Cup, Euro
     │   ▼ S07 keeps the rows that belong to a group: the pool match list
     └─ Match report  /spielbericht/{id}                one per pool match, ~2,000   S11
         ├─ Club      /verein/{id}                      never saved: id and name come from the pages above
         └─ Player    /profil/spieler/{id}              every starter, once, ~5,000–8,000   S11b

Images (later)        a crest per club, a photo per player, saved by you      S18
```

- **Every page you save is on a list.** A phase writes the list from the pages already saved: S07 from the config, S11 from the pool match list, S11b from the saved match reports. Each line gives the link, the file name to save it as, and the folder (§ 8).
- **Ids join the pages, never names.** A fixture row and its match report share `spielbericht/{id}`; a starter and their profile share `spieler/{id}`; a club is `verein/{id}` everywhere (`transfermarkt-source.md` § 3). S08's crosswalk maps each id to a permanent slug, and the database keeps the id too (§ 7).
- **Player links on the match report:** starters and bench rows link `/{slug}/profil/spieler/{id}`, the profile itself. Event links go to `/leistungsdatendetails/spieler/{id}/…`; the id is the same player.

---

## 2. Listing pages

The match ids of the pool come from fixture lists. The full list is `data/work/link-lists/s07-listings.json`, written from `data/curation/pool.json` by `uv run python -m extract.lists.listings` (S07a); one sample of each unverified pattern is in `s07-verify.json`:

| Page | Link | For | Count | Status |
| --- | --- | --- | --- | --- |
| League fixture list | `/{slug}/gesamtspielplan/wettbewerb/{CODE}?saison_id={YYYY}` | Derbies and clashes | 7 leagues × 26 = 182 | Pattern verified (`IT1`, `TR1`); codes `GB1`, `ES1`, `L1`, `FR1`, `PO1` unverified |
| Cup fixture list | `/{slug}/gesamtspielplan/pokalwettbewerb/{CODE}/saison_id/{YYYY}` | `CL` knockouts, `EL` finals | 26 + 26 | Verified for `CL`; `EL` (and the UEFA Cup years under it) unverified |
| World Cup | `/{slug}/gesamtspielplan/pokalwettbewerb/FIWC/saison_id/{year − 1}` | Knockouts | 6 | Verified |
| Euro | `/{slug}/gesamtspielplan/pokalwettbewerb/EURO/saison_id/{year − 1}` | Knockouts | 7 | Verified (`euro-2003`, saved 2026-10-27; the old `EM04` link redirects here) |

**Fixture list → raw kind `transfermarkt-fixture`**, one record per match row:

| On the page | Raw field | Database | Note |
| --- | --- | --- | --- |
| The page's URL (`og:url`) | `competitionCode`, `seasonId` | `competitions` (by code), `seasons.label`, `start_year` | `2000` → `2000-01`; `FIWC` 2005 → `2006` |
| Match link `spielbericht/{id}` | `sourceId` | `matches.transfermarkt_id`, `matches.slug` (via the crosswalk) | Also the S11 link |
| Last `datum/YYYY-MM-DD` link above the row | `date` | `matches.date` | Never the date text |
| Box headline (`1.Matchday`, `Group A`) | `round` | `matches.stage` | English display text, rewritten by S08 |
| Knockout cell (`QF`, `FI`, `Ro16 3`) | `stage` | `matches.stage`; the group test for knockouts | Wins over `round` |
| Home and away `verein/{id}` links | `home`, `away` | `clubs.transfermarkt_id`, `match_teams.club_id`, `side`; the group test for derbies and clashes | The name seen here becomes a `club_aliases` row |
| Result link text (`2:2`) | `result` | Nothing | The loaded score comes from the match report. On penalties it seems to add the shootout to the score (`6:4 on pens` for a 1:1 won 5:3), where the match report shows the shootout alone (S11 verifies) |

---

## 3. Match report

| | |
| --- | --- |
| Link | `/{home}_{away}/index/spielbericht/{id}` |
| Found from | The pool match list (S07) |
| Count | **~2,000**, one per pool match |
| Raw kind | `transfermarkt-match`, one record per page (`src/raw/transfermarkt-match.ts`) |

| On the page | Raw field | Database | Note |
| --- | --- | --- | --- |
| The URL's `spielbericht/{id}` | `sourceId` | `matches.transfermarkt_id`, `matches.slug` | Same id as the fixture row |
| `p.sb-datum`: round text | `round` | `matches.stage` | Fills the stage if the listing had none |
| `p.sb-datum`: `datum/` link | `date` | `matches.date` | Must agree with the listing |
| `div.sb-endstand` | `result` | `matches.shootout_home`, `shootout_away` | On `on pens` this is the **shootout** score |
| `div.sb-halbzeit` (`(1:0)`, `on pens`, `AET`) | `resultNote` | `matches.extra_time`; half-time score for the comeback signal | |
| `#sb-tore` goal events | `events` (`box: goal`) | `match_teams.goals` (counted), `match_events` (`goal`, `own_goal`, `penalty_goal`) | Kind from the event text; side = the side it counts for |
| `#sb-karten` card events | `events` (`box: card`) | `match_events` (`red_card`) | Yellow cards are dropped |
| `#sb-wechsel` substitutions | `events` (`box: substitution`) | Not stored | Substitutes are never answers |
| Event clock sprite and `+2` | `clock`, `addedTime` | `match_events.minute`, `added_time` | Sprite → minute is unverified |
| `div.sb-team` → `a.sb-vereinslink` | `home.sourceId`, `home.name` (and away) | `match_teams.club_id` | |
| Each side's `p` (`Position: 16`) | `tablePosition` | Stakes signal only | Absent on matchday 1 and in cups |
| `div.formation-subtitle` | `formation` | `match_teams.formation` | Digits only; diamonds mapped (§ 6) |
| 11 × `div.formation-player-container` | `starters[].sourceId` | `players.transfermarkt_id`, `lineups.player_id` | Also the S11b link |
| Its `style` (`top: 80%; left: 40%;`) | `starters[].style` | `lineups.slot`, then `lineups.position` (§ 6) | |
| Its name (`Zidane`, `Kily Gonzá.`) | `starters[].name` | An alias candidate only | **Short and sometimes cut off**: never the display name |
| Shirt number, captain icon | `shirtNumber`, `isCaptain` | Not stored | |
| `table.ersatzbank` | `bench` | Not stored | Full names; a check against the player pages |
| Player photos (`img.a.transfermarkt.technology`) | — | Not parsed | Images are saved by you in S18; licence checked before release |

---

## 4. Player profile

| | |
| --- | --- |
| Link | `/{slug}/profil/spieler/{id}` |
| Found from | The starters of every saved match report, plus goal scorers who came off the bench |
| Count | Every distinct starter in the pool, saved once: **~5,000–8,000** |
| Raw kind | `transfermarkt-player`, one record per page (`src/raw/transfermarkt-player.ts`) |
| Decided | 2026-10-27: every starter's page is saved, since the match report only shows a short name |

| On the page | Raw field | Database | Note |
| --- | --- | --- | --- |
| The URL's `spieler/{id}` | `sourceId` | `players.transfermarkt_id`, `players.slug` | |
| The h1 (`#11 Raphinha`) | `headline` | `players.name`, and an alias | Shirt number stripped; diacritics kept |
| Info table `Full name:` (`Raphael Dias Belloli`) | — (added in S11b) | `player_aliases` | |
| Info table `Name in home country:` | — (added in S11b) | `player_aliases` (transliteration) | Seen on some players; unverified |
| `Date of birth/Age:` | `dateOfBirth` | Not stored | Tells two players with one name apart (S08) |
| `Citizenship:` | `citizenship` | Not stored | Same |
| `Position:` | `position` | Not stored | `lineups.position` comes from the slot, never from here |
| Header `Caps/Goals:` | — (added in S11b) | Star-power signal (S10) | The spec names caps as a star-power input |
| Portrait | — | Not parsed | Same: S18 |

---

## 5. Club page

| | |
| --- | --- |
| Link | `/{slug}/startseite/verein/{id}` |
| Saved | **No** |

| Column | From |
| --- | --- |
| `clubs.transfermarkt_id`, `clubs.slug` | The `verein/{id}` on listing pages and match reports |
| `clubs.name`, `short_name` | `data/curation/` (Transfermarkt's `FC Bayern Munich` becomes an alias) |
| `clubs.kind` | The competition: a side in a World Cup or Euro is a `national_team` |
| `club_aliases` | Every name the listing pages and match reports used for that id |
| `clubs.crest_key` | S18: an image you save |

---

## 6. Pitch placement

Each starter is drawn on the line Transfermarkt shows them on, in the same order. Two columns carry it, with no extra table:

| Column | Holds | From |
| --- | --- | --- |
| `match_teams.formation` | The lines, defence to attack: `4-4-2` | `div.formation-subtitle`; diamonds mapped (`4-4-2 Diamond` → `4-1-2-1-2`) |
| `lineups.slot` | 0–10: 0 is the goalkeeper, then each line from defence to attack, each line right to left | The starter's `top` and `left` on Transfermarkt's pitch (`transfermarkt-source.md` § 5) |

So in a 4-4-2 the goalkeeper is slot 0, the back four are 1–4 (right back first), and the two strikers are 9–10 at the front. The web draws slots in exactly that order (`data-display-requirements.md` § 3). Transfermarkt's exact x positions aren't kept: the web spaces each line evenly.

`lineups.position` follows from the two: `positionForSlot(formation, slot)` (`data-contract.md` § 6.6).

---

## 7. Where each column comes from

| Column | Page |
| --- | --- |
| `competitions.*` | Config and curation, keyed by the listing's competition code |
| `seasons.*` | Listing page URL |
| `clubs.transfermarkt_id`, `slug`, `club_aliases` | Listing page, match report |
| `clubs.name`, `short_name`, `kind` | Curation, competition kind |
| `players.transfermarkt_id`, `slug` | Match report |
| `players.name` | **Player profile** |
| `player_aliases` | Player profile (h1, full name), match report (short name), curation |
| `matches.transfermarkt_id`, `slug`, `date`, `stage` | Listing page, confirmed by the match report |
| `matches.extra_time`, `shootout_*` | Match report |
| `matches.nickname` | `data/curation/` (optional; Wikipedia isn't a pipeline source) |
| `match_teams.*`, `lineups.*`, `match_events.*` | Match report |
| `memorability_scores` | Computed (S10) from all of the above |
| `clubs.crest_key`, `players.image_key` | S18: images you save, uploaded to the bucket |

The `transfermarkt_id` columns don't exist yet: they are backend request R1 (`backend-requests.md`).

---

## 8. Saving and tracking (S06c)

| Tool | What it does |
| --- | --- |
| Link list, `data/work/link-lists/<list>.json` | The full list, written by the phase that finds the links (`extract.links.write_link_list`). One entry per page: `url`, `kind`, `key`, `saveAs` (`match-53491.html`), and optional `group`, `competition`, `season`. Each page once |
| To-save list, `data/work/inbox-lists/<list>.md` | `uv run python -m extract.links show <list>`: only what's still to save, with the link, the file name and the folder (`data/inbox/`). Pages in the inbox but not imported are marked |
| `extract.links new <list> <link>...` | Makes a list by hand |
| `extract.links open <list> [--count N]` | Opens the next N unsaved links in your own browser (default 5). It never requests a page itself |
| `extract.inbox` | Parses everything in `data/inbox/` and files it under `data/pages/transfermarkt/<kind>/<id>.html` |
| Import log, `data/work/import-log.ndjson` | One line per inbox file: `at`, `file`, `url`, `kind`, `key`, `result` (`imported`, `duplicate`, `refused`), `reason`, `records`, `backfilled`. Never page text. The dashboard's history. `extract.inbox --backfill-log` adds pages imported before the log |
| `extract.progress [<list>...] [--by group\|competition\|season] [--json]` | Per list: imported, parsed, in the inbox and missing, as `23/1000 (2.3%)`; pages imported but not parsed |
| `extract.check <link \| kind:key>` | For one page: its lists, the inbox file, the stored page, its records and its log lines. Exit 0 once parsed |
| Dashboard (S19) | A local app with all of the above: progress, history, failures, and buttons for each step (`enrichment-guide.md` § 6) |

The loop that uses them is `enrichment-guide.md` § 2.

---

## 9. Unverified

- A fixture row's result on penalties (shootout added to the score?)
- The codes `GB1`, `ES1`, `L1`, `FR1`, `PO1` and `EL`: one sample each in `s07-verify`
- The clock sprite → minute rule
- How the event text marks an own goal and a penalty
- The `Name in home country:` label on player pages
