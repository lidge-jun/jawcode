# 93 Phase 9 split — 10.049 performance bench corpus

## Source card

`struct_har/chase/10.049_gjc_chase_performance_bench_corpus.md`

## JWC posture

Treat this card as track-only unless a concrete gap beyond the closed perf corpus card is proven. JWC already has benchmark and perf-corpus owners; threshold changes must be deterministic and justified.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| perf corpus docs | `docs/perf-profiling-corpus.md`; `docs/cpu-hotspot-map.json`; review/verify artifacts |
| benchmark code | `packages/coding-agent/bench/**`; `scripts/eval-bench-runs.ts`; benchmark tests |
| perf corpus tests | `packages/coding-agent/test/perf-corpus.test.ts`; `packages/coding-agent/test/bench/context-optimization-effectiveness.test.ts` |
| session stats | `scripts/session-stats/**` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.049-A` | Track-only confirmation that `10.025` closed the existing perf/geobench work. | `_fin` path and current perf tests. |
| `10.049-B` | Add or adjust deterministic corpus/benchmark gates only for new uncovered JWC gaps. | benchmark tests, runtime variance notes, no generated artifact churn without need. |
| `10.049-C` | Update hotspot/profile docs only when new benchmark output exists. | docs diff plus generated artifact provenance. |

## Reject/defer

- Importing upstream geobench or corpus data wholesale.
- Updating thresholds based on a single noisy local run.
- Modifying generated PNG/JSON benchmark artifacts in a docs-first split.

## Done-gate status

No `10.049` done-gate is closed by this split. The card remains active.
