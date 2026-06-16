PASS

[resolved — accepted] ARCH-A1 `24_p1_5_5_profiling_infra_execution_plan.md:46-48` — Prior gap around `PERF_CORPUS_SCHEMA` + `PerfCorpusReport.schema: "gjc.perf-corpus/1"` is explicitly closed: plan requires every schema literal occurrence (`PERF_CORPUS_SCHEMA`, `PerfCorpusReport.schema`, runner output, tests, docs) to use `jwc.perf-corpus/1`; synthesis round 1 accepts ARCH-A1.

[resolved — accepted] ARCH-A2 `24_p1_5_5_profiling_infra_execution_plan.md:99-108,127` — Patched plan and test #10 bind `rootParent`, `jwc-session-memory-*`, warm entry count, finite RSS, and parent-directory cleanup. Synthesis accepts this as explicit JWC delta, not a straight upstream copy.

[resolved — accepted] ARCH-A3 `24_p1_5_5_profiling_infra_execution_plan.md:191-198` — Parent `23_p1_5_upstream_v3_merge_plan.md` checklist now covers missing-files list, P1.5.5 file list, verification row, and all `.ts` renames. Constraint: apply checklist in the same PR as new bench files.

[resolved — accepted] ARCH-A4 `24_p1_5_5_profiling_infra_execution_plan.md:141-142,155-159` — Plan now requires scrubbing product-facing `gjc.perf-corpus/1` / GJC wording, removing/avoiding missing `hotspot-map-successor.md`, and acceptance §5 names six FFI gates + scope boundary + existing-doc-only links.

[resolved — waived bounded] ARCH-A5 `24_p1_5_5_profiling_infra_execution_plan.md:72` — Duplicate `mulberry32()` remains bounded by bench-local isolation; no shared utility extraction in this slice.

[resolved — accepted non-blocking] ARCH-A6 `24_p1_5_5_profiling_infra_execution_plan.md:103-105` — `SessionManager.create`, `appendMessage`, and `getEntries()` match jawcode usage patterns; no plan change required.

[resolved — accepted non-blocking] ARCH-A7 `24_p1_5_5_profiling_infra_execution_plan.md:224-228` — Package `check` is non-blocking; focused `perf-corpus.test.ts` + bench smoke commands are the C-stage contract.

[resolved — accepted] ARCH-A8 `24_p1_5_5_profiling_infra_execution_plan.md:213` — Biome command now includes `02_patch_roadmap.md` and `04_verification_matrix.md`, so devlog prose alignment is covered by the focused formatting/lint gate.

The single point most likely to break first if implemented as written: an incomplete JWC rebrand when copying upstream `perf-corpus-schema.ts` (leaving `PerfCorpusReport.schema` or runner output on `gjc.perf-corpus/1` while tests assert `jwc.perf-corpus/1`).
