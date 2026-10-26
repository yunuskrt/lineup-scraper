# Current Action

1. Read todo.md and find the first `- [ ]` line — that is the current phase
2. If every line is `- [x]`, report "All phases complete" and stop
3. If the line has a ` — 👤 you: …` note, or the phase's spec in `context/features/` has a `## Your part` section, **open the report with a "👤 Your part" block**: what the user does, how much, where it goes, and when (now, or after a given step). Take it from the spec if it exists, else from `context/docs/manual-work.md`
4. Report:
   - Phase number and title
   - Whether it's not started or 🟡 partially implemented — if partial, quote its trailing note and point at `/todo remaining` for the breakdown
   - The one-line description from todo.md
   - Progress: `X/Y phases complete`
5. Do not modify any file
