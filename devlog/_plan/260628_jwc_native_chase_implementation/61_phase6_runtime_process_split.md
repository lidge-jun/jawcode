# 61 Phase 6 split — 10.037 runtime process lifecycle

## Source card

`struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md`

## JWC posture

Adapt only concrete runtime lifecycle guards that match JWC's existing process/eval/exec architecture. Avoid broad GJC porting across native handlers, psmux, Python/eval, DAP/LSP, and shell lifecycles in one pass.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| bash execution and timeout mapping | `packages/coding-agent/src/exec/bash-executor.ts`; `docs/bash-tool-runtime.md` |
| JS/Python eval lifecycle | `packages/coding-agent/src/eval/**`; executor/kernel tests |
| idle timeout watchdog | `packages/coding-agent/src/exec/idle-timeout-watchdog.ts` |
| non-interactive environment | `packages/coding-agent/src/exec/non-interactive-env.ts` |
| session cleanup hooks | `packages/coding-agent/src/session/agent-session.ts` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.037-A` | Add or tighten abort/timeout cleanup tests around existing exec/eval owners. | focused tests for timeout/abort cleanup; no source clone copy. |
| `10.037-B` | Expand env scrubbing only if current `non-interactive-env.ts` misses concrete risky variables. | before/after env fixture tests. |
| `10.037-C` | DAP/LSP cleanup split if concrete owner/test gap appears. | owner files listed before code. |

## Reject/defer

- Broad psmux or native handler port without a JWC owner file and test.
- Runtime process-control changes that can kill unrelated processes.
- Any change that weakens existing abort semantics in `docs/bash-tool-runtime.md` or `docs/non-compaction-retry-policy.md`.

## Done-gate status

No `10.037` done-gate is closed by this split. The card remains active.

