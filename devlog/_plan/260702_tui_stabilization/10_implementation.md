# 260702 — TUI overflow stabilization: implementation record (B phase)

Implements `00_plan.md` (audited PASS by codex gpt-5.5 xhigh, 3 rounds).

## Changes

### packages/tui/src/tui.ts — the renderer core

- **F1 quarantine** (`#doRender`, after the heightChanged block, before clearOnShrink):
  `#fillSentinelPresent && #maxLinesRendered > Math.max(#overflowFloor, height)` routes
  every render through the absolute `viewportRepaint`. Placement rationale: resize
  branches above keep their own reset semantics (realResize resets the floor in
  `#restoreOverflowFloor`); everything below is relative-diff territory that must be
  unreachable while logical/physical row identity diverges. Self-heals when a
  tombstone-padded shrink-to-floor frame (or a fitting frame) is repainted —
  `viewportRepaint` records `#maxLinesRendered = length`.
- **freezeEnd → physical seam** (`#restoreOverflowFloor`): frozen tombstones are sliced
  by `max(0, #overflowFloor - height)` instead of the logical `#viewportTopRow`, so
  frozen pixels can never land inside the visible viewport (the stale-band bleed).
- **Fixed-C recurrence guard**: `#lastFillRows = 0` inside the tombstone-padding branch —
  fit-again raw content re-inserts top fill, but that fill is not a screen-top history
  region while the frame is padded back over the viewport.
- **F3 `realignOverflowedFrame(liveClusterRows): boolean`**: self-gating (sentinel
  present, floor > height, standard history lane, no overlays, terminal available,
  finite non-negative cluster). Emits a bottom-anchored `"\r\n".repeat(height -
  liveClusterRows)` scroll inside synchronized output — the default full-screen scroll
  region has top = row 1, so the pushed rows enter real scrollback (insert-history.ts
  contract). Then `#hasCommittedHistory = true` (the scrolled-out rows are canonical —
  3J forbidden even in sessions without insert-history commits), floor/diff-state reset,
  `requestRender(true)` — the post-sweep frame fits, so the forced rebuild is a real
  2J-only fullRender that repaints a clean pinned screen.

### packages/coding-agent

- `ui-helpers.ts`: `commitFinalizedBacklog(ctx, { markOnly })` — after a successful
  realign the cells' as-streamed pixels are already in the scrollback, so they are
  flagged `committed` without a second insert-history write (a second write would
  duplicate history). `measureComposerClusterRows(ctx)` walks `ctx.ui.children` below
  `liveToolContainer` so the anonymous Spacer and future cluster members stay counted;
  returns -1 (→ realign refuses) when the container is not mounted.
- `input-controller.ts` submit path: `const realigned = commitLaneEnabled() &&
  (ctx.ui.realignOverflowedFrame?.(measureComposerClusterRows(ctx)) ?? false)` →
  `commitFinalizedBacklog(ctx, { markOnly: realigned })` → unfreeze → compact.
  `JWC_COMMIT_LANE=0` short-circuits before any scroll-out (re-audit blocker 1).
- `bash.ts` **F2b**: `BASH_COMMAND_PREVIEW_LINES = 4` — the command block folds past 4
  lines unless expanded (`… +N command lines (ctrl+o to expand)`); output preview was
  already capped at 10. Bounds the live-preview transient so the collapse residue stays
  small.

## Verification (B)

- `scratchpad/stale-bleed-repro.test.ts` (the original live repro): FAIL → PASS.
- New `packages/tui/test/scroll-misalignment.test.ts`: 4/4 pass.
- New `packages/coding-agent/test/turn-boundary-realign.test.ts`: 5/5 pass.
- Existing targeted suites: scroll-seam-duplication (5) + viewport-fill + commit-lane +
  above-viewport-repaint = 31/31 pass.
- `bun run check` (biome + tsgo) clean in packages/tui and packages/coding-agent.
- Independent read-only codex (gpt-5.5 xhigh) implementation verification: see
  `11_codex_verify.md` (NEEDS_FIX ×2 → both fixed → DONE).

## C-phase gate record

`TERM=xterm-256color bun test packages/tui packages/coding-agent` (post-change, after
the B-verify fixes): **6962 pass / 119 fail** (Ran 7437 across 798 files). The failure
set is byte-identical to the pre-change baseline (119 pre-existing failures owned by the
separate 260630 CI-green thread — diffed with `comm`, zero new entries). The +10 tests
vs baseline are this thread's new regression cases, all passing. `bun run check`
(biome + tsgo) clean in packages/tui and packages/coding-agent. SoT
`structure/31_scroll.md` updated (§3 physical-seam freeze / quarantine / realign rows,
§9 test assets).
