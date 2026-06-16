# D Done Summary — ctrl+o/t follow-up

Date: 2026-06-15

## PABCD cycle

- P — Planned follow-up fixes in `18_pabcd_ctrl_o_t_followup_p_plan.md`: keep `ctrl+o` current-live-turn-only and make `ctrl+t` full transcript pager open at latest/bottom.
- A — Audited plan with Planner/Architect lenses. Round 1 found missing tests/docs details; delta audit passed after plan revisions. Reports: `18_a_followup_*`.
- B — Built the implementation and recorded evidence in `19_b_followup_implementation.md`; read-only B verifier returned DONE in `19_b_followup_verifier_done.md`.
- C — Checked focused tests, package typecheck, and root check. Evidence: `20_c_followup_check.md`.

## Files changed for this follow-up

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
  - `ctrl+t` full transcript overlay now opens at bottom/latest on first render and preserves user scroll offset while open.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `ctrl+o` now gates both chat and live-tool containers by `liveToggleEligible`, so committed previous turns are not expanded/collapsed.
- `packages/coding-agent/src/modes/controllers/event-controller.ts`
  - Streaming assistant `toolCall` components are marked live-toggle eligible when created, so current-turn Jaw/tool output is included in `ctrl+o`.
- `packages/coding-agent/test/full-transcript-overlay.test.ts`
  - Added bottom-start, upward scroll, offset preservation, fresh-overlay re-pin tests.
- `packages/coding-agent/test/input-controller-keybindings.test.ts`
  - Added eligible-only `ctrl+o` tests for chat/live-zone children and post-commit ineligibility behavior.
- `packages/coding-agent/test/modes/controllers/event-controller-message-start.test.ts`
  - Added streaming `toolCall` live eligibility regression.
- `structure/31_scroll.md`
  - Documented current-turn-only `ctrl+o`, retained thinking coupling, and bottom-start `ctrl+t` pager.
- `packages/coding-agent/src/task/index.ts`
  - Fixed an unrelated syntax break encountered during verification so the package could parse and tests could run.
- `packages/coding-agent/src/jwc-runtime/actor-registry.ts` / `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
  - Mechanical Biome/root-check cleanup from pre-existing gate failures.

## Acceptance criteria

- AC1 `ctrl+t` opens full transcript at bottom/latest: met.
- AC2 `ctrl+t` preserves user scroll offset after first render and re-pins only for fresh overlay: met.
- AC3 `ctrl+t` scrolls upward and closes with `ctrl+t`/`q`/`esc`: met.
- AC4 `ctrl+o` expands/collapses only `liveToggleEligible` components: met.
- AC5 streaming assistant `toolCall` components are live-toggle eligible before turn commit: met.
- AC6 focused streaming regression exists: met.
- AC7 expanded current-turn output remains expanded after commit/ineligibility: met by focused regression simulation.
- AC8 previous committed turns are excluded from both expand and collapse: met.
- AC9 focused tests pass: met (`46 pass`).
- AC10 package typecheck passes: met.
- AC11 root check passes: met.

## Verification

- Focused tests: `46 pass`, `0 fail`, `227 expect() calls`.
- `bun --cwd=packages/coding-agent run check:types`: pass.
- `bun run check`: pass, with non-failing existing unused-helper warnings in `packages/coding-agent/src/task/index.ts`.

## WONDER

- Not covered: a real terminal/tmux visual capture of `ctrl+o` across an actual multi-tool streaming turn. The regression tests cover the controller/component state, not the rendered terminal pixels.
- Build assumption corrected: the repo had an unrelated parse break in `task/index.ts`; verification could not proceed until that syntax was repaired.
- Integration risk: `ctrl+o` still depends on every newly created live component being explicitly marked eligible. The pre-merge audit and streaming test guard the discovered gap, but future component paths need the same pattern.

## REFLECT

- Future specs should state up front that `ctrl+o` is a current-turn preview toggle, not a full-history operation, and that committed scrollback cannot be mutated.
- Acceptance criteria should distinguish direct `commitFinalizedBacklog()` proof from simulated ineligibility proof if exact commit invocation is required.
- The ontology should name two separate surfaces: `inline live-turn preview toggle` (`ctrl+o`) and `full transcript pager` (`ctrl+t`). That avoids mixing scrollback mutation, transcript rendering, and tool-only transcript behavior.
