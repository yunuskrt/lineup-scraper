# Done Action

1. Read todo.md and find the current phase (first `- [ ]` line, with or without a 🟡 marker)
2. If every line is `- [x]`, report "All phases complete" and stop
3. Run `/todo remaining` logic first — confirm nothing in the phase is still unimplemented
   - If gaps remain, list them and ask whether to mark complete anyway; do not check the box without an answer
4. Change that line's `- [ ]` to `- [x]`, leaving its text and phase number untouched
5. Strip the 🟡 marker and any trailing ` — partially done: ...` and ` — 👤 you: ...` notes — a completed phase carries none
   - Set that phase's rows in `context/docs/manual-work.md` to **Done**. If the user's part wasn't finished (pages still missing), say so and ask before ticking
6. Keep completed phases contiguous at the top — if the newly completed line has any `- [x]` lines below it, move it up to sit directly after the last completed line
7. Report the phase just completed, the new current phase, and updated `X/Y` progress
