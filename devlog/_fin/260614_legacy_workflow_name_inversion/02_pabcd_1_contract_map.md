# PABCD-1 — contract map and compatibility policy

Status: planning artifact; no product-source mutation.

## Goal

Freeze the canonical/legacy vocabulary before touching runtime code.

## Plan-stage questions

- Canonical skill ids: `plan`, `goal`.
- Legacy aliases: `ralplan`, `ultragoal`.
- Determine whether `orchestrate-plan` is needed as an internal id or whether `plan` is sufficient.
- Decide read/write behavior for dual state paths:
  - read old and new, write new only
  - read old and new, write both during transition
  - keep old storage paths but canonicalize payload ids only

## Affected files

- `packages/coding-agent/src/jwc-runtime/state-schema.ts`
- `packages/coding-agent/src/jwc-runtime/workflow-manifest.ts`
- `packages/coding-agent/src/jwc-runtime/workflow-manifest.generated.json`
- `packages/coding-agent/src/skill-state/workflow-state-contract.ts`
- `packages/coding-agent/test/fixtures/jwc-state/**`

## Acceptance criteria

- Canonical write-side ids are documented.
- Legacy aliases are explicit and one-way: `ralplan -> plan`, `ultragoal -> goal`.
- Tests prove legacy fixture reads still work before writer changes land.
- No public prompt tells agents to invoke `/skill:ralplan` or `/skill:ultragoal` as preferred paths.

## Verification

- Focused state schema tests.
- Fixture read-compat tests.
- Default workflow definition tests.


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
