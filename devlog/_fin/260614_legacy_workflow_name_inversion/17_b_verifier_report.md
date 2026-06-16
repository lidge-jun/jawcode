# B-stage Verification Report — Legacy workflow name inversion

Verdict: DONE

## Read-only verifier lanes

- Contract/state verifier: first pass found a high-severity active-state normalization gap; fixed by normalizing top-level legacy `ralplan`/`ultragoal` active-state fallbacks to canonical `plan`/`goal` in `packages/coding-agent/src/skill-state/active-state.ts`.
- Runtime verifier: DONE / CLEAR for `planphase` writer and `goal` runtime/storage surfaces.
- Surface verifier: DONE / CLEAR for bundled default definitions and skill prompt surfaces.

## Fresh mechanical evidence

- `bun test packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts packages/coding-agent/test/jwc-runtime/ultragoal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/state-schema.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/prompt-action-skill-autocomplete.test.ts packages/coding-agent/test/jwc-skill-state-hooks.test.ts packages/coding-agent/test/skill-active-state.test.ts packages/coding-agent/test/skill-hud-bar.test.ts packages/coding-agent/test/status-line-workflow-readers.test.ts packages/coding-agent/test/workflow-gate-broker.test.ts packages/coding-agent/test/workflow-approval-gates.test.ts packages/coding-agent/test/rpc-client-workflow-gate.test.ts packages/coding-agent/test/rpc-workflow-gate.test.ts` → 274 pass, 0 fail, 1031 expect calls.
- `bun scripts/generate-jwc-workflow-manifest.ts --check && bun scripts/check-visible-definitions.ts && bun scripts/verify-g002-gates.ts && bun scripts/rebrand-inventory.ts --strict && bun scripts/check-public-legacy-zero.ts` → all gates passed, including active public legacy identity zero.
- CLI/help smoke: `jwc interview --help`, `jwc skills --help`, `jwc state --help`, `jwc goal --help`, `jwc planphase --help`, and `jwc ultragoal --help` completed; `jwc ralplan` intentionally exits 2 with deprecation guidance pointing to `jwc orchestrate p` and `jwc planphase --write`.

## Notes

A broad `bun check` was attempted and failed on unrelated pre-existing formatting/parser diagnostics outside this change lane, including `packages/coding-agent/src/coordinator-mcp/server.ts` duplicate imports and formatter-only findings in unrelated package files. Focused changed-file Biome check passed for the touched legacy-name inversion source set.
