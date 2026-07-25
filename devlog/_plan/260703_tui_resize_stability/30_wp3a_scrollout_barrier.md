# 30 — WP3a: scroll-out repaint barrier

## Loop continuity

WP2 + hardening shipped (fdb6e46/3cc2689/ef481ba). WP2.5 A-audit FAILED (see 21 header)
— cycle order swapped: WP3a first (fully mapped, small), WP2.5 revised next. This slice
targets the user's round-3 evidence: corrupted band pinned at the top re-asserting
during streaming + sentences duplicated at different wrap offsets.

## Research (Opus scout, verified with file:line evidence)

`#scrollOutCommittedRows` (tui.ts:1508) has four call sites. S3 (inside fullRender,
:1851) and S4 (inside viewportRepaint, :1905) are followed by an absolute repaint in the
same helper — safe. The hazards are the two sites INSIDE #doRender ahead of branch
selection:

- **S1 overlay-flush (:1767)** — parked block flushed when an overlay opens.
- **S2 live-zone growth (:1816)** — fires on MOST content-growth frames whenever
  `#committedScreenRows > 0` (any session after a commit).

Both can fall through to the same-pass RELATIVE lanes: the delete-only partial (:2113)
and the relative diff build (:2196+). Today they survive on two unchecked coincidences:

- **(a) clamp mismatch**: the scroll-out restores the physical cursor to
  `clamp(#hardwareCursorRow - #viewportTopRow, 0, h-1)` (:1526) while `computeLineDiff`
  uses the UNCLAMPED value (:1738-1742). Out-of-range states (overflow/post-repaint,
  where #hardwareCursorRow is an absolute content row, e.g. :1929/:1982) over-travel the
  cursor upward → changed rows painted too high → the top-pinned re-asserting band.
- **(b) blank-region equivalence**: for `regionBottom > 1` the mirror is NOT rotated
  after the physical scroll — tolerated only because the scrolled region is logically
  blank in the mirror. Any non-blank overlap (mis-measured realign block boundary,
  count overshoot, overlay-composited row) repaints the same logical line at a shifted
  offset → duplicated sentences at different wrap offsets.

## Fix (Option A now; Option B follow-up)

**Option A (this cycle):** pass-local `scrolledOutThisPass` set at S1/S2; before the
delete-only lane and the relative-diff build, route to
`viewportRepaint("scroll-out repaint barrier")`. viewportRepaint is absolute and
rewrites all bookkeeping wholesale, so no stale local/mirror survives. Cost: scroll-out
frames become full-viewport repaints (~height row writes vs a changed band); each is one
synchronized present at throttled cadence — acceptable until a perf gate says otherwise.

**Option B (later polish):** refactor scroll-out into a pure sequence builder prepended
inside the SAME ?2026 block as the absolute repaint (one atomic present, no
intermediate frame), then delete the widened regionBottom===1 mirror-rotation special
case (dead once every scroll-out is followed by a wholesale mirror rewrite).

## Test impact (verified)

Existing goldens: none call commitLines → byte streams unchanged → no fixture updates.
Re-run and diff: commit-lane.test.ts (S2 direct), scroll-seam-duplication.test.ts
(duplication assertions = exactly what this hardens; watch the frozen-floor round-trip
byte-equality test), scroll-misalignment.test.ts (parked-block lane). New coverage: a
test asserting the render following a growth scroll-out is absolute (no relative
cursor-move byte before the repaint) and that (b)'s duplication cannot occur when the
region overlaps non-blank mirror rows.
