DONE

Read-only verification completed against `devlog/_plan/260614_performance/24_p1_5_5_profiling_infra_execution_plan.md`.

Findings:
- All requested P1.5.5 files exist and were inspected.
- `perf-corpus-schema.ts` exports `PERF_CORPUS_SCHEMA = "jwc.perf-corpus/1"`, the report schema literal matches, required fixture classes are present, and validation rejects CPU-self-time claims unless artifact refs match real profiler fixture evidence.
- `perf-threshold.ledger.ts` contains advisory applied thresholds for startup wall-clock and large-transcript RSS, plus non-empty held TTFT threshold candidates; enforced threshold validation requires variance, benchmark evidence, and human approval.
- `perf-corpus.bench.ts` imports the threshold ledger, emits `jwc.perf-corpus/1`, includes startup/session-load, streaming/TTFT, and large-transcript synthetic fixtures, and validates before returning.
- `session-memory.bench.ts` supports `options.rootParent`, uses the `jwc-session-memory-` temp prefix, warms `getEntries()`, checks finite RSS growth, and removes the temp root in `finally`.
- `perf-corpus.test.ts` covers separated fields, no-profiler base runner, CPU-self-time overclaim rejection, matching/mismatched profiler artifacts, `profiler: "none"` rejection, 16-entry v1-v3 vocabulary, advisory/held threshold invariants, and session temp cleanup.
- `docs/perf-profiling-corpus.md` documents the successor concept without linking to missing `hotspot-map-successor.md`, uses `jwc.perf-corpus/1`, and explains advisory/no-overclaiming semantics.
- `docs/native-ffi-optimization-policy.md` names all six FFI gates and links only to existing local docs.
- Parent devlog files reflect `perf-threshold.ledger.ts`, include the P1.5.5 test/bench gates, and align P1.5.5 with corpus/bench verification rather than new TUI latency gates.

Main-session focused gates already run:
- `bun test packages/coding-agent/test/perf-corpus.test.ts` → 11 pass / 99 expect calls.
- `bun packages/coding-agent/bench/perf-corpus.bench.ts` → emitted JSON with `schema: "jwc.perf-corpus/1"`.
- `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts` → emitted JSON with finite RSS growth and warm entry count 4000.
- `bun biome check ...` for all P1.5.5 files/devlog docs → OK.
- `bun --cwd=packages/coding-agent run check` → biome + tsgo pass.
