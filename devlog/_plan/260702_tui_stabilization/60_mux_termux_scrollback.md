# 60 — WP5: multiplexer/termux scrollback regressions (260703)

## Loop continuity

WP4 golden review reclassified two fixtures as real regressions (devlog 50). Codex RCA
(gpt-5.5 xhigh) traced both with full decision chains.

## RCA (condensed from the worker's report)

**A. multiplexer-viewport-repaint — content loss.** `TUI.start()` queues a FORCED render
(`#previousWidth/Height = -1`), so the fixture's first real frame takes the
width-changed → `fullRender(true)` path; the 5c375b1 scrollback-safe downgrade
(`clear && newLines.length > height && (isMultiplexerSession() || #hasCommittedHistory)`)
then routes it to `viewportRepaint` — but nothing was ever materialized
(`#overflowFloor === 0`), so rows 00..10 never reach the tmux scrollback and every later
render stays repaint-only. The downgrade exists to stop clearing replays from pushing a
DUPLICATE copy of already-materialized rows; treating a first-ever overflow render the
same way trades duplication for loss.

**B. termux-height-diff — stale rows above the final frame.** The 10→6 resize physically
pushes the top two rows into the terminal's scrollback; the Termux branch deliberately
skips the full redraw (keyboard show/hide would replay history on every toggle,
`tui.ts:1956-1968`), and `viewportRepaint` by contract never touches scrollback. Perfect
whole-buffer cleanliness after a Termux height shrink is impossible without a `3J`
scrollback clear, which the policy forbids. This is BY DESIGN; the stored golden predates
the policy. → Accept + refresh, with the fixture's coverage notes updated.

## Fix

1. **`packages/tui/src/tui.ts`** — audit round-1 KILLED the floor-based gate
   (`#restoreOverflowFloor` resets the floor to 0 on every no-sentinel render at
   `tui.ts:1595-1599`, so legacy mux frames lose the materialization memory and a later
   clearing render would duplicate). Use a STICKY materialization flag instead:

   - new `#hasMaterializedOverflow = false`, set wherever above-viewport rows are
     physically printed/scrolled: in `#raiseOverflowFloor` (its documented contract is
     exactly "paths that actually scroll or fully print the frame") and in
     `fullRender`'s floor assignment when `newLines.length > height`. Never reset
     (mirrors `#hasCommittedHistory`).
   - downgrade gate becomes
     `(this.#hasCommittedHistory || (isMultiplexerSession() && this.#hasMaterializedOverflow))`.

   First-ever overflow render in tmux materializes via `2J/H` (no `3J` — mux exclusion
   untouched) and sets the flag; every later clearing replay downgrades, exactly as
   260630 requires. Non-mux states are byte-identical (their arm — `#hasCommittedHistory`
   — is unchanged; non-mux non-committed replays still use `3J`, which already prevents
   duplication).
2. **Goldens** — after (1), re-eyeball `multiplexer-viewport-repaint` (expected: text
   artifacts return to the OLD golden's shape — 00..15 materialized, offscreen change
   repaint-only) and regenerate its writeLog; refresh `termux-height-diff` accepting the
   policy behavior (viewport text stays clean and identical; scrollback retains
   resize-pushed rows by design).

## Verification

`bun test test/render-goldens.test.ts` 6/6 + full tui suite + `bun run check`; re-run
scroll-misalignment + commit-lane suites (downgrade condition is shared with their
paths).

## D — cycle summary (260703 WP5)

- **P**: Codex RCA traced both regressions with full decision chains (mux: start()'s
  forced render + 5c375b1 downgrade treats the first-ever overflow render as a clearing
  replay; termux: policy-inherent scrollback retention).
- **A**: audit KILLED the floor-based gate (no-sentinel renders zero the floor) →
  sticky-flag design.
- **B**: `#hasMaterializedOverflow` (sticky, set at physical materialization sites) +
  re-gated downgrade; both goldens regenerated after re-eyeball — mux text artifacts
  returned EXACTLY to the pre-regression golden. Delta verify DONE (duplicate path
  covered, first-overflow materializes, all paths enumerated, non-mux byte-compat).
- **C**: full tui suite 541/541 — first fully green run of the session (all 6
  render-goldens included); biome + tsgo clean.

Files: packages/tui/src/tui.ts, 2 golden fixture dirs, this devlog.
