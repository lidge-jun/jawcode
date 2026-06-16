# PABCD-3 — plan writer command flip

Status: planning artifact; depends on PABCD-1 command decision.

## Goal

Replace the canonical plan artifact writer surface currently exposed as `jwc ralplan --write` with a new canonical plan writer, while keeping `jwc ralplan --write` as a compatibility alias.

## Open command decision

Choose one canonical writer:

1. `jwc plan --write --stage ...`
2. `jwc orchestrate artifact --stage ...`
3. `jwc orchestrate write-plan --stage ...`

Recommended default: `jwc plan --write` if a first-class `plan` command is accepted; otherwise `jwc orchestrate artifact`.

## Patch shape

- Add canonical writer command path.
- Keep `jwc ralplan --write` alias with deprecation note.
- Update restricted role-agent bash allowlists from `jwc ralplan --write` to the canonical writer plus legacy alias if needed.
- Update Planner/Architect/Critic prompts.
- Change receipts/audit payloads to `skill: "plan"` for new writes.

## Affected files

- `packages/coding-agent/src/jwc-runtime/plan-writer.ts`
- `packages/coding-agent/src/commands/ralplan.ts`
- possibly new `packages/coding-agent/src/commands/plan.ts`
- `packages/coding-agent/src/tools/bash-allowed-prefixes.ts`
- `packages/coding-agent/src/prompts/agents/planner.md`
- `packages/coding-agent/src/prompts/agents/architect.md`
- `packages/coding-agent/src/prompts/agents/critic.md`
- `packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts`

## Verification

- Canonical writer persists plan artifacts.
- Legacy `jwc ralplan --write` still persists equivalent artifacts.
- Restricted role-agent bash accepts canonical writer and rejects unsafe commands.
- Receipts do not echo full markdown bodies.


## Jaw Interview Round 3 decision — 2026-06-14T14:26:41.417350+00:00

Decision: use the agent recommendation for the canonical plan artifact writer: **`jwc planphase --write`**.

Recorded interview steering:

- Do not ask the user mechanical/logical questions that can be derived from existing repository patterns.
- Decide implementation-mechanics defaults directly when the repo already implies a safe answer.
- Ask the user only higher-level semantic/product-policy questions: compatibility posture, naming meaning, break tolerance, and user-facing doctrine.
- Batch several independent semantic questions when useful instead of one narrow implementation question at a time.

Derived defaults to carry into later PABCD plans unless contradicted:

- `jwc planphase --write` is canonical for plan-phase artifact persistence.
- `jwc ralplan --write` remains a deprecated compatibility alias during migration.
- Role-agent allowlists should move to `jwc planphase --write` plus temporary legacy alias acceptance.
- New receipts should use canonical skill/workflow id `planphase` or `plan` according to the final canonical-id decision, but command text should prefer `jwc planphase --write`.
- Storage path remains `.jwc/plans/planphase/`.


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
