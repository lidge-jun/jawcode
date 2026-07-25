# 20 — Realign v3: committed-block bottom tracking (260703, WP1)

## Loop continuity (previous cycle D → this P)

Previous cycle (12_gpt55_review.md, "Post-PASS user e2e follow-up 3") concluded: realign v2
(pure bookkeeping, block parked at screen top) PASS — "one region-scroll of exactly N rows +
a diff that paints ONLY the new message row directly below the previous tail", suites 65/65.

New evidence contradicts the recorded conclusion for the **trailing-blank-gap case**:
user e2e screenshots (260703) show (a) a large blank band on screen between the previous
turn's tail and the next user box, and (b) the same band permanently stamped into the
scrollback between turns. A scratch repro (`packages/tui/test/gap-repro-scratch.test.ts`)
confirms both:

```
viewport after submit:  chat-29 · 5 blank rows · user-msg-1 · [status] · > input
scrollback after growth: chat-29 · 4 blank rows · user-msg-1 · new-0 …
```

Per LOOP-PHASE-DEATH-01 the killing mechanism is the **evaluation gate**: the v2 regression
tests cover only G=0 (tail saturates the viewport) and a no-growth shrink (`setLines([])`).
Neither exercises the growth path over a non-zero trailing-blank gap. This cycle fixes the
mechanism (fill-region invariant) AND the gate (promote the growth repro to a regression).

## RCA

Realign v2 leaves the physical screen as `[block K rows (content, top)][gap G blanks][cluster]`
and declares `#committedScreenRows = K`, `#lastFillRows = K` — at that instant the block
occupies the entire fill region, so the §3b-3 invariant ("committed block sits at the BOTTOM
of the fill region") holds.

One frame later `#expandViewportFill` overwrites `#lastFillRows` with the new frame's blank
prefix `F = height − content − cluster`. At turn start `F > K` (content is just the user box),
so the invariant silently breaks: the block now sits at the TOP of a taller fill region with
the gap blanks *inside* the region below it. Every subsequent growth frame fires the §3b-3
scroll-out (`tui.ts:1683`) with `count = prevFill − newFill`, region `1..prevFill`:

- while the block lasts, its top rows scroll out one-for-one with growth — but the on-screen
  gap between block remnant and content stays **constant** (`F₀ − K`), so the user stares at
  the blank band all turn;
- once the block is exhausted, the scroll pushes the **gap blanks** into the scrollback —
  the permanent blank band between turns (repro: 4 blank rows).

Two corollaries of the same broken invariant:

- `fullRender(clear)` flush (`tui.ts:1709`) scrolls `prevFillRows` rows — block + gap blanks —
  into history on any forced clearing render (e.g. ctrl+o collapse right after a boundary).
- `viewportRepaint` (`tui.ts:1751`) 2K-erases every row with **no** committed handling: a
  post-boundary repaint (forced-render downgrade, multiplexer height change) wipes the parked
  block pixels while `#committedScreenRows` still claims them — content loss.

## Fix design (v3)

Decouple "frame blank prefix" (what `#expandViewportFill` measures) from "history region
bottom" (where committed pixels end). New private field:

```
#committedBottomRow = 0   // 1-based bottom row of the on-screen committed block; 0 = none
                          // (legacy mode: callers fall back to #lastFillRows/prevFillRows)
```

Invariant while parked (post-realign): the block occupies rows `1..#committedBottomRow`
**entirely** (`#committedScreenRows === #committedBottomRow`), so every scroll of region
`1..#committedBottomRow` pushes content only — blanks can never precede or interleave.

### MODIFY `packages/tui/src/tui.ts`

1. **Field** — add `#committedBottomRow = 0` next to `#committedScreenRows` (~line 297).
2. **`realignOverflowedFrame`** — after setting `#committedScreenRows = blockRows`, also set
   `#committedBottomRow = blockRows`. No other change to v2's mirror rewrite.
3. **Growth scroll-out** (`#doRender`, ~1683) — key off the block bottom, not the raw fill:

   ```ts
   const historyBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : prevFillRows;
   if (this.#committedScreenRows > 0 && this.#lastFillRows < historyBottom) {
       this.#scrollOutCommittedRows(historyBottom - this.#lastFillRows, historyBottom);
       this.#committedScreenRows = Math.min(this.#committedScreenRows, this.#lastFillRows);
       this.#committedBottomRow = this.#committedScreenRows > 0 ? this.#lastFillRows : 0;
   }
   ```

   Parked mode: no scroll while `F ≥ HB` (growth is absorbed by painting the gap bottom-up);
   once `F < HB` the block scrolls exactly enough that its bottom lands at the new fill
   bottom — content meets block with zero gap, and only content rows cross into scrollback.
   Legacy mode (`#committedBottomRow === 0`): byte-identical to today.
4. **`commitLines`** (~1459) — insert directly below the parked block instead of at the raw
   fill bottom (prevents committed-region fragmentation on short-turn boundaries):

   ```ts
   const liveZoneTop = this.#committedBottomRow > 0 ? this.#committedBottomRow : this.#lastFillRows;
   ```

   and cap `#committedScreenRows` with `liveZoneTop` (existing `Math.min` updated).
5. **`fullRender(clear)` flush** (~1709) — flush the block only:

   ```ts
   const flushBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : prevFillRows;
   this.#scrollOutCommittedRows(flushBottom, flushBottom);
   this.#committedScreenRows = 0;
   this.#committedBottomRow = 0;
   ```
6. **`viewportRepaint`** (~1751) — new guard at entry: if `#committedScreenRows > 0`, flush
   the block first exactly as in (5), then repaint. Turns today's silent pixel wipe (content
   loss) into a clean commit.
7. Reset `#committedBottomRow = 0` wherever `#committedScreenRows` is reset to 0 today
   (fullRender non-clear path does not reset it; audit all assignment sites).
8. **Overlay guard** (audit round-1 finding; placement corrected per audit round-2) — an
   overlay opened while a block is parked composites into top rows and the NORMAL diff path
   repaints them (`tui.ts:2075` area), wiping committed pixels that were never committed to
   scrollback. In `#doRender`, IMMEDIATELY after `#expandViewportFill` (~1644) — i.e. BEFORE
   `#restoreOverflowFloor` and the `#previousRawLines` overwrite at ~1654-1655, while both
   mirrors still describe the parked frame (blank over the block) — flush the parked block
   exactly as in (5):

   ```ts
   if (this.overlayStack.length > 0 && this.#committedScreenRows > 0) {
       const flushBottom = this.#committedBottomRow > 0 ? this.#committedBottomRow : prevFillRows;
       this.#scrollOutCommittedRows(flushBottom, flushBottom);
       this.#committedScreenRows = 0;
       this.#committedBottomRow = 0;
   }
   ```

   Region `1..flushBottom` is content-only while parked, so the flush pushes content only;
   at this insertion point the mirrors already declare those rows logically blank, so no
   mirror rewrite is needed. This matches the existing policy that
   `commitLines`/`realignOverflowedFrame` refuse to operate under overlays.
9. **Cluster measurement fix** (cross-session finding, confirmed 260703) — mount order is
   `[viewportFill][chatContainer][pendingMessagesContainer][liveToolContainer][cluster…]`
   (`interactive-mode.ts:573-575`), but `measureComposerClusterRows`
   (`ui-helpers.ts:182-193`) counts only children AFTER `liveToolContainer`. Queued
   Steer/Follow-up chip pixels (`pendingMessagesContainer`) therefore sit between the
   transcript tail and the measured cluster at realign time and get parked into the
   committed block as if they were transcript — stale gray chip text is then stamped into
   the scrollback (the screenshot-#3 gray-box duplication). Fix in
   `packages/coding-agent/src/modes/utils/ui-helpers.ts`: measure the cluster from
   `children.indexOf(ctx.chatContainer) + 1` so everything below the transcript
   (pending chips, live tool zone, status/editor cluster) counts as cluster and is never
   scrolled into history. Sole caller is the realign gate (`input-controller.ts:514`).

### Tests — MODIFY `packages/tui/test/scroll-misalignment.test.ts`

- **T1 (promoted repro)** "growth over a trailing-blank gap stamps no blank band": 30 content
  rows + 6 trailing blanks, realign, grow new turn in ~25 steps → scrollback between
  `chat-29` and `user-msg-1` contains ≤1 blank row; no duplicated/lost `chat-*`/`new-*` rows.
- **T2** "gap is consumed on screen once growth reaches the block": same setup, assert the
  final viewport has new content directly below the remaining block rows (no interior blank
  band once `F < HB`).
- **T3** "forced clearing render after realign flushes content only": realign with gap, then
  `requestRender(true)` on a fitting frame → scrollback tail = block rows, ≤1 blank, no loss.
- **T4** "post-realign viewportRepaint preserves the block": realign, then grow the frame past
  the viewport and force a render (downgrade path) → every `chat-*` row appears exactly once
  across scrollback+screen (today: wiped).
- **T5** "overlay after realign flushes the block instead of painting over it": realign with a
  parked block, `showOverlay` an overlay that covers top rows, close it → every `chat-*` row
  appears exactly once across scrollback+screen; no blank band.
- **T6** (in `packages/coding-agent/test/turn-boundary-realign.test.ts`): with a non-empty
  `pendingMessagesContainer` mounted between chat and live tools,
  `measureComposerClusterRows` counts the chip rows as cluster (anchor moves to
  `chatContainer + 1`); existing cases in that file stay green.
- Existing G=0 golden case and no-growth shrink case must stay green unchanged.
- DELETE `packages/tui/test/gap-repro-scratch.test.ts` (superseded by T1/T2).

## Out of scope (recorded residuals)

- The transient on-screen gap between the parked block and bottom-anchored new content
  (`F − HB` rows, shrinking as the turn grows) is inherent to the composer-pin layout and was
  v2's explicit design tradeoff; it heals as content streams and no longer reaches history.
- Duplicate user input (signature collapse) → WP2; ctrl+o fold targeting → WP3.

## Verification plan (C)

`cd packages/tui && bun test` (full package), `bun run check` / tsgo+biome per repo scripts,
plus targeted rerun of `scroll-misalignment.test.ts`.

## B — implementation record (260703)

Implemented as planned (items 1-9), plus one defect DISCOVERED BY the new tests:

- **DECSTBM 1-row region is a no-op** — terminals ignore `CSI 1;1r` (bottom must exceed
  top), so the final parked-block row was never scrolled out and the next diff overwrote
  it (repro: `chat-29` vanished at the fill 1→0 transition in T1).
  Fixes: (a) `#scrollOutCommittedRows` widens a 1-row region to `[1..2]` (count clamped
  to 1 — no caller can need more out of a 1-row region), scrolls, and rotates
  `#previousLines[vt] ← [vt+1]` / blanks `[vt+1]` so the same-pass diff maps the shifted
  live row correctly; `#previousRawLines` is deliberately untouched (at the growth call
  site it already holds the CURRENT frame's raw lines). (b) `commitLines` now refuses
  `liveZoneTop <= 1` (was `<= 0`): the insert-history sequence under an ignored 1-row
  region would paint the "committed" line INTO the live zone at row 2 — virtual-lane
  fallback instead.

Verification (B self-check):
- `packages/tui: bun test test/scroll-misalignment.test.ts` → 13/13 (5 new v3 cases).
- `packages/coding-agent: bun test test/turn-boundary-realign.test.ts test/interactive-mode-current-turn-boundary.test.ts` → 15/15 (cluster tests re-anchored to chatContainer + new chips case).
- Full tui suite: 535 pass / 6 fail — the 6 are `render-goldens` fixtures that fail
  IDENTICALLY on a clean tree at HEAD (5c375b1), verified via `git stash` baseline run;
  tracked separately for a reviewed `UPDATE_GOLDENS=1` refresh in the final pass.
- `bun run check` (biome + tsgo) clean on both packages.

## D — cycle summary (260703 WP1)

- **P**: RCA with unit repro (growth scroll-outs stamp the trailing-blank gap; 4 blank rows
  in scrollback), v3 design decoupling the history-region bottom from the frame blank prefix.
- **A**: Codex gpt-5.5 xhigh, 2 rounds — round 1 found the overlay-after-realign paint hole
  (→ item 8), round 2 corrected the guard placement to before the raw-mirror overwrite;
  cross-session finding (queued chips excluded from cluster measurement) folded in as item 9.
- **B**: implemented items 1-9 + the test-discovered DECSTBM 1-row-region fix; B-verify
  round 1 NEEDS_FIX (byte-compat of the new flushes in ordinary commit-lane state) →
  parked-only gating; round 2 DONE.
- **C**: tui 535 pass / 6 fail (pre-existing render-goldens, broken at clean HEAD — tracked
  for a reviewed refresh), coding-agent affected suites 15/15, biome+tsgo clean both packages.

Files: packages/tui/src/tui.ts, packages/tui/test/scroll-misalignment.test.ts,
packages/coding-agent/src/modes/utils/ui-helpers.ts,
packages/coding-agent/test/turn-boundary-realign.test.ts, this devlog.

Next-direction: WP2 — duplicate user-input rendering (optimistic-signature scalar overwrite +
Set collapse + double credit consumption in event-controller); WP3 — ctrl+o fold targeting;
WP4 — golden refresh + full e2e pass.
