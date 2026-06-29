# 96 Phase 9 build — TUI, performance, research, and docs edge slices

## Build output

Docs-only build completed for Phase 9. No source code, tests, generated benchmark artifacts, product docs, CI workflows, scripts, or upstream clone files were modified.

## Files added

| File | Purpose |
|---|---|
| `90_phase9_tui_perf_research_docs_plan.md` | Parent Phase 9 plan with source anchors, JWC owners, overlap inventory, candidate slices, explicit non-changes, and verification plan. |
| `91_phase9_tui_input_render_split.md` | Split `10.041` into TUI input/render candidates. |
| `92_phase9_research_mode_split.md` | Split `10.046` into research/autoresearch candidates. |
| `93_phase9_perf_corpus_split.md` | Split `10.049` into perf/bench/corpus candidates. |
| `94_phase9_external_docs_split.md` | Split `10.052` into external integration docs candidates. |
| `95_phase9_tui_perf_research_docs_audit.md` | Audit results and fixes. |

## Files modified

| File | Change |
|---|---|
| `02_phase_map.md` | Added Phase 9 required split artifacts row for `91-94`. |
| `struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md` | Added Phase 9 owner/split evidence plus TUI boundary fixes; card remains active. |
| `struct_har/chase/10.046_gjc_chase_rlm_research_mode.md` | Added Phase 9 owner/split evidence; card remains active. |
| `struct_har/chase/10.049_gjc_chase_performance_bench_corpus.md` | Added Phase 9 track-only overlap evidence; card remains active. |
| `struct_har/chase/10.052_gjc_chase_docs_external_integrations.md` | Added Phase 9 owner/split evidence; card remains active. |

## Verification plan for C

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/02_phase_map.md devlog/_plan/260628_jwc_native_chase_implementation/90_phase9_tui_perf_research_docs_plan.md devlog/_plan/260628_jwc_native_chase_implementation/91_phase9_tui_input_render_split.md devlog/_plan/260628_jwc_native_chase_implementation/92_phase9_research_mode_split.md devlog/_plan/260628_jwc_native_chase_implementation/93_phase9_perf_corpus_split.md devlog/_plan/260628_jwc_native_chase_implementation/94_phase9_external_docs_split.md devlog/_plan/260628_jwc_native_chase_implementation/95_phase9_tui_perf_research_docs_audit.md devlog/_plan/260628_jwc_native_chase_implementation/96_phase9_tui_perf_research_docs_build.md struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md struct_har/chase/10.046_gjc_chase_rlm_research_mode.md struct_har/chase/10.049_gjc_chase_performance_bench_corpus.md struct_har/chase/10.052_gjc_chase_docs_external_integrations.md
```

Focused tests:

```sh
bun test packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/hook-selector-inline-input.test.ts packages/coding-agent/test/hook-selector-overflow.test.ts packages/coding-agent/test/tui-tree-list-collapsed-lines.test.ts packages/coding-agent/test/jobs-observer.test.ts packages/coding-agent/test/event-controller-abort-render.test.ts
```

```sh
bun test packages/coding-agent/test/autoresearch-discovery.test.ts packages/coding-agent/test/autoresearch-state.test.ts packages/coding-agent/test/autoresearch-tools.test.ts packages/coding-agent/test/perf-corpus.test.ts packages/coding-agent/test/bench/context-optimization-effectiveness.test.ts packages/coding-agent/test/notifications-docs.test.ts packages/coding-agent/test/docs-utility-surface-cleanup.test.ts
```
