# Unknown Viewport Scroll Verification

Objective: Fix the TUI scroll/duplicate-render regression under PABCD.

## Implementation

- `5a7ccff8 fix: avoid unknown-viewport scroll append`
- Production change: `packages/tui/src/tui.ts` requires `viewportAtBottom === true` before append-growth.
- Tests: `packages/tui/test/above-viewport-repaint.test.ts` covers known-bottom, known-off-bottom, and unknown viewport paths.
- Scroll SoT: `structure/31_scroll.md` documents unknown/undefined as viewportRepaint-only.

## PABCD evidence

- P plan: `devlog/_plan/260615_scroll_anchor_duplication/20_renderer_unknown_viewport_plan.md`
- A synthesis/pass: `20.4_a_synthesis_r1.md`, `20.5_a_planner_r2_pass.md`, `20.6_a_architect_r2_pass.md`
- B verifier: `20.7_b_verifier_done.md`
- C check: `20.8_c_check_pass.md`
- D summary: `20.9_d_done_summary.md`

## Fresh verification

- `TERM=xterm-256color bun run check` — PASS.
- `TERM=xterm-256color bun test packages/tui/test/above-viewport-repaint.test.ts packages/tui/test/viewport-fill.test.ts packages/tui/test/commit-lane.test.ts packages/tui/test/prepared-line-cache.test.ts` — PASS, 31 tests / 162 assertions.
