# 63 Phase 6 split — 10.051 and 20.009 tool-call/context integrity

## Source cards

- `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md`
- `struct_har/chase/20.009_omp_chase_append_only_context_integrity.md`

## JWC posture

`10.051` is the JWC implementation owner for tool-call/composer/context integrity. `20.009` stays OMP reference/split-audit evidence and must not independently drive code without a `10.051` overlap update.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| append-only session model | `docs/session.md`; `packages/coding-agent/src/session/session-manager.ts` |
| tool-choice forced queue | `packages/coding-agent/src/session/tool-choice-queue.ts`; `packages/coding-agent/test/tool-choice-queue.test.ts` |
| resolve/pending action flow | `docs/resolve-tool-runtime.md` |
| agent-wire event contracts | `packages/coding-agent/src/modes/shared/agent-wire/**`; `packages/coding-agent/test/agent-wire/**` |
| tool rendering/execution | `packages/coding-agent/src/modes/components/tool-execution.ts`; tool tests |

## Candidate slices

| Slice | Owner | Allowed future scope | Required evidence |
|---|---|---|---|
| `10.051-A` | `10.051` | Strengthen tool-choice queue lost-yield/requeue behavior tests. | focused `tool-choice-queue.test.ts` additions. |
| `10.051-B` | `10.051` | Agent-wire tool event correlation/digest tests if a concrete gap is found. | agent-wire fixture tests. |
| `20.009-A` | `10.051` + `20.009` | Append-only context source-anchor and overlap evidence only unless `10.051` selects an implementation slice. | docs/source recheck and focused JWC tests if adapted. |

## Reject/defer

- OMP snapshot parity tests that do not assert JWC behavior.
- Direct mutation of existing session entries to simulate append-only behavior.
- Tool-call digest/correlation changes without identifying the event envelope owner.

## Done-gate status

No `10.051` or `20.009` done-gate is closed by this split. `10.051` remains active; `20.009` remains reference-only.

