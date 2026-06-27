# 105 Phase 10 plan — OMP conditional split-audit summary

## Scope

Phase 10 splits OMP reference-only cards `20.010` through `20.014` into adapt/reject/defer sub-slices before any code. This phase is docs-only and does not implement OMP behavior.

## Artifacts

| File | Purpose |
|---|---|
| `100_phase10_omp_ai_oauth_split.md` | Split `20.010` AI OAuth/reasoning replay. |
| `101_phase10_omp_tui_image_split.md` | Split `20.011` TUI image/drafts/terminal edges. |
| `102_phase10_omp_bash_env_split.md` | Split `20.012` bash snapshot/env security. |
| `103_phase10_omp_plugin_registry_split.md` | Split `20.013` plugin virtual registry bundle. |
| `104_phase10_omp_goal_provider_split.md` | Split `20.014` goal compaction/provider concurrency. |
| `105_phase10_omp_conditionals_plan.md` | This summary. |
| `106_phase10_omp_conditionals_audit.md` | Audit record. |
| `107_phase10_omp_conditionals_build.md` | Build record. |
| `108_phase10_omp_conditionals_check.md` | Verification record. |

## Risk gates

| Card | Gate |
|---|---|
| `20.010` | Security review for OAuth/refresh/quota; coordinate with GJC `10.036`. |
| `20.011` | Frontend/TUI review for image/terminal behavior; coordinate with GJC `10.041`. |
| `20.012` | C4 security review for env/snapshot/token-bearing git operations; coordinate with GJC `10.047`. |
| `20.013` | Plugin/security review for registry/install/runtime MCP behavior; coordinate with GJC `10.044`. |
| `20.014` | Architecture/concurrency review for goal/compaction/provider limiters; coordinate with GJC `10.040`. |

## Explicit non-changes

- Do not patch OMP source under `devlog/_omp_chase`.
- Do not modify JWC source, tests, docs, scripts, or generated files in this split phase.
- Do not close any of the five OMP reference cards.
- Do not convert reference-only wording into implementation instructions.
- Do not stage unrelated `devlog/.gitignore` or `devlog/_tmp/`.

## Verification plan

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/100_phase10_omp_ai_oauth_split.md devlog/_plan/260628_jwc_native_chase_implementation/101_phase10_omp_tui_image_split.md devlog/_plan/260628_jwc_native_chase_implementation/102_phase10_omp_bash_env_split.md devlog/_plan/260628_jwc_native_chase_implementation/103_phase10_omp_plugin_registry_split.md devlog/_plan/260628_jwc_native_chase_implementation/104_phase10_omp_goal_provider_split.md devlog/_plan/260628_jwc_native_chase_implementation/105_phase10_omp_conditionals_plan.md struct_har/chase/20.010_omp_chase_ai_oauth_reasoning_replay.md struct_har/chase/20.011_omp_chase_tui_image_drafts_terminal_edges.md struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md struct_har/chase/20.013_omp_chase_plugin_virtual_registry_bundle.md struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md
```

Focused owner smoke tests are optional for this docs-only phase. If run, use existing auth, TUI/image, bash/env, plugin, goal, compaction, and provider tests only as surface evidence.
