# 80 — WP6b-v2: top-anchor the commit lane (Opus design, 260704)

## Central finding

The PARKED path (realignOverflowedFrame products, #committedBottomRow > 0 arms) already
IS the target design: top-anchored at rows 1..B, content-only flushes, gap-below
self-consumed by growth. The blank-dump bug lives entirely in the ORDINARY
(#committedBottomRow === 0) fallback that bottom-anchors via buildInsertHistorySequence
(region top rows = blank fill cross the seam). v2 = generalize the parked lane, delete
the ordinary branch. scroll-misalignment.test.ts:379-519 (realign v3) is the behavioral
ORACLE and must stay green unchanged.

## Slices

- S0: unify #committedBottomRow → alias of #committedScreenRows (B). Low risk.
- S1 (core): rewrite commitLines — per line: B < F(#lastFillRows) → DIRECT WRITE at row
  B+1 (CUP+2K+line, no scroll, mirror-blank contract protects it — commitLines never
  mutates #previousLines so diff sees blank==blank), B++; B===F saturated → scroll
  region 1..B up 1 (row 1 = oldest content → scrollback) + write at freed row B. MUST
  restore live-zone cursor explicitly (insert-history.ts:90 did it for free). Keep
  ?2026 wrap; keep conservative <=1 guard (widened-region path serves B===1 drains).
  Retire buildInsertHistorySequence (+ its 3 bottom-anchor tests).
- S2: collapse branches — S2 drain historyBottom = B (:2050); DELETE the 260704
  SHRINK-GLUE (:2065-2089, would unglue a top-anchored block — its test deleted or
  retitled); fullRender flush single blank-free arm (:2118-2134, drop the
  liveZoneRepaint ordinary detour); viewportRepaint (:2184) + barrier (:2450) flush =
  B; flushHistoryLane drops parked-only gate (C1 rationale evaporates).
- S3: test flips — commit-lane rows now TOP (0,1 not fill-bottom), history-lane-gating
  "ordinary not flushed" premise obsolete → "flush pushes content-only";
  insert-history primitive tests rewritten/removed; selective golden regen.
- S4: flip commitOnCompletionEnabled default back to true (revert 08fd688 semantics).
- S5 (optional, deferred): immediate-flush variant for gap-free screens, gated
  at-bottom only.

## Safety notes

- Direct-write race-free by the mirror-blank contract (diff never repaints rows the
  mirror declares blank); flushes before any 2K-everything repaint already exist.
- Direct-write does NOT set scrolledOutThisPass (no DECSTBM) — stays on cheap diff ✓;
  saturated scroll + S2 drain trip the WP3a barrier as today.
- UX: on-screen gap below the block while unsaturated is the ALREADY-SHIPPED parked
  appearance (tested self-consuming); strictly better than immutable blank scrollback.
  Fill-below-block reordering is IMPOSSIBLE (DECSTBM exports only from region top=1).
