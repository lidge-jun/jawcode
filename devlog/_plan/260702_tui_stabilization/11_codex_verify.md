# 260702 — B-phase independent verification (codex gpt-5.5 xhigh, read-only)

First pass verdict: **NEEDS_FIX** — 2 findings, both real, both fixed.

## Finding 1 (High) — post-realign re-overflow killed future realigns

`realignOverflowedFrame()` resets `#overflowFloor = 0` and schedules a forced render;
the submit path adds the next user message before that render runs. If the post-sweep
frame still overflows (long multi-line prompt, pending panel), the forced render
downgrades to `viewportRepaint` (`#hasCommittedHistory` forbids the 2J replay), leaving
floor = 0 while the logical frame exceeds the viewport — and the old precondition
`#overflowFloor <= height → refuse` made every FUTURE realign a no-op: the fill=0
commit-lane death spiral returned with no exit.

**Fix**: precondition is now `Math.max(#overflowFloor, #maxLinesRendered) <= height →
refuse` — the quarantined floor-0 state stays realignable at the next submit. The
scroll-out preserves the visible tail; rows that never materialized during the
quarantine window are the documented history-gap tradeoff (00_plan.md F3 item 5).
Regression: `scroll-misalignment.test.ts` "stays realignable when the post-realign frame
immediately re-overflows (floor 0, quarantined)".

## Finding 2 (Medium) — pending no-result command preview was still uncapped

`BASH_COMMAND_PREVIEW_LINES` was applied only in `renderResult()`; with
`mergeCallAndResult: true` the no-result pending state renders through `renderCall()`,
whose status-line description embeds the raw multi-line command — a long heredoc/for
loop still produced an uncapped live transient before any output existed.

**Fix**: `renderCall()` folds the command text past `BASH_COMMAND_PREVIEW_LINES` with a
dim `… +N command lines` tail, matching the result view.

## Post-fix state

- Targeted suites 41/41 (scroll-misalignment 5 · seam 5 · viewport-fill · commit-lane ·
  above-viewport-repaint · turn-boundary-realign 5), bash render suites 33/33.
- biome + tsgo clean in both packages.
- Second codex confirmation pass: **DONE — no remaining findings.** Confirmed the
  `Math.max(#overflowFloor, #maxLinesRendered)` precondition with the documented
  history-gap tradeoff and the regression case (first realign → immediate re-overflow
  via downgraded viewport repaint → second realign true, duplicate-free buffer,
  composer floor), and the `renderCall` pending fold matching the result-side fold.
  (The verifier's own `bun test` attempt was sandbox-blocked — EPERM on the log file —
  so test evidence is from the boss-side runs recorded above and in C.)
