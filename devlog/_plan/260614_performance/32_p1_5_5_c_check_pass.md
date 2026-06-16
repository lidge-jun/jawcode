PASS

Mechanical gates:
- `bun run check` — PASS (workspace biome/tsgo/schema/rebrand/Rust scope gates passed).
- `bun test packages/coding-agent/test/perf-corpus.test.ts` — PASS (11 pass / 99 expect calls).
- `bun packages/coding-agent/bench/perf-corpus.bench.ts` — PASS (emitted JSON with `schema: "jwc.perf-corpus/1"`).
- `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts` — PASS (emitted JSON with `warmGetEntriesCount: 4000` and finite RSS growth).
- `bun biome check packages/coding-agent/bench/perf-corpus-schema.ts packages/coding-agent/bench/perf-threshold.ledger.ts packages/coding-agent/bench/perf-corpus.bench.ts packages/coding-agent/bench/session-memory.bench.ts packages/coding-agent/test/perf-corpus.test.ts docs/perf-profiling-corpus.md docs/native-ffi-optimization-policy.md devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md devlog/_plan/260614_performance/02_patch_roadmap.md devlog/_plan/260614_performance/04_verification_matrix.md` — PASS.
- `bun --cwd=packages/coding-agent run check` — PASS (package biome + tsgo).

Adversarial review:
- `agent://7-P155CAdversarial` — PASS; no blocking findings.
- Notes: schema/runner/docs use `jwc.perf-corpus/1` and `jwc-session-memory-`; no stale `gjc` product literals in the new bench/test/docs slice; parent devlog 23/02/04 align P1.5.5 gates with corpus test plus two bench smoke commands; FFI doc links resolve to existing repo docs.

Acceptance criteria:
- Perf corpus bench emits valid `jwc.perf-corpus/1` JSON.
- Corpus report includes startup/session-load, streaming/TTFT, and large-transcript fixtures.
- Evidence classes stay separated and CPU-self-time overclaiming is rejected by tests.
- Threshold ledger is advisory by default, includes non-empty held thresholds, and rejects unevidenced enforced thresholds.
- Session memory bench supports cleanup-tested temp roots and emits finite RSS growth.
- Docs describe advisory/no-overclaiming and native FFI gates with existing local links.
- P1.5.1 TUI files were not modified in this slice.

Residual risk:
- Package-wide `bun test` was not run because C-stage plan scope required root check plus affected tests/benches; previously reported unrelated `default-jwc-definitions.test.ts` failure remains outside this P1.5.5 slice.
