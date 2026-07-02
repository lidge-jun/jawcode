# 260702 — TUI overflow stabilization (P-phase plan)

> Goal: eliminate the live-tool collapse residue (stale `⏳` pixels + giant blank band),
> restore history repair during/after overflowed turns, and lock both behind xterm-measured
> regression tests. Exit gate: adversarial codex (gpt-5.5 xhigh) review PASS.
>
> Status: DRAFT — P phase. Sections marked [pending] are filled in from the RCA
> sub-agent reports before this plan is audited (A phase).

## 1. Confirmed root cause (live repro, 260702)

Reproduced in `scratchpad/stale-bleed-repro.test.ts` (VirtualTerminal/xterm, 60×20):

1. **Phase 0** — frame `[chat×40][tool×1][composer×2]` = 43 rows materializes physically
   (diff path scrolls, `#overflowFloor` = 43, scrollback = frame rows 0..22).
2. **Phase 1 — inflation.** A row above the viewport changes while the live tail grows
   1 → 15 in the same frame. Real terminals report `isViewportAtBottom() === undefined`,
   so the `firstChanged < viewportTop` branch takes **viewportRepaint only** (tui.ts:1886
   else-branch): no physical scroll, but `viewportRepaint` records
   `#maxLinesRendered = 57` / `#viewportTopRow = 37` (tui.ts:1679-1680) — **14 rows beyond
   the physically materialized length** (`#overflowFloor` = 43 stays behind, by design of
   the 260630 freeze invariant).
3. **Phase 2 — drift.** The next shrink (live preview 15 → 1 + transcript shed) arrives as
   a plain `requestRender()` diff. `computeLineDiff` (tui.ts:1520-1524) maps the shrunken
   43-row frame against the inflated `viewportTop = 37`: the frame TAIL (rows 37..42) is
   painted at the TOP of the physical viewport and the 14 rows below are cleared.
   Measured result: composer stranded at viewport row 5, blank band filling rows 6..19.
   In a live session this class of misalignment is what produces the user-observed stale
   `⏳ Bash` band, earlier-turn text bleeding into the box region, and the giant blank hole.

Why ctrl+o never showed this: `setToolsExpanded(false)` ends in `requestRender(true)`,
which the 260630 downgrade guard turns into an **absolute** viewportRepaint — accidentally
realigning logical and physical state. Natural tool-completion collapse
(`#commitLiveTool` → `removeChild` + `setMinimized(true)`, event-controller.ts:182) is a
plain render with no such protection.

Secondary, independently confirmed:

- The live pending tool preview (commit mode, live zone) grows through the physical-scroll
  diff path and raises `#overflowFloor` (tui.ts:2011), so even with correct accounting its
  collapse must leave floor-preserving residue. The 260630 freeze
  (`setOverflowFloorFrozen`) is wired ONLY to ctrl+o (input-controller.ts
  `setToolsExpanded`), not to this natural transient.
- While overflowed, fill = 0 disables the commit lane (`#lastFillRows = 0` →
  `commitLines()` false), so finalized cells cannot reach the scrollback during long
  turns.

### 1b. History auto-restore regression (RCA agent 2, codex gpt-5.5)

What the user calls "history auto-restore" = the quiet-point repair contract: pre-260630,
`compactViewportFill()` + `requestRender(true)` rebuilt the whole frame at turn
boundaries, repairing residue. Post-260630 both are correctly duplication-safe but
nothing repairs anymore:

- **Commit-lane death spiral.** Overflow → `fill = 0` (tui.ts:1426) → `commitLines()`
  false (`liveZoneTop <= 0`, tui.ts:1361) → `commitFinalizedBacklog()` stops at the first
  uncommitted child (ui-helpers.ts:103-107). There is NO retry-once-it-fits path — only
  the next submit, and only if the frame fits by then. But once overflowed,
  `#restoreOverflowFloor` pads every frame back to `#overflowFloor` (monotonic, never
  reset: real `fullRender` only in 3J-allowed sessions, `viewportRepaint` never resets it)
  → the frame is pinned at floor length forever → fill stays 0 forever → **the commit
  lane is permanently dead after the first overflow in a committed-history session**, and
  uncommitted cells accumulate in the diff frame across turns.
- **Quiet repair downgraded.** Forced repairs (compact, /redraw, tool collapse) hit the
  downgrade guard (tui.ts:1589) → `viewportRepaint()` leaves scrollback and residue
  untouched indefinitely.
- **Submit ordering.** `commitFinalizedBacklog()` → `setOverflowFloorFrozen(false)` →
  `compactViewportFill()` (input-controller.ts:492-495): unfreeze can't help the commit
  that already failed; compact never re-runs the sweep.
- **Audit flag (possible live bug).** If raw content fits again while `#overflowFloor` is
  still pinned, `#expandViewportFill` inserts top fill and sets `#lastFillRows > 0`
  BEFORE `#restoreOverflowFloor` pads the frame back over the viewport — the commit lane
  may re-enable with a history region that is NOT at the physical screen top,
  re-creating the Fixed-C pollution scenario. Must be verified and closed in B.

## 2. Fix design (draft, pre-audit)

**F1 — misaligned-viewport sticky repaint (correctness core).**
Track the condition `#fillSentinelPresent && #maxLinesRendered >
Math.max(#overflowFloor, height)` ("un-materialized tail": the logical frame is longer
than what was ever physically materialized). While it holds, route EVERY render —
growth, shrink, same-size — through `viewportRepaint` (absolute coordinates) instead of
the relative diff path. The `Math.max(…, height)` term also covers the floor-reset edge
(post-F3 realign frame that still overflows and was painted via repaint only). The state
self-heals: any frame with `length <= #overflowFloor` gets tombstone-padded to exactly
`#overflowFloor` (`#restoreOverflowFloor`) and the absolute repaint of that frame
realigns `#maxLinesRendered`/`#viewportTopRow`/`#hardwareCursorRow` with physical
reality; with floor = 0 it heals when the frame fits again. The first overflow of a
materialized session is untouched (prev `#maxLinesRendered <= height` when the diff path
scrolls, then floor catches up).

**F2 — transient residue bounding.**
Two candidate scopes, decided by the agent-1 adversarial review:

- (a) *Whole-turn freeze*: freeze while `pendingTools` non-empty. Maximally clean
  (transients never materialize) but pauses scrollback for the entire turn — the start
  of a long streaming turn becomes unreadable (not in scrollback, not in viewport) until
  submit. Likely too aggressive for a scrollback-native UX.
- (b) *Bound the transient instead*: cap the live pending preview height (command
  preview + output preview, e.g. ≤ 8 rows) so the collapse delta is small; with F1
  fixing the drift and F3 clearing residue at turn boundaries, a few tombstone blanks
  mid-turn are acceptable and get consumed by subsequent growth.

DECIDED: (b) — the adversarial review rejected (a) (whole-turn scrollback starvation +
multi-path unfreeze leak, §2b item 7). ctrl+o freeze stays as-is.

**F3 — turn-boundary scroll-out realign + mark-only commit (history repair).**
At the submit quiet point, when the frame is overflowed:

1. **Scroll-out realign** — new TUI-owned method `realignOverflowedFrame(liveClusterRows:
   number): boolean`. The CALL is additionally gated on the coding-agent side by
   `commitLaneEnabled()` (`JWC_COMMIT_LANE=0` sessions never invoke it — byte-identical
   behavior, re-audit blocker 1); the method then checks its OWN preconditions
   internally (audit warn 5) and returns false (no-op) unless ALL hold:
   `#fillSentinelPresent`, `#overflowFloor > height`, `#historyLane === "standard"`,
   `overlayStack.length === 0` (audit blockers 10, 11), terminal available. When true: emit real newline scrolls from the viewport
   bottom for `height - liveClusterRows` rows (same `"\r\n".repeat` discipline as the
   diff growth path, synchronized output), so the as-streamed transcript tail — visible
   but not yet in scrollback — physically enters the scrollback ONCE. Composer/status
   pixels are NOT scrolled out. Then reset `#overflowFloor = 0` and invalidate diff
   state so the next render is an absolute repaint of the post-sweep frame.
   - NOT repaint-only: a bare realign repaint would overwrite the visible transcript
     tail before it ever reached the scrollback, losing it from history. The scroll-out
     preserves it; nothing is written twice, so no duplication.
2. **`liveClusterRows` is measured, not assumed** (audit blocker 4): the bottom cluster
   is `statusContainer, todoContainer, btwContainer, Spacer(1), statusLine, hook
   containers, editorContainer, composerFooter, backgroundFooterPanel`
   (interactive-mode.ts:577-592). A helper in the coding-agent (ui-helpers) sums
   `render(width).length` over exactly the components mounted below `liveToolContainer`
   at realign time and passes the total. If the cluster measures ≥ viewport height,
   realign aborts (returns false).
3. **Mark-only sweep, gated on realign success** (audit blocker 10):
   `commitFinalizedBacklog(ctx, { markOnly: true })` runs ONLY when
   `realignOverflowedFrame` returned true — then finalized cells are flagged `committed`
   without an insert-history write (their pixels just entered the scrollback via the
   scroll-out). When realign returns false (lane disabled/zellij/`JWC_COMMIT_LANE=0`/
   overlay open/not overflowed), the sweep runs exactly as today (normal `commitLines`
   path with its own gates) — legacy sessions keep current behavior, no duplication
   window exists because the frame is not reset either.
4. Effect: floor unpinned → frame fits again → fill > 0 → commit lane re-arms → the
   death spiral (§1b) is broken; residue cannot outlive **the next prompt submit**
   (audit blocker 12: `agent_end` intentionally defers to submit — devlog 083.8 ⑤ jump
   avoidance — so between agent_end and the next submit the residue may still be
   visible; F1 guarantees it is at least correctly aligned). Tombstone blanks that
   scrolled out remain permanent blank gaps in scrollback — accepted (codex leaves
   as-streamed residue in history too).
5. Known accepted limitation: rows generated during a misalignment window (F1) were
   painted via viewport repaint only and never physically materialized; the scroll-out
   preserves what is on screen, not those skipped rows — short history gaps during
   quarantine windows are possible, same behavior class as today's repaint policy.

Also close the Fixed-C recurrence corner (§1b audit flag): while `#overflowFloor` pads
the frame, `#lastFillRows` must stay 0 (commit lane fallback) even when raw content fits.

### 2b. Design constraints from the adversarial review (codex gpt-5.5, agent 1)

Producer coverage confirmed the exposure: every shrink producer except ctrl+o and
autocomplete-Escape arrives as a plain unforced render (live tool collapse
event-controller.ts:182-190/723-783, thinking settle assistant-message.ts:117-122,
autocomplete selection-close editor.ts:1031-1139, shed event-controller.ts:448-470,
loader/status lines) — so F1 must live inside `#doRender`, not in callers. Binding
constraints for B:

1. The misalignment quarantine must be evaluated AFTER `#restoreOverflowFloor` and the
   `#committedScreenRows` scroll-out (tui.ts:1572-1579), and BEFORE the
   `firstChanged < viewportTop` branch, `appendGrowthAndRepaintViewport`, and the
   relative diff path — no physical-scroll branch may be reachable while misaligned.
2. Self-heal condition is explicit: the quarantine clears only when a viewport repaint
   painted a frame with `length === #overflowFloor` (tombstone-padded shrink) or after
   F3/resize resets the floor. `viewportRepaint`'s bookkeeping then realigns
   `#maxLinesRendered`/`#viewportTopRow`/`#hardwareCursorRow` (tui.ts:1657-1683).
3. Real resize resets floor AND quarantine state together (tui.ts:1461-1477 already
   resets floor; the new flag must reset in the same branch).
4. Overlay compositing CAN change frame length — `#compositeOverlays` extends the frame
   to `workingHeight` (tui.ts:1079-1083; audit warn 7). The quarantine decision is
   therefore computed on the POST-overlay `newLines` (insertion point after compositing
   and cursor extraction, before branch selection at ~tui.ts:1747 per audit item 6).
5. `#previousRawLines` may describe logical rows that never materialized during
   quarantine (holes 7) — acceptable because quarantined renders are absolute, but the
   tombstone freeze slice must never be painted below the physical seam; keep freezeEnd
   clamped by the PHYSICAL floor (`#overflowFloor - height`), not `#viewportTopRow`.
6. Performance: during quarantine every tick repaints the full viewport (hole 8). Same
   cost class as the existing frozen-floor mode; bounded by quarantine self-healing at
   the first shrink-to-floor. Accepted; add a render-metrics counter if cheap.
7. Freeze generalization to live tools is REJECTED (holes 9-10: whole-turn scrollback
   starvation + multi-path unfreeze leak) — F2 stays option (b) (preview height cap),
   ctrl+o freeze unchanged.

**F4 — regression tests.**
- Port `stale-bleed-repro.test.ts` into `packages/tui/test/` (viewportRepaint-growth →
  shrink drift case) asserting: composer on the physical floor, no stale live rows in the
  viewport, no duplicated markers, seam continuity.
- Live-tool lifecycle case: pending preview grow (physical scroll) → completion collapse →
  continued streaming; assert residue bounded / consumed and no misalignment.
- [pending] history-restore case per F3.

## 3. Invariants after the fix

1. Rows physically in the scrollback are never repainted nor shifted over (260630 seam
   invariant, unchanged).
2. `#overflowFloor` is raised only by physical-scroll paths (260630 §01 invariant,
   unchanged).
3. NEW: whenever `#maxLinesRendered > #overflowFloor`, the relative diff path is
   forbidden — only absolute viewport repaints run until realignment.
4. NEW: transient live-zone growth does not materialize (floor frozen) — collapse restores
   the pre-growth screen without residue.

## 4. Verification baseline (working tree, pre-change)

`TERM=xterm-256color bun test packages/tui packages/coding-agent` on the pre-change
working tree: **6952 pass / 119 fail** (Ran 7427 across 796 files). The failures are
dominated by non-TUI areas (runSubprocess, workflow state, phase-rollup, …) owned by the
separate 260630 CI-green thread, plus the 6 render-goldens and commit-time-folding
agent_end failures already documented as pre-existing. Full list captured at
`scratchpad/baseline-failures.txt` (session scratchpad). **C-phase gate: the post-change
failure set must be a subset of this baseline** (no new failures), with targeted suites
(scroll-seam-duplication, viewport-fill, commit-lane, above-viewport-repaint,
commit-time-folding minus agent_end) fully green.

## 5. Touch list (diff-level)

| File | Change |
|------|--------|
| `packages/tui/src/tui.ts` MODIFY | (F1) quarantine condition + branch in `#doRender` after the `#committedScreenRows` scroll-out (tui.ts:1576-1579) and before branch selection; self-heal + realResize reset; (§2b-5) clamp tombstone `freezeEnd` to `max(0, #overflowFloor - height)`; (F3) new `realignOverflowedFrame(liveClusterRows: number)` — bottom-anchored `\r\n` scroll-out of `height - liveClusterRows` rows, then floor/quarantine/diff-state reset; (Fixed-C corner) force `#lastFillRows = 0` whenever `#overflowFloor` pads the frame |
| `packages/coding-agent/src/modes/utils/ui-helpers.ts` MODIFY | `commitFinalizedBacklog(ctx, { markOnly })`: mark without `commitLines` ONLY when the caller's realign returned true; normal path byte-identical otherwise. New helper `measureComposerClusterRows(ctx, width)` summing `render(width).length` of the components mounted below `liveToolContainer` (audit blocker 4 list) |
| `packages/coding-agent/src/modes/controllers/input-controller.ts` MODIFY | submit path: `const realigned = commitLaneEnabled() && (ctx.ui.realignOverflowedFrame?.(measureComposerClusterRows(...)) ?? false)` then `commitFinalizedBacklog(ctx, { markOnly: realigned })` → unfreeze → compact. The `commitLaneEnabled()` guard runs BEFORE any scroll-out/reset; realign additionally self-gates (not overflowed / lane non-standard / overlay open → false) |
| `packages/coding-agent/src/modes/components/tool-execution.ts` (+ bash render context if needed) MODIFY | (F2b) cap live pending preview height (command + output preview) so the collapse delta is bounded |
| `packages/tui/test/scroll-misalignment.test.ts` NEW | port of the confirmed repro (viewportRepaint growth → plain shrink) + quarantine self-heal + realign scroll-out cases; full-buffer duplicate-0 + composer-floor + no-stale-rows assertions |
| `packages/tui/test/scroll-seam-duplication.test.ts` MODIFY (if needed) | keep 5 cases green; extend only if assertions must learn the new realign semantics |
| `structure/31_scroll.md` MODIFY (C phase) | document quarantine invariant, realign-at-submit, freezeEnd clamp, F2b cap |

## 6. Out of scope

- The 6 pre-existing render-goldens failures and the commit-time-folding agent_end failure
  (tracked by the 260630 CI-green thread).
- Session-resume transcript replay redesign beyond what F3 needs.
