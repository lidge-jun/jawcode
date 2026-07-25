# 90 — S5 final form: live top-flow (Opus design 260704, S5-1 SHIPPED)

## Status

- **S5-1 SHIPPED (8bf93d7)** independently and confirmed by the design: sentinel moved
  below the transcript (interactive-mode.ts, after chatContainer... note: shipped
  position is after btwContainer — design suggests after chatContainer, before
  pendingMessagesContainer; evaluate at S5-2 whether pending/live/status containers
  belong above or below the fill). commitLines refuses (fill sentinel not first →
  #lastFillRows=0) → virtual lane; the PROVEN turn-boundary realign lane owns history.
  Visual = [banner][content top-flow][pad][composer]. Full suites green incl. the
  realign-v3 oracle (realign sets its fields itself, independent of expandViewportFill).

## S5-2 (HIGH risk, queued): commit lane → live-zone flush; realign retracts

- #expandViewportFill: `#lastFillRows = fill` unconditionally (bottom-gap meaning) +
  new `#composerRows = result.length - first` (rows after the sentinel).
- commitLines rewrite: flush a finalized on-screen PREFIX into real scrollback by
  scrolling region [1 .. height - #composerRows] by P lines (composer excluded, stays
  pinned); optional canonical rewrite of rows 1..P inside the same ?2026 block; return
  TRUE under overflow (inverts commit-lane.test.ts:153-158); no persistent block
  (#committedScreenRows stays 0). Gates unchanged.
- realignOverflowedFrame: gut the mirror surgery; keep environmental gates; body →
  "flush finalized prefix via commitLines + requestRender". Retire #committedBottomRow.
- DELETE: S2 drain (tui.ts ~2087-2114), liveZoneRepaint (barrier → unconditional
  viewportRepaint), all #committedScreenRows>0 flush arms (overlay/fullRender/
  viewportRepaint/barrier), flushHistoryLane → resyncViewport (or remove).
- G2 dissolves the "fill wall" reason realign avoided scrolling: with fill at bottom,
  the scrolled tail stays visible at screen top and the next turn flows beneath.

## Shrink-at-seam invariants (Q2, enforced already / keep)

- INV-SHRINK-1 scrollback immutable: fits-case shrink grows the BOTTOM fill (in-place
  repaint); overflow-case uses the floor/tombstone machinery (keep intact).
- INV-SHRINK-2 only the live tail shrinks: stopper set guarantees streaming/pending
  never reach scrollback — shrinkable surfaces are strictly below the commit boundary.
- INV-SHRINK-3 shrink repaints absolutely, never DECSTBM-scrolls.

## Q3 (fill-collapse alternative): REJECTED — incoherent (regresses the mega-gap or
   floats the composer; doesn't relocate the mid-gap).

## S5-3: flushHistoryLane→resync, test flips (oracle retarget: "finalized tail flushes
   to real scrollback once, in order, no dup"; commit-lane rows-0..1 flips; gating
   suite mostly green), selective golden regen.

## fable attack list for S5-2 (run after implementation)

1. Composer never scrolls off-bottom under overflow (every growth path routes
   shed→commitLines, never the naive full-screen \r\n diff scroll).
2. #composerRows accuracy at commit instant (stale value scrolls composer pixels out).
3. Same-pass commit+shrink seam immutability (tombstone/floor × ?2026-atomic commit).
4. Reading order at banner/seam (commitPreamble refusal path).
5. WP3b off-bottom deferral + overflow: no unbounded frame growth, no duplicates.
6. Non-standard lanes (zellij/overlay/probe-unresolved) fall back to virtual-lane-
   under-bottom-fill cleanly.
