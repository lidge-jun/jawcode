# P1.5.5 A-stage audit synthesis — round 1

> Plan: `devlog/_plan/260614_performance/24_p1_5_5_profiling_infra_execution_plan.md`
> Planner audit: `devlog/_plan/260614_performance/26_p1_5_5_audit_planner_r1.md`
> Architect audit: `devlog/_plan/260614_performance/27_p1_5_5_audit_architect_r1.md`
> Runtime note: the planner FAIL artifact was accidentally parsed as pass by the current verdict parser; this synthesis treats the planner report as FAIL and accepts the findings. No waiver is used.

## Findings and resolutions

### PLANNER-A1 — Parent roadmap/matrix latency wording not owned

Decision: accept.

Resolution: the plan now includes explicit MODIFY sections for:
- `devlog/_plan/260614_performance/02_patch_roadmap.md`
- `devlog/_plan/260614_performance/04_verification_matrix.md`

The required replacement contract is: `perf-corpus.test.ts` is the hard P1.5.5 gate, the two P1.5.5 bench commands are JSON smoke gates, and TUI latency gates belong to P1.5.1.

### PLANNER-A2 / ARCH-A3 — Parent P1.5 plan stale `perf-threshold.ledger` and missing test inventory

Decision: accept.

Resolution: the `23_p1_5_upstream_v3_merge_plan.md` MODIFY section now enumerates every parent section that must be updated: missing-focused-files list, P1.5.5 file list, P1.5.5 verification row, and all stale `perf-threshold.ledger` path mentions.

### PLANNER-A3 — HELD thresholds omitted from test contract

Decision: accept.

Resolution: test 9 now explicitly requires `HELD_PERF_THRESHOLDS` to be exported and non-empty, in addition to applied/advisory thresholds and enforced-threshold rejection.

### PLANNER-A4 — Native FFI ADR acceptance not independently checkable

Decision: accept.

Resolution: acceptance criteria now require `docs/native-ffi-optimization-policy.md` to name all six native-optimization gates, preserve the already-native scope boundary, and link only to docs that exist in this repo.

### PLANNER-A5 / ARCH-A4 — Rebrand and stale-link scrub ambiguity

Decision: accept.

Resolution: docs sections now require public product/schema/temp-prefix literals to be rebranded to JWC equivalents, existing code-owned env vars such as `PI_TUI_PERF_GATES` to be preserved, missing `hotspot-map-successor.md` links to be removed/avoided, and upstream GJC prose to be scrubbed when product-facing.

### PLANNER-A6 — Reclassification cardinality missing

Decision: accept.

Resolution: test 8 now requires exactly 16 inherited entries (H01-H11 + M01-M05) and no CPU-self-time overclaims.

### PLANNER-A7 — Package check ambiguity

Decision: accept.

Resolution: package check is explicitly non-blocking for the P1.5.5 slice; focused tests and bench smoke commands are the C-stage contract.

### PLANNER-A8 — Schema port source/drift ambiguity

Decision: accept.

Resolution: schema section now states to start from upstream `devlog/_upstream_gjc/packages/coding-agent/bench/perf-corpus-schema.ts` and apply only documented JWC schema/string deltas.

### ARCH-A1 — Schema literal type rebrand incomplete

Decision: accept.

Resolution: schema adjustment now requires all schema literal occurrences to move from `gjc.perf-corpus/1` to `jwc.perf-corpus/1`, including exported constant, `PerfCorpusReport.schema` literal type, runner output, tests, and docs.

### ARCH-A2 — Session-memory options/test are not upstream

Decision: accept.

Resolution: session-memory outline already required `options.rootParent`, `jwc-session-memory-`, and cleanup test; the plan now keeps those as explicit JWC deltas rather than a straight upstream copy.

### ARCH-A5 — Duplicate `mulberry32()` hazard

Decision: accept as bounded.

Resolution: no plan change needed beyond maintaining bench-local isolation. The plan does not extract shared utilities, so existing `context-optimization.bench.ts` remains untouched.

### ARCH-A6 / ARCH-A7 — Informational confirmations

Decision: accept as non-blocking evidence.

Resolution: no plan change needed. They confirm SessionManager API compatibility and low gate/rebrand risk if the updated docs/schema contract is followed.

## Residual risk

The only residual risk is parser brittleness around audit headings. Re-audit artifacts must begin with a bare `PASS` or `FAIL` line. Implementation remains blocked until both A lenses pass on the patched plan/synthesis.
