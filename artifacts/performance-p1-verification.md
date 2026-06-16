# P1.1/P1.2 performance verification

Objective: remove hidden full child rendering for minimized tool summaries, add safe exact collapsed-preview caching, preserve ctrl+o current-turn UX and resize correctness, and pass PABCD planning/audit gates before source edits.

Current verification evidence:

- Source inspection: `packages/coding-agent/src/modes/components/tool-execution.ts` has `#expandedLineCountsByWidth`, clears it on body/render mutators, avoids `super.render(width)` in minimized render, and seeds height cache on expanded render.
- Source inspection: `packages/coding-agent/src/modes/components/execution-shared.ts` caches `createCollapsedPreview()` results per width, returns defensive copies, and clears cache on `invalidate()`.
- Tests: `bun test packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts packages/coding-agent/test/visual-truncate.test.ts packages/coding-agent/test/execution-shared-preview.test.ts` → 20 pass, 0 fail, 51 expects.
- Boundary tests: `bun test packages/coding-agent/test/bash-execution-clamp.test.ts packages/coding-agent/test/modes/components/tool-execution-spacing.test.ts` → 28 pass, 0 fail, 71 expects.
- Changed-file diagnostics: `bun biome check packages/coding-agent/src/modes/components/tool-execution.ts packages/coding-agent/src/modes/components/execution-shared.ts packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts packages/coding-agent/test/visual-truncate.test.ts packages/coding-agent/test/execution-shared-preview.test.ts` → OK.
- PABCD status: stage `c`, plan_ref set, `audit_status=pass`, `verification_status=done`.
- C adversarial review: CLEAR for P1.1/P1.2 scope; `bun run check` remains red only on unrelated dirty-tree formatting/import issues outside the P1 touch set.
