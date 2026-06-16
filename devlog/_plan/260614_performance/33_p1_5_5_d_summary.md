# P1.5.5 D summary — profiling corpus + FFI policy

## PABCD cycle summary

- P: Planned the P1.5.5 additive profiling infrastructure lane in `24_p1_5_5_profiling_infra_execution_plan.md`, including schema, threshold ledger, corpus bench, session-memory bench, tests, docs, and parent devlog alignment.
- A: Dual audit passed after synthesis-backed delta review: `29_p1_5_5_audit_planner_r2.md` and `30_p1_5_5_audit_architect_r2.md`.
- B: Built the lane and received B-stage verifier DONE in `31_p1_5_5_b_verifier_done.md`.
- C: Mechanical gates and adversarial review passed in `32_p1_5_5_c_check_pass.md`.

## Files changed for this slice

New implementation/test/docs:

- `packages/coding-agent/bench/perf-corpus-schema.ts`
- `packages/coding-agent/bench/perf-threshold.ledger.ts`
- `packages/coding-agent/bench/perf-corpus.bench.ts`
- `packages/coding-agent/bench/session-memory.bench.ts`
- `packages/coding-agent/test/perf-corpus.test.ts`
- `docs/perf-profiling-corpus.md`
- `docs/native-ffi-optimization-policy.md`

Updated performance plan docs:

- `devlog/_plan/260614_performance/02_patch_roadmap.md`
- `devlog/_plan/260614_performance/04_verification_matrix.md`
- `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md`
- `devlog/_plan/260614_performance/24_p1_5_5_profiling_infra_execution_plan.md`
- `devlog/_plan/260614_performance/25_p1_5_5_critic_synthesis_round1.md`
- `devlog/_plan/260614_performance/26_p1_5_5_audit_planner_r1.md`
- `devlog/_plan/260614_performance/27_p1_5_5_audit_architect_r1.md`
- `devlog/_plan/260614_performance/28_p1_5_5_audit_synthesis_round1.md`
- `devlog/_plan/260614_performance/29_p1_5_5_audit_planner_r2.md`
- `devlog/_plan/260614_performance/30_p1_5_5_audit_architect_r2.md`
- `devlog/_plan/260614_performance/31_p1_5_5_b_verifier_done.md`
- `devlog/_plan/260614_performance/32_p1_5_5_c_check_pass.md`

## Acceptance criteria met

- `perf-corpus.bench.ts` emits valid JSON with `schema: "jwc.perf-corpus/1"`.
- Corpus includes required startup/session-load, streaming/TTFT, and large-transcript fixture classes.
- Wall-clock, process CPU, profiler self-time, RSS, and byte-parity fields remain separated.
- Validation rejects CPU-self-time overclaims without real profiler fixture evidence.
- Threshold ledger is imported by the bench, keeps applied thresholds advisory-only, includes non-empty held thresholds, and rejects unevidenced enforced thresholds.
- Session-memory bench supports a test-owned temp parent, cleans up `jwc-session-memory-*`, and emits finite RSS growth.
- Docs describe advisory/no-overclaiming, JWC-first schema naming, and six native FFI gates with existing local links.
- P1.5.1 TUI files were not touched in this slice.

## Verification evidence

- `bun run check` — PASS.
- `bun test packages/coding-agent/test/perf-corpus.test.ts` — PASS, 11 tests / 99 expects.
- `bun packages/coding-agent/bench/perf-corpus.bench.ts` — PASS, emitted `jwc.perf-corpus/1` JSON.
- `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts` — PASS, emitted finite RSS JSON.
- Focused `bun biome check ...` — PASS.
- `bun --cwd=packages/coding-agent run check` — PASS.
- C adversarial review — PASS.

## WONDER

- The corpus is synthetic; it proves schema/ledger/report behavior but not real-world CPU self-time for specific hotspots.
- `validatePerfCorpusReport()` intentionally validates report structure and overclaiming, while required fixture-class coverage remains a test/runner contract rather than validator-level enforcement.
- The retained-memory bench exercises large text sessions but does not yet cover the full P1.5.2 resident lifecycle/fail-closed materialization merge.

## REFLECT

- Future perf plans should name whether a verification command is a hard gate, smoke gate, optional package gate, or broad release gate at first draft.
- Plans that copy upstream docs/code should require explicit product-schema and literal-type rebrand checks, not only prose-string replacement.
- The P1.5 parent plan should keep each lane’s tests beside the file inventory to avoid hidden dependencies like `perf-threshold.ledger.ts`.

## Goal continuation

This closes the P1.5.5 PABCD cycle only. The active goal remains unfinished because P1.5.4, P1.5.3, and P1.5.2 remain in the planned value order.
