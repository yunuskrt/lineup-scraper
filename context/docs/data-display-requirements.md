# Data Display Requirements — for lineup-scraper

What the web client needs from the real match data and images: where each field shows, how big it renders, and what breaks it.

**Source:** this repo's components and Zod schemas, on `main` after W31 (`9772071`), not the mock's values. The sizes were measured in Chrome with the app's own fonts (Inter and Archivo, Latin and Latin Extended subsets) at four viewports:

- 360×740, a small phone
- 390×844, a phone
- 1024×768, a small laptop
- 1440×900, a desktop

**Field names** follow the API contract (`context/docs/contract.md`): `ClubRef.crestUrl`, `RevealedPlayer.imageUrl`, and so on. The scraper's output reaches the web through the backend, so these are the shapes the backend must serve.

---

## 1. Images

Both image fields are `string | null`.

**A URL must be absolute `http(s)`** (`https://cdn…/x.webp`) **or a root-relative path** (`/x.svg`). Anything else fails the web's schema, and the web then drops the whole payload, not just the image:

- no scheme (`cdn.example.com/x.png`)
- protocol-relative (`//cdn…`)
- `data:`
- an empty string

The web loads each URL as is, straight from the CDN: `next/image` with `unoptimized`, so there's no resizing proxy.

### Where they render

| Field | Where | Rendered box, 1× | 2× | Shape and crop | Background behind it |
| --- | --- | --- | --- | --- | --- |
| `crestUrl` | Game header, both clubs, on `/play/solo` and `/play/duel` | **24×24** drawn area below 640 px viewport width; **32×32** at 640 px and up | 48×48; 64×64 | Square box, 4 px rounded corners. `object-fit: contain`: the whole crest shows, aspect kept, letterboxed | **Transparent:** the panel shows through (`surface-raised`, #121A15, near-black green) |
| `imageUrl` | Squad grid slot, once the player is named | **20×20** while the pitch is under 480 px wide; **32×32** at 480–559 px; **40×40** at 560 px and up. In a duel a 2 px ring in the finder's colour takes the inside down to **16 / 28 / 36** | 40, 64, 80 (duel: 32, 56, 72) | Circle. `object-fit: cover`: a centred square crop, then masked to a circle | **The disc colour,** `surface-raised` (#121A15), inside a `surface-card` slot (#1A241E) |
| `imageUrl` | Squad grid slot on the solo summary, for a player you missed (Pro summaries only) | Same as above | Same | Same, at 60% opacity | Same disc, inside a `surface` slot (#0A0F0C) |

No other surface shows an image: not the lobby, the result cards, the profile or the filters.

**The crest box sizes against the viewport.** The 640 px breakpoint is where the full club name appears too.

**The headshot disc sizes against the pitch, not the viewport.** The pitch is as wide as the canvas allows, at a 5:6 aspect. Measured pitch widths and the disc each gives:

| Viewport | Pitch width | Headshot disc |
| --- | --- | --- |
| 360×740 | 267 px | 20 |
| 390×844 | 340 px | 20 |
| 768×1024 | 417 px | 20 |
| 1024×768 | 495 px | 32 |
| 1440×900 | 605 px | 40 |

### Formats, background and fallbacks

| Question | Crest | Headshot |
| --- | --- | --- |
| SVG | **Works,** as a plain `<img>`; it must be served as `image/svg+xml`. Scripts in it never run | Works, but a photo is the usual case |
| PNG | Works | Works |
| WebP | Works | Works |
| Transparency | **Expected.** Nothing is painted behind a loaded crest, so a crest with a white or coloured square background shows as that square on the dark panel. A dark crest on a transparent background can be hard to see on #121A15 | Optional. A transparent PNG shows the dark disc behind it. A photo is cropped to a centred square, so the face must be centred; a tall portrait loses its top and bottom |
| Smallest source that stays sharp | **64×64** (2× the 32 px box) | **80×80** (2× the 40 px disc) |
| Recommended export | SVG; otherwise a square 128×128 transparent PNG or WebP. That covers 3× phones too (24 × 3 = 72) | A square 128×128, face centred |
| URL is `null` | The club's `shortName` in 12 px semibold Inter, muted, on `surface-card` (#1A241E) inside the same box. It truncates with an ellipsis (§ 2) | The player's initials in 12 px semibold Inter, muted, on the disc: the first letter of the first and last words, e.g. "Jasper van der Linde" → **JL**, "Tavinho" → **T** |
| The image fails to load (404, CORS, bad type) | The same fallback as `null`, at once. It's tried once per URL; a different URL tries again | The same fallback as `null` |

**Measured fallback limits:**

- **Crest fallback:** the text area is **24 px wide below 640 px** and 32 px above. "NGU" measures 27 px in that font, so on phones it shows as "NG…"; "YLD" (24 px) just fits.
- **Headshot fallback in a duel on a phone:** the inside of the ring is **16 px**. "GP" measures 16 px exactly; wider pairs such as "MW" are clipped at the circle's edge.

---

## 2. Text lengths

**Overflow behaviours:**

- **Truncate:** one line, cut with "…".
- **Wrap:** more lines.
- **Clamp:** wraps to two lines, then cut with "…".

Nothing shrinks its font to fit.

**Character counts** are for typical mixed-case text in that font, from the measured average glyph widths:

| Font | Average per character |
| --- | --- |
| Archivo 600, 20 px | 9.3 px |
| Archivo 600, 16 px | 7.5 px |
| Inter 400, 14 px | 6.7 px |
| Inter 500, 14 px | 7.1 px |
| Inter 500, 12 px | 6.1 px |
| Inter 600, 12 px | 5.9 px |

Capitals and W/M run wider, so treat the counts as an upper bound.

| Field | Where it shows | Font | Fits at 360 / 390 px (phone) | Fits at 1440×900 (desktop) | On overflow |
| --- | --- | --- | --- | --- | --- |
| `ClubRef.name` | Game header, below 640 px: **not shown** (the `shortName` is) | — | — | — | — |
| `ClubRef.name` | Game header, 640 px and up | Archivo 600 20 px | n/a | **259 px ≈ 27 characters.** Tighter at 640 px (171 px ≈ 18) and 1024 px (179 px ≈ 19). "Atlético Castellmar" (175 px) truncates at 640 and fits from 1024 | Truncate |
| `ClubRef.name` | Solo side pick ("Home" / "Away" choice buttons), `/play` club filter chips, a screen-reader line ("You're naming …'s starting XI.") | Inter 600 / 500 14 px | No limit | No limit | Wrap |
| `ClubRef.name` | Profile stats, "Favourite club" | Archivo 600 20 px, right-aligned | No limit | No limit | Wrap, breaking long words |
| `ClubRef.shortName` | Game header, below 640 px | Archivo 600 16 px | **46 px ≈ 4 capitals at 360; 61 px ≈ 5 at 390** ("ABCD" 46, "ABCDE" 57) | Not shown | Truncate |
| `ClubRef.shortName` | Crest fallback when there's no crest (§ 1) | Inter 600 12 px | **24 px: about 3 narrow capitals;** "NGU" truncates to "NG…" | 32 px: 3 capitals ("NGU" 27, "WWW" 37 doesn't fit) | Truncate |
| `ClubRef.shortName` | Profile history row scoreline, "NGU 3–2 RSO" | Archivo 600 16 px | 3-letter codes fit at 390 (104 px); 360 wasn't measured | Fits (112 px) | Truncate |
| `CompetitionRef.name` | Game header line two, beside the date | Inter 400 14 px | **≈ 86 px ≈ 12 characters at 360; ≈ 116 px ≈ 17 at 390,** next to a short date such as "25 May 2005". A long month ("25 September 2005") takes about 40 px more | ≈ 590 px ≈ 87 characters | Truncate |
| `CompetitionRef.name` | Profile history subtitle (with stage and nickname, below), `/play` competition chips, the duel lobby's filter summary | Inter 14 px | Subtitle: see that row. Chips and lobby: no limit | — | Subtitle: truncate. Chips and lobby: wrap |
| `stage` | **Profile history subtitle only,** appended after the competition with its first letter lowercased: "Continental Champions Cup semi-final" | Inter 400 14 px | Part of the subtitle row | Part of the subtitle row | Truncate, as part of the subtitle |
| `nickname` | **Profile history subtitle only,** as a prefix: "The Comeback at Northgate: Continental Champions Cup semi-final, 3 May 2005" | Inter 400 14 px | **The whole subtitle gets 263 px ≈ 39 characters at 390** | **494 px ≈ 73 characters** | Truncate; the full text is in a hover tooltip (`title`) |
| `season` (`"2004-05"` or `"2006"`) | **Not shown anywhere.** The era filter shows its own labels ("2004–05"), built from the catalog's start years | — | — | — | — |
| `RevealedPlayer.name` | Squad grid slot, under the headshot | Inter 500, **12 px while the pitch is under 480 px wide, 14 px above** | Per line: **52.7 px ≈ 8 characters at 360; 68.8 px ≈ 11 at 390.** Two lines in all, so ≈ 16 / 22 | Per line: **127 px ≈ 18 characters**, two lines ≈ 36 | Clamp to 2 lines. Breaks at spaces and hyphens, then mid-word if one word is longer than a line |

**These player-name widths are for a formation whose widest line is 4** (4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-4-3, 3-4-1-2, 4-1-2-1-2). A widest line of 5 (3-5-2, 5-3-2) makes every slot narrower: about 42 px at 360, 55 at 390 and 103 at 1440. A widest line of 6 makes them narrower still.

**The tightest real case is a 640–1023 px window,** where the rail sits beside a smaller pitch: 62.9 px per line at 640.

**How long names fared** (lines needed; anything over 2 is cut with "…"):

| Name | 360 | 390 | 640 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| Tavinho | 1 | 1 | 1 | 1 | 1 |
| Oğuzhan Şimşek | 2 | 2 | 2 | 2 | 1 |
| Kofi Addo-Mensah | 3 (cut) | 2 | 2 | 2 | 1 |
| Jasper van der Linde | 3 (cut) | 2 | 3 (cut) | 2 | 2 |
| Christophe Delacroix-Morel | 4 (cut) | 3 (cut) | 4 (cut) | 3 (cut) | 2 |

**For the scraper:** the display name should be the name players type and recognise, usually the common name, at most about 20 characters. A longer full legal name belongs in the alias set, not the display name: the alias set is what matching uses, and the display name only shows.

---

## 3. Formations

**Which strings work.** The web accepts a formation only if it passes both checks below. Any outfield shape that passes is laid out, because nothing is special-cased: every formation goes through one generic rule.

| Check | Rule | If it fails |
| --- | --- | --- |
| Schema | `^[1-9](-[1-9]){2,4}$`: 3 to 5 lines, each 1–9 players, joined by `-`. The goalkeeper is **not** in the string | The payload is rejected |
| Layout | The lines add up to **10** | The pitch shows "Couldn't lay out this formation" with no slots. For example "4-4-3" passes the schema but fails here |

**Slot mapping.** The statement in the brief is **confirmed:** "slot 0 is the GK, then the lines from defence to attack, each filled right to left".

- **Slot 0** is the goalkeeper, centred near the bottom of the pitch.
- **Slots 1 onward** fill the lines in the order the string lists them: the first number is the back line, the last is the front line.
- **Within a line,** slots go from screen right to screen left. The team attacks up the screen, so screen right is the team's right: slot 1 is the right-most defender.

**Where each slot sits** (percent of the pitch box):

| Line | y |
| --- | --- |
| GK | 90% |
| Back line | 74% |
| Front line | 13% |
| Lines between | evenly spaced between 74% and 13% |

Within a line, players spread evenly across the full width, from x = 97% down to x = 3%:

| Players in line | x positions, right to left |
| --- | --- |
| 1 | 50 |
| 2 | 73.5, 26.5 |
| 3 | 81.3, 50, 18.7 |
| 4 | 85.3, 61.8, 38.3, 14.8 |
| 5 | 87.6, 68.8, 50, 31.2, 12.4 |

**The formations asked about.** The position labels are what an empty slot shows (§ 4):

| Formation | Lines | Slots, back to front |
| --- | --- | --- |
| 4-4-2 | 3 | GK 0 · DF 1–4 · MF 5–8 · FW 9–10 |
| 4-3-3 | 3 | GK 0 · DF 1–4 · MF 5–7 · FW 8–10 |
| 4-2-3-1 | 4 | GK 0 · DF 1–4 · MF 5–6 · MF 7–9 · FW 10 |
| 4-1-4-1 | 4 | GK 0 · DF 1–4 · MF 5 · MF 6–9 · FW 10 |
| 3-4-1-2 | 4 | GK 0 · DF 1–3 · MF 4–7 · MF 8 · FW 9–10 |
| 3-5-2 | 3 | GK 0 · DF 1–3 · MF 4–8 · FW 9–10 |
| 5-3-2 | 3 | GK 0 · DF 1–5 · MF 6–8 · FW 9–10 |
| 4-1-2-1-2 | 5 | GK 0 · DF 1–4 · MF 5 · MF 6–7 · MF 8 · FW 9–10 |

**What the generic rule means in practice:**

- **Every line is flat and spans the full width.** There are no diamonds or staggered lines: 4-1-2-1-2 draws as five flat rows.
- **A pair is drawn wide, not as a central pair.** The two holding midfielders of a 4-2-3-1 sit at 26.5% and 73.5%.
- **A single player is centred:** the 4-1-4-1 anchor, a lone striker.
- **Labels go by line:** the first line is DF, the last is FW, and every line between is MF.
  - The wing-backs of a 3-5-2 are MF; those of a 5-3-2 are DF.
  - The attacking three of a 4-2-3-1 are MF.
- **The slot width depends on the formation's widest line:** 24% of the pitch for up to 3, 22% for 4, 18% for 5, 14% for 6 or more, and never over 160 px.
  - Lines up to 6 never overlap.
  - Lines of **7 or more** (allowed by the schema, e.g. "1-7-2") overlap slightly.
- **The slot heights are set to clear five lines** at every pitch size.

---

## 4. Positions

| Question | Answer |
| --- | --- |
| Is `RevealedPlayer.position` shown? | **No.** The schema checks it is one of `GK`, `DF`, `MF`, `FW`, and nothing displays it |
| Is it used for layout? | **No.** A player is placed by `slot` alone |
| What label does a slot show? | An empty slot shows a position label (GK, DF, MF or FW) and screen readers hear "Defender, not yet named". That label comes from the **formation** (§ 3), never from the player's field. A filled slot shows only the headshot and name |
| Must it agree with the slot's line? | **The web doesn't enforce it, and a mismatch shows nothing wrong.** The contract says it must match (`contract.md` § 3: "Must match the slot in the formation"), and the mobile client may use it. **Derive it the web's way:** slot 0 is GK, the first line DF, the last line FW, every line between MF. A wing-back recorded as a midfielder in a 5-3-2 would otherwise disagree with the DF label the slot shows before the reveal |
| Slots | `slot` must be an integer 0–10, unique within one XI. Two players with the same slot: the later one takes the slot, and the other never shows |

---

## 5. Data assumptions

| Assumption | What the UI does | What the scraper should do |
| --- | --- | --- |
| Turkish and other Latin-script accents (İ ı ş ğ ç ñ č ø ł ő …) | Inter and Archivo load the **Latin and Latin Extended subsets**, so these render in the app's fonts. Initials take the first character after Unicode NFC normalisation, upper-cased (not locale-aware, which is fine for capitalised names) | Store names **NFC (precomposed)**: "Ş" as one character, not "S" plus a combining cedilla |
| Non-Latin scripts (Cyrillic, Greek, Arabic, CJK) | No subset is loaded, so the browser falls back to a system font mid-screen. There's no right-to-left handling | Use the Latin transliteration as the display name; keep the native spelling as an alias |
| Very long names | Header and history truncate; slots clamp to two lines (§ 2) | Keep display names short (about 20 characters for players). Put full names in aliases |
| Missing `stage` or `nickname` | `null` is handled: the subtitle just leaves it out. An **empty string fails the schema** (`min(1)`) and rejects the payload | Send `null`, never `""` |
| `stage` wording | Lower-cases its first letter and appends it to the competition name: "Final" → "… final", "Round of 16" → "… round of 16" | A short phrase that reads after the competition name. Don't repeat the competition, and don't start with an acronym ("UEFA …" would show as "uEFA …") |
| National teams versus clubs | Both are `ClubRef`, treated identically. The UI says "club": the filter row "Club", "Any club", the profile's "Favourite club". A competition `kind` must be one of `league`, `ucl`, `uel`, `world_cup`, `euro`, or the payload is rejected | Fine as `ClubRef`, with a flag or federation crest as `crestUrl` and the 3-letter FIFA code as `shortName` |
| `shortName` | Required, non-empty. Shows in the phone header, the crest fallback and the history scoreline | **3 capitals.** 4–5 fit the phone header, but the crest fallback cuts even some 3-letter codes on phones ("NG…") |
| `date` | An ISO date (`YYYY-MM-DD`), shown as "25 May 2005" (en-GB, UTC) | The local match date, as a plain date with no time |
| `season` | Must match `^\d{4}(-\d{2})?$` (a hyphen, not an en dash). Never displayed | `"2004-05"` for leagues, `"2006"` for tournaments |
| `formation` | § 3 | A string the layout accepts: 3–5 lines adding up to 10 |
| Score | Integers of 0 or more, shown as "2–1" | The full-time score, as the match header shows it |

---

## 6. Attribution

**No surface shows an image credit today.** Nothing in the contract carries an author or a licence, and no screen has room for one:

- the crest's drawn area is 24–32 px
- the headshot disc is 16–40 px
- nothing about either is clickable

The project overview flags this: Wikimedia Commons images need their required attribution, and press photos and club crests carry licensing risk.

**What adding one would take,** in the order the repos change:

| Step | Repo | Work |
| --- | --- | --- |
| 1 | lineup-scraper | Record, for every image: the author, the licence name and URL, the source page URL, and whether attribution is required |
| 2 | lineup-backend | Store it beside the bucket key, and serve it, e.g. `crestCredit` on `ClubRef` and `imageCredit` on `RevealedPlayer`, each `{ author, licence, licenceUrl, sourceUrl } \| null`. This is an additive field: the web's schemas drop keys they don't know, so it doesn't need a `PROTOCOL_VERSION` bump |
| 3 | lineup-web | Transcribe the new fields, then add a surface. The cheapest that meets CC BY-SA is a **"Image credits" link** on the result card and the solo summary, opening a list of the credits for that match. A credits line under each image would not fit at these sizes. About one feature phase: schema, a small list component, a link |
| 4 | lineup-mobile | The same, in its own repo |

**Until then,** the safe default from the project overview stands: generated initials (the `null` fallback in § 1), or images whose licence needs no attribution in the UI.
