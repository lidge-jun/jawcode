# PABCD-2 — state and workflow manifest canonicalization

Status: planning artifact; depends on PABCD-1 decisions.

## Goal

Flip workflow/state canonical ids from `ralplan`/`ultragoal` to `plan`/`goal` while preserving old state readability.

## Patch shape

- Update `CANONICAL_JWC_WORKFLOW_SKILLS` to prefer `plan` and `goal`.
- Add read aliases for legacy ids.
- Update `WORKFLOW_MANIFEST` canonical keys and graph labels.
- Regenerate `workflow-manifest.generated.json` from source.
- Update state runtime cases to normalize old ids before dispatch.
- Decide path precedence when both `plan-state.json` and `ralplan-state.json` exist, and when both `goal-state.json` and `ultragoal-state.json` exist.

## Affected files

- `packages/coding-agent/src/jwc-runtime/state-schema.ts`
- `packages/coding-agent/src/jwc-runtime/state-runtime.ts`
- `packages/coding-agent/src/jwc-runtime/workflow-manifest.ts`
- `packages/coding-agent/src/jwc-runtime/workflow-manifest.generated.json`
- `packages/coding-agent/src/skill-state/active-state.ts`
- `packages/coding-agent/src/skill-state/workflow-state-contract.ts`

## Compatibility invariants

- Existing `.jwc/state/**/ralplan-state.json` remains readable.
- Existing `.jwc/state/**/ultragoal-state.json` remains readable.
- New receipts should say `plan`/`goal` after cutover.
- Legacy receipts normalize on read, not on historical disk mutation.

## Verification

- State read/write tests for new ids.
- Legacy fixture read tests.
- Stop/handoff tests for mixed old/new active state.


## Jaw Interview Round 4 semantic decisions — 2026-06-14T14:29:13.078234+00:00

Decisions:

1. Legacy names are **fully deprecated**.
   - `ralplan` / `ultragoal` appearing in user-facing prose, prompts, help, docs, or normal command recommendations is a bug after migration.
   - Internal aliases may remain only for compatibility reads and deprecated command/wire handling.

2. Migration conflict/failure posture is **best effort with warnings**.
   - Move what can be safely moved.
   - Preserve evidence and warnings for anything skipped or conflicting.
   - Do not silently discard old artifacts.
   - Do not fail the whole migration solely because one legacy artifact cannot be migrated, unless corruption would make continued operation unsafe.

3. RPC/API naming should also fully flip, but through phased PABCD cycles.
   - No permanent legacy wire-value doctrine.
   - Existing legacy RPC values may be accepted during compatibility phases.
   - New write/event/output contracts should converge to canonical `planphase` / `goal` values across subsequent PABCD cycles.

Derived implementation doctrine:

- Public/default prose after the migration should not advertise `/skill:ralplan`, `/skill:ultragoal`, `$ralplan`, `$ultragoal`, `jwc ralplan`, or `jwc ultragoal` except in explicit deprecation/migration diagnostics.
- Compatibility aliases should produce warnings or migration guidance where user-visible.
- PABCD cycles should progressively remove legacy wire values after compatibility tests and migration tooling exist.


## Jaw Interview Round 5 naming decision — 2026-06-14T14:30:28.850926+00:00

Decision:

- Public workflow name remains **`plan`**.
- Internal P-stage artifact/storage/writer contract becomes **`planphase`**.

Meaning:

- User-facing workflow surface: `/skill:plan` and `jwc orchestrate p`.
- Internal artifact writer: `jwc planphase --write`.
- Physical plan artifacts: `.jwc/plans/planphase/`.
- Runtime/state identifiers should use `plan` for the workflow concept where the public workflow is being represented, and `planphase` for P-stage artifact writer/storage contracts where disambiguation is needed.
- Legacy `ralplan` should be accepted only through deprecation/read-compat paths and should not appear in normal user-facing guidance.


## Jaw Interview Round 6 migration trigger decision — 2026-06-14T14:31:22.805195+00:00

Decision:

- There is no released/downloaded npm user base yet.
- Treat the rename as a **pre-release source-contract correction**, not as a public migration burden.
- Fresh installs should start directly with the new canonical names and paths.

Implications:

- No user-facing migration command is required as part of the default plan.
- No automatic migration-on-startup is required for external users.
- Product source, bundled defaults, generated manifests, tests, and fixtures should be rewritten to the new canonical contracts directly.
- Compatibility aliases can be kept only where they protect local developer state or intentional legacy tests, not because of public npm backwards compatibility.
- Best-effort migration logic can be limited to in-repo/local `.jwc` development artifacts if needed, but should not dominate the implementation plan.

Updated storage doctrine:

- New canonical plan artifact path: `.jwc/plans/planphase/`.
- New canonical goal ledger path: `.jwc/goal/`.
- Existing legacy paths are not public compatibility contracts; they are local/pre-release leftovers.
