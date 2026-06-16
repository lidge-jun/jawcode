# P1.5.5 — profiling corpus + FFI policy execution plan

> Status: PABCD P-stage draft (260615)
> Parent: `23_p1_5_upstream_v3_merge_plan.md`
> Scope: implement only P1.5.5 in this PABCD cycle. The larger goal remains active for P1.5.4/P1.5.3/P1.5.2 follow-up cycles.

## 1. Objective

Port the upstream Optimization Suite v3 profiling infrastructure into Jawcode as an additive measurement lane before heavier P1.5 merges. The implementation must provide a stable synthetic perf corpus, advisory threshold ledger, session retained-memory bench, corpus validation tests, and docs that prevent wall-clock/RSS proxy evidence from being mislabeled as CPU self-time proof.

## 2. Non-goals

- Do not modify TUI render behavior; P1.5.1 is already landed and must be preserved.
- Do not implement P1.5.2 resident cache lifecycle changes in this cycle.
- Do not implement P1.5.3 `resultDigest()` pruning changes in this cycle.
- Do not implement P1.5.4 secrets/diff/LCS test additions in this cycle.
- Do not add hard CI perf thresholds. New thresholds remain advisory until variance and human approval are recorded in the ledger.
- Do not commit raw private sessions or real user transcripts.

## 3. File-level plan

### NEW `packages/coding-agent/bench/perf-corpus-schema.ts`

Content outline:

- Export evidence taxonomy types:
  - `EvidenceClass = "wall-clock-proxy" | "process-cpu-usage" | "profiler-self-time" | "rss-memory" | "byte-parity" | "ledger-approved-threshold"`
  - `HotspotStatus = "CPU-self-time confirmed" | "fallback-toggle-confirmed" | "covered-current" | "not-visible" | "needs-trace-coverage"`
  - `FixtureClass`, `ParityVerdict`, `ProfilerKind`
- Export metric/report interfaces:
  - `WallClockPhaseMetric`, `ProcessCpuUsageMetric`, `ProfilerSelfTimeSample`, `ProfilerSelfTime`, `RssMemoryMetric`, `ByteParityMetric`, `PerfCorpusFixtureResult`, `HotspotClassification`, `ThresholdLedgerReference`, `PerfCorpusReport`
- Export constants:
  - `PERF_CORPUS_SCHEMA = "jwc.perf-corpus/1"`
  - `REQUIRED_FIXTURE_CLASSES = ["startup-session-load", "streaming-ttft", "large-transcript"]`
- Export validators:
  - `isHotspotStatus()`
  - `hasProfilerSelfTimeEvidence()`
  - `validateHotspotClassification()`
  - `validatePerfCorpusReport()`
- Export `V1_V3_RECLASSIFICATION` with the upstream H01-H11/M01-M05 classifications, preserving the no-overclaiming rule: no entry may be `CPU-self-time confirmed` without captured profiler evidence.

Sequencing note: start from upstream `devlog/_upstream_gjc/packages/coding-agent/bench/perf-corpus-schema.ts` and apply only the documented JWC schema/string deltas. Do not regenerate or re-rank hotspot entries in this slice.

Jawcode adjustment from upstream:

- Rename every schema literal occurrence from `gjc.perf-corpus/1` to `jwc.perf-corpus/1`: the exported `PERF_CORPUS_SCHEMA`, the `PerfCorpusReport.schema` literal type, runner output, tests, and docs must agree.
- Preserve hotspot IDs and evidence semantics; these are internal taxonomy labels, not legacy public command names.

### NEW `packages/coding-agent/bench/perf-threshold.ledger.ts`

Content outline:

- Export threshold evidence interfaces:
  - `PerfThresholdBenchmarkEvidence`
  - `PerfThresholdHumanApprovalEvidence`
  - `PerfThresholdEvidence`
- Export `APPLIED_PERF_THRESHOLDS` with advisory-only startup wall-clock and large-transcript RSS entries.
- Export `HELD_PERF_THRESHOLDS` for held enforced TTFT threshold candidate.
- Export `validatePerfThresholdLedger()` that rejects enforced thresholds without characterized variance, passed benchmark evidence, and human approval.

Jawcode adjustment from upstream:

- Use the actual upstream filename `perf-threshold.ledger.ts`; do not create the stale plan filename `perf-threshold.ledger`.
- Keep all default thresholds advisory.

### NEW `packages/coding-agent/bench/perf-corpus.bench.ts`

Content outline:

- Import `APPLIED_PERF_THRESHOLDS` from `./perf-threshold.ledger` and schema/types from `./perf-corpus-schema`.
- Define deterministic `mulberry32()` fixtures.
- Define measurement helpers:
  - `measurePhase()` captures wall-clock and `process.cpuUsage()` separately.
  - `measureRss()` captures baseline/peak/return RSS and heap return when GC is available.
- Define synthetic workloads:
  - `startupWorkload()`
  - `streamingWorkload()`
  - `largeTranscriptWorkload()`
- Export `runPerfCorpusBenchmark()` returning `PerfCorpusReport` and validating it before returning.
- When run as main, emit stable JSON to stdout.

No behavior changes to product runtime.

### NEW `packages/coding-agent/bench/session-memory.bench.ts`

Content outline:

- Import Node modules as namespace imports per repo convention:
  - `import * as fs from "node:fs"`
  - `import * as os from "node:os"`
  - `import * as path from "node:path"`
- Import `SessionManager` from `../src/session/session-manager` and `RssMemoryMetric` from `./perf-corpus-schema`.
- Export `SessionMemoryReport`.
- Export `measureSessionMemory(entryCount = 4_000, largeBodyChars = 2_048, options?: { rootParent?: string })`:
  - create a temp session root with a `jwc-session-memory-` prefix under `options.rootParent ?? os.tmpdir()`,
  - create `SessionManager.create(root, path.join(root, "sessions"))`,
  - append deterministic large-body user messages via `manager.appendMessage({ role: "user", content, timestamp })`,
  - call `getEntries()` once to warm materialization,
  - capture RSS/heap growth and GC return samples,
  - throw if RSS growth is non-finite,
  - delete the temp root in `finally`.
- When run as main, emit report JSON.

Jawcode adjustment from upstream:

- Temp prefix must be `jwc-session-memory-`, not `gjc-session-memory-`.

### NEW `packages/coding-agent/test/perf-corpus.test.ts`

Content outline:

- Import `runPerfCorpusBenchmark()`, `measureSessionMemory()`, and schema/ledger validators.
- Tests:
  1. runner emits `jwc.perf-corpus/1`, separated evidence fields, and all required fixture classes;
  2. base runner attaches no profiler and therefore has no CPU-self-time-confirmed hotspots;
  3. direct classification validation rejects CPU-self-time overclaims;
  4. report validation rejects fabricated CPU-self-time claims without matching fixture profiler evidence;
  5. report validation accepts CPU-self-time claims once a real fixture profiler artifact/sample is present;
  6. mismatched artifact refs are rejected;
  7. `profiler: "none"` fixtures cannot anchor CPU-self-time claims even with stray artifacts;
  8. v1-v3 reclassification vocabulary is valid, contains exactly 16 inherited entries (H01-H11 + M01-M05), and contains no CPU-self-time overclaims;
  9. threshold ledger keeps applied thresholds valid/advisory, exports a non-empty `HELD_PERF_THRESHOLDS`, and rejects unevidenced enforced thresholds;
  10. session-memory bench returns the expected warm entry count, finite RSS growth, and removes its `jwc-session-memory-*` temp directory when run against a test-owned temp parent.

### NEW `docs/perf-profiling-corpus.md`

Content outline:

- Explain the corpus as the successor to static `docs/cpu-hotspot-map.json` ranking.
- Reference implementation files:
  - `packages/coding-agent/bench/perf-corpus-schema.ts`
  - `packages/coding-agent/bench/perf-corpus.bench.ts`
  - `packages/coding-agent/bench/perf-threshold.ledger.ts`
  - `packages/coding-agent/test/perf-corpus.test.ts`
- Document evidence taxonomy, schema fields, privacy rules, commands, profiler artifact requirements, threshold-promotion process, and memory-retention notes.
- Keep docs honest that the base runner is synthetic/advisory and does not prove CPU self-time.

Jawcode adjustments from upstream:

- Use `jwc.perf-corpus/1` in docs.
- Use JWC/Jawcode wording and public paths/commands.
- Do not link to missing `docs/hotspot-map-successor.md`; mention the successor concept in prose unless that file exists.
- Rebrand public product/schema/temp-prefix literals (`gjc.perf-corpus/1`, `gjc-session-memory-*`, public GJC wording) to JWC equivalents. Preserve existing code-owned environment variable names when they already exist in this repo, e.g. `PI_TUI_PERF_GATES`.

### NEW `docs/native-ffi-optimization-policy.md`

Content outline:

- ADR for speculative native FFI optimization gates.
- Require corpus evidence, self-time/fallback-toggle evidence, FFI overhead measurement, representative p50/p95 win, byte parity, and operational cost documentation before new algorithmic Rust/N-API ports land.
- Reference existing native docs that exist locally:
  - `docs/porting-to-natives.md`
  - `docs/natives-architecture.md`
  - `docs/natives-binding-contract.md`
  - `docs/cpu-hotspot-map.json`
- Preserve the scope boundary for already-native platform/system primitives.

Jawcode adjustments from upstream:

- Use JWC/Jawcode wording.
- Remove/avoid links to missing `docs/hotspot-map-successor.md`.
- Scrub upstream prose for product-facing `gjc.perf-corpus/1` / GJC wording while preserving historical commit/PR context where needed.

### MODIFY `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md`

Before:

```md
packages/coding-agent/bench/perf-threshold.ledger
...
perf-threshold.ledger dependency
```

After:

```md
packages/coding-agent/bench/perf-threshold.ledger.ts
...
perf-threshold.ledger.ts dependency
```

Reason: upstream file discovery shows the dependency is `perf-threshold.ledger.ts`, and `perf-corpus.bench.ts` imports `./perf-threshold.ledger` via TypeScript extension resolution.

Execution checklist for this parent file:
- Section 4 missing-focused-files list must include `packages/coding-agent/test/perf-corpus.test.ts` and `packages/coding-agent/bench/perf-threshold.ledger.ts`.
- Section 5 P1.5.5 file list must use `perf-threshold.ledger.ts` and include the test file.
- Section 6 recommended order remains unchanged.
- Section 7 P1.5.5 verification row must include `bun test packages/coding-agent/test/perf-corpus.test.ts` plus the two bench smoke commands.
- All stale `perf-threshold.ledger` path mentions must become `perf-threshold.ledger.ts`.

### MODIFY `devlog/_plan/260614_performance/02_patch_roadmap.md`

Replace the P1.5.5 roadmap wording that says or implies “latency gates” with the P1.5.5-specific contract:
- hard gate: `bun test packages/coding-agent/test/perf-corpus.test.ts`;
- smoke gates: `bun packages/coding-agent/bench/perf-corpus.bench.ts` and `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts`;
- TUI input/latency gates belong to P1.5.1 and are not newly introduced by this slice.

### MODIFY `devlog/_plan/260614_performance/04_verification_matrix.md`

Replace the P1.5.5 row that says “Latency gates pass” with:
- corpus schema/ledger/session-memory test passes;
- both P1.5.5 bench commands exit 0 and emit JSON;
- no additional TUI latency gate files are added in P1.5.5.

## 4. Verification plan

Focused P1.5.5 gates:

```bash
bun test packages/coding-agent/test/perf-corpus.test.ts
bun packages/coding-agent/bench/perf-corpus.bench.ts
bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts
bun biome check packages/coding-agent/bench/perf-corpus-schema.ts packages/coding-agent/bench/perf-threshold.ledger.ts packages/coding-agent/bench/perf-corpus.bench.ts packages/coding-agent/bench/session-memory.bench.ts packages/coding-agent/test/perf-corpus.test.ts docs/perf-profiling-corpus.md docs/native-ffi-optimization-policy.md devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md devlog/_plan/260614_performance/02_patch_roadmap.md devlog/_plan/260614_performance/04_verification_matrix.md
```

C-stage contract:
- `bun test packages/coding-agent/test/perf-corpus.test.ts` is the hard pass/fail gate for schema validation, threshold-ledger invariants, CPU-self-time overclaim rejection, and session-memory temp cleanup / finite RSS via the small test fixture.
- The two bench commands are smoke gates: they must exit 0 and emit JSON. The session-memory command exits nonzero if RSS growth is non-finite.
- This cycle does not add separate latency-gate files; corpus schema validation plus bench smoke runs satisfy P1.5.5. Existing TUI latency gates from P1.5.1 are preserved but outside this execution slice.

Package-level gate (non-blocking for this P1.5.5 slice; run when focused gates pass and command time allows):

```bash
bun --cwd=packages/coding-agent run check
```

## 5. Acceptance criteria

- `packages/coding-agent/bench/perf-corpus.bench.ts` emits valid JSON with `schema: "jwc.perf-corpus/1"`.
- Corpus report includes all required fixture classes: startup/session load, streaming/TTFT, and large transcript.
- Wall-clock, process CPU, profiler self-time, RSS, and byte-parity fields remain separate; validation rejects CPU-self-time overclaims that lack real profiler evidence.
- Threshold ledger is imported by the bench, applied thresholds are advisory-only, `HELD_PERF_THRESHOLDS` is non-empty, and enforced thresholds without evidence are rejected by tests.
- Session memory bench runs without leaving temp directories and emits finite RSS growth.
- Docs describe the advisory/no-overclaiming contract and JWC-first paths without stale product-facing `gjc` names.
- `docs/native-ffi-optimization-policy.md` names all six native-optimization gates, preserves the already-native scope boundary, and links only to docs that exist in this repo.
- Existing P1.5.1 TUI files remain untouched by this cycle.

## 6. Risk controls

- Additive-only product effect: no runtime callsites import the new benches/tests/docs.
- All generated benchmark data is synthetic or process-local metrics; no private transcript fixtures are committed.
- Numeric perf thresholds remain advisory to avoid CI flake.
- Existing package docs are referenced only when the target docs exist in this repo.

## 7. Follow-up after this cycle

Keep the goal active and proceed to the next P1.5 value slice after P1.5.5 is verified:

1. P1.5.4 secrets/diff/LCS test additions.
2. P1.5.3 targeted `resultDigest()` / staleness parity port.
3. P1.5.2 resident cache lifecycle/manual session-manager merge.
