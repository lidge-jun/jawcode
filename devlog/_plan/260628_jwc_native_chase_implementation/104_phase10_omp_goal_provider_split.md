# 104 Phase 10 split — 20.014 OMP goal compaction and provider concurrency

## Source card

`struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md`

## JWC posture

Reference-only split. OMP goal/compaction/provider concurrency must be checked against JWC goal runtime, compaction/session logic, task spawn gates, and AI provider limiters. Coordinate with GJC `10.040` before any code.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| goal runtime | `packages/coding-agent/src/goals/**`; `packages/coding-agent/src/jwc-runtime/goal-*`; goal tests |
| compaction/session | `packages/coding-agent/src/session/**`; `packages/agent/src/compaction/**`; compaction/session tests |
| task spawn/concurrency | `packages/coding-agent/src/task/**`; task tests |
| provider concurrency | `packages/ai/src/providers/**`; provider tests |

## Split decisions

| Slice | Decision | Rationale | Required future evidence |
|---|---|---|---|
| `20.014-A` goal threshold on billed context | adapt only if JWC goal runtime lacks equivalent | goal budget language was intentionally removed elsewhere | goal runtime tests |
| `20.014-B` snapcompact/manual compact sizing | coordinate with GJC `10.040` | compaction is already tracked in GJC runtime context phase | compaction tests |
| `20.014-C` provider limiter resize/backoff | split per provider | cross-provider concurrency behavior differs | provider-specific limiter/backoff tests |
| `20.014-D` semaphore/task spawn abort release | adapt only after concurrency audit | high regression risk under abort/race | task spawn/concurrency tests |

## Reject/defer

- Do not reintroduce deprecated goal budget semantics.
- Do not change provider concurrency globally based on OMP behavior.
- Do not modify compaction/session code in this docs-first split.

## Done-gate status

No `20.014` done-gate is closed by this split. The card remains reference-only and active.
