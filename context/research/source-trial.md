# Research: Source Trial (S02)

## Output

`context/docs/source-trial.md`

## Research

Trial every source in § Sources of `context/features/phase-s02-source-trial.md` against its § Sample (20 matches plus two edge cases), for every field in its § Fields, including id stability and the access mechanics. Apply its § Decision Rules to reach four verdicts:

1. Each source's role (primary, fill gaps or rejected), separately for metadata, lineups and events
2. The season range: 2000–01 onward, or the 2008–09 fallback
3. The fetch stack: Scrapy, Scrapy plus `scrapy-playwright`, or httpx
4. Which sources need a licence before the app is marketed

Pick each low-profile sample match from a source's fixture list before looking at its lineup.

## Include

The eight sections of the spec's § Report, in order: verdict, per source, the sample, coverage matrix, id stability, disagreements, shape notes for S06/S07/S08/S11, follow-ups.

For every source: `robots.txt` and terms (URL, fetch date, relevant clause), technical blocks seen, and the number of pages viewed.

## Sources

Files:

- `context/features/phase-s02-source-trial.md`: sources, sample, fields, decision rules, report structure, decisions
- `context/docs/data-contract.md` §§ 2 and 6: the columns and rules the data must fill
- `context/docs/data-display-requirements.md` §§ 3 and 5: formations and data assumptions
- `context/docs/match-pool-scope.md` § 2: the competitions, seasons and curated clubs
- `context/coding-standards-scraper.md` § Sources: the rules for touching a source

Tools:

- WebFetch for `robots.txt`, terms, static pages and data files
- The Playwright MCP, **inspection only**: whether a page needs JavaScript, and which JSON requests it makes
- WebSearch to find a source's pages

Rules:

- Every date, score, name and XI in the report cites the page it came from. Nothing comes from memory
- Nothing is copied out of a page as a record. No fixture is saved
- About 40 page views per source at most, one at a time. Count them
- A technical block (CAPTCHA, Cloudflare challenge, login wall) rejects the source. Never work around one
- No paid API. Transfermarkt, FBref and worldfootball.net are only for checking an XI by hand
