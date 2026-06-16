# 73 — scroll repaint timing follow-up note

## Context

After the P2.2 prepared-line cache work and the follow-up unknown-viewport scroll fix, the major duplicate/pushed-row failure was closed by `5a7ccff8 fix: avoid unknown-viewport scroll append` and the dedicated scroll PABCD closure under `devlog/_plan/260615_scroll_anchor_duplication/20*.md`.

A smaller live-session edge remains user-observed: the screen can look slightly stale/broken immediately after a scroll/expand/collapse/render transition, then correct itself as soon as the user types the next chat message. This is **not** currently tracked as a data/model correctness bug; it is a physical terminal repaint timing edge.

## Current classification

- Name: **next-input self-healing repaint glitch**.
- Severity: low-to-watch, not a release blocker after the unknown-viewport duplicate-row fix.
- Symptom: a visual glitch remains until the next input event triggers another render/compact/repaint pass.
- Important clue: the next chat keystroke fixes the display, which means the logical frame is likely already correct and the missing piece is an immediate repaint/compact trigger at the earlier state transition.
- Current user decision: leave it alone for now; do not start another patch cycle unless it becomes annoying or regresses into duplicate/pushed rows again.
- Reopen threshold: if the issue becomes physical duplicate/pushed rows, bottom-follow while off-bottom, or scrollback corruption, route it as a scroll safety regression. If it stays “next input fixes stale pixels,” keep it in this deferred repaint timing lane.

## What this is probably not

- Not evidence that the full tick-based render behavior should be restored wholesale.
- Not a reason to revert the P2.2 prepared-line cache or the P1.5.1 expedited input render patch.
- Not a reason to remove or weaken P1.5.1 `#inputRenderPending` / `#commitExpeditedRender()` / `process.nextTick` input-render coalescing.
- Not a reason to simplify the scrollback-native model, composer pin, sticky gap, ctrl+o semantics, or curated TUI visuals.

## Future investigation plan, if reopened

1. Reproduce with render debug logging around the exact state transition that leaves stale pixels.
2. Compare the repair path caused by the next chat input against the broken path:
   - `requestRender(...reason)` forced vs non-forced,
   - `compactViewportFill()` invocation,
   - `viewportRepaint()` vs append-growth branch,
   - `#previousLines` / viewport top bookkeeping.
3. Add the smallest missing immediate trigger to the original transition, mirroring the next-input repair path.
4. Verify with a focused terminal-byte regression before running package/root gates.

## Guardrails

- Prefer one missing forced repaint/compact at the responsible transition over global render scheduling rollback.
- Keep unknown real-terminal viewport state conservative: append-growth only when `isViewportAtBottom() === true`.
- Preserve the P2.2 content-keyed prepared-line cache. A repaint timing bug should not be fixed by disabling the cache unless direct evidence proves the cache returns stale prepared bytes.
- Preserve P1.5.1 expedited input render coalescing. A timing edge should be fixed by locating the missing transition repaint, not by making every tick recompute again.
- Do not create historical scrollback mutation semantics for ctrl+o/ctrl+t while debugging this.

## Evidence pointers

- Scroll SoT: `structure/31_scroll.md` §5.
- Unknown-viewport fix cycle: `devlog/_plan/260615_scroll_anchor_duplication/20_renderer_unknown_viewport_plan.md` through `20.9_d_done_summary.md`.
- Performance cycle that made this worth tracking: `72_p2_2_p3_1_adjacent_plan.md`, `72.14_d_p2_2_p3_1_done_summary.md`.
- Performance status/backlinks: `00_moc.md`, `02_patch_roadmap.md`.
