# C-stage Check Report — Legacy workflow name inversion

Verdict: NEEDS_FIX (mechanical gate red, route back to B)

## Green evidence for legacy-name inversion slice

- Focused legacy-name inversion tests: `bun test packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts packages/coding-agent/test/jwc-runtime/ultragoal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/state-schema.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/prompt-action-skill-autocomplete.test.ts packages/coding-agent/test/jwc-skill-state-hooks.test.ts packages/coding-agent/test/skill-active-state.test.ts packages/coding-agent/test/skill-hud-bar.test.ts packages/coding-agent/test/status-line-workflow-readers.test.ts packages/coding-agent/test/workflow-gate-broker.test.ts packages/coding-agent/test/workflow-approval-gates.test.ts packages/coding-agent/test/rpc-client-workflow-gate.test.ts packages/coding-agent/test/rpc-workflow-gate.test.ts` → 274 pass, 0 fail.
- Workflow/default gates: `bun scripts/generate-jwc-workflow-manifest.ts --check && bun scripts/check-visible-definitions.ts && bun scripts/verify-g002-gates.ts && bun scripts/rebrand-inventory.ts --strict && bun scripts/check-public-legacy-zero.ts` → passed.
- `bun run check:ts` passed Biome, Node 20 baseline, schema check, UI redesign check, rebrand strict, and all workspace checks except coding-agent type errors listed below.

## Red mechanical gate evidence

`bun run check` / `bun run check:ts` remain red because current repo state has unrelated non-legacy-name-inversion failures:

1. Rust scope guard rejects vendored Rust sources under `devlog/_upstream_omp/`.
2. `@gajae-code/coding-agent` typecheck fails in the harness/RPC state lane:
   - `src/harness-control-plane/phase-rollup.ts` imports `canonicalJson`, `PhaseRollupChildPointer`, and `PhaseRollupEvidence` from `./receipts`, but those exports are not present.
   - `phase-rollup` is not part of the current `ReceiptFamily` union.
   - owner-review/phase-rollup tests expect missing receipt evidence fields.
   - `test/rpc-get-state-payload.test.ts` still expects `get_state.include`, but the current RPC command type excludes `include`.

## Routing

The C-stage mechanical gate is red, so PABCD must not advance to D. This routes back to B for code-fix work. The legacy-name inversion slice itself has focused green evidence; the remaining red gate is outside the legacy-name inversion contract and should be handled as the next B-stage blocker before C can pass.
