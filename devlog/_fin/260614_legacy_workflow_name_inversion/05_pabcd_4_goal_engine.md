# PABCD-4 — goal engine and ultragoal contract flip

Status: planning artifact; storage path migration remains a separate decision.

## Goal

Make `goal` the canonical internal/source/skill value for the durable goal ledger while preserving legacy `ultragoal` data compatibility.

## Patch shape

- Rename remaining public-facing `ultragoal` prose to `goal`.
- Change pending goal-mode request `source` from `ultragoal` to `goal`, with read compatibility for old requests.
- Change workflow reconciliation from mode/skill `ultragoal` to `goal`, with legacy active-state read normalization.
- Rename constants such as `DEFAULT_ULTRAGOAL_OBJECTIVE` to `DEFAULT_GOAL_OBJECTIVE`, keeping aliases only if needed for compatibility.
- Prefer `jwc goal ...` in help/errors; keep `jwc ultragoal ...` as hidden/deprecated alias only if required.

## Affected files

- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts`
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`
- `packages/coding-agent/src/jwc-runtime/state-renderer.ts`
- `packages/coding-agent/src/commands/ultragoal.ts`
- `packages/coding-agent/test/jwc-runtime/ultragoal-runtime.test.ts`

## Compatibility invariants

- Existing `.jwc/ultragoal/goals.json` and `.jwc/ultragoal/ledger.jsonl` remain readable.
- Existing pending requests with `source: "ultragoal"` remain consumable.
- Stop hooks still block unsafe completion when legacy ledger state is active.

## Verification

- Goal engine tests for canonical `goal` source.
- Legacy ultragoal fixture/read tests.
- Stop hook / goal guard tests.
- CLI help smoke for `jwc goal` preferred wording.
