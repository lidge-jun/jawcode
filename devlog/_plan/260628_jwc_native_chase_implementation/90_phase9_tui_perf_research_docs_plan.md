# 90 Phase 9 plan — TUI, performance, research, and docs edge slices

## Scope

Split and harden evidence for cards `10.041`, `10.046`, `10.049`, and `10.052`.

This phase is docs-first because these cards are edge-heavy and broad: TUI input/rendering, RLM/research routing, performance corpus, and external integration docs. JWC already has many native owners for these areas, so Phase 9 records exact owners and implementation-ready sub-slices before any code change.

## Source anchors

| Card | Source | Local head |
|---|---|---|
| `10.041` | GJC TUI input/render/Windows psmux cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.046` | GJC RLM research-mode cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.049` | GJC performance bench corpus cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.052` | GJC docs/external integrations cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |

## Existing JWC evidence

| Surface | Evidence |
|---|---|
| TUI input and selector behavior | `packages/coding-agent/src/modes/controllers/input-controller.ts`; `packages/coding-agent/src/modes/controllers/selector-controller.ts`; `packages/coding-agent/src/modes/components/composer-chrome.ts`; `packages/coding-agent/src/modes/components/composer-footer.ts`; `packages/coding-agent/src/modes/components/hook-input.ts`; `packages/coding-agent/src/modes/components/jobs-overlay.ts`; selector/input/jobs tests |
| TUI rendering and terminal primitives | `packages/coding-agent/src/tui/**`; `packages/coding-agent/src/modes/interactive-mode.ts`; `packages/coding-agent/src/modes/controllers/event-controller.ts`; `packages/coding-agent/src/modes/components/**`; `packages/coding-agent/test/tui/**`; render and component tests |
| research/autoresearch | `packages/coding-agent/src/autoresearch/**`; `packages/coding-agent/test/autoresearch-*.test.ts`; `packages/coding-agent/test/tools/web-scrapers/research.test.ts`; `packages/coding-agent/test/web/search/**` |
| performance corpus and benches | `packages/coding-agent/bench/**`; `packages/coding-agent/test/perf-corpus.test.ts`; `packages/coding-agent/test/bench/context-optimization-effectiveness.test.ts`; `docs/perf-profiling-corpus.md`; `docs/cpu-hotspot-map.json` |
| external integration docs | `docs/grok-build-provider-design.md`; `docs/hermes-mcp-bridge.md`; `docs/bridge.md`; `docs/notifications-sdk.md`; `docs/telegram-onboarding.md`; `docs/tools/**`; docs verification tests and scripts |

## Upstream diff evidence

| Family | Evidence |
|---|---|
| TUI/input/render | `f6391342`, `11e3e5f4`, `38ac6dcd`, `a8d0d5f4`, `61dbe110`, `5316e261`, `05fb0fd9`, `6624965d`, `633a4339`, `bdb99345`, `1a7b06b6`, `ca525978` |
| RLM/research | `4928f185`, `5ed80862`, `b64eb6ab`, `039692ab`, `087064ee`, `c6485758`, `aee80d60`, `a014edc6` plus current JWC `autoresearch` owners |
| performance/bench | `55d4ce43`, `4a234d4e`, `f40f0d66`, `977e8c61`, `057e7863`, `94c563d3`, `717cbada` |
| docs/external integrations | `fff4c292`, `70266665`, `56865418`, `7775c454`, `95ee49a6`, `ddf50634`, `c53828b6`, `4a972aa7`, `53acb5df`, `85e7e5c7`, `21dd19a4` |

## `_fin` overlap inventory

| Active card | `_fin` overlap | Phase 9 posture |
|---|---|---|
| `10.041` | `struct_har/chase/_fin/20/20.006_omp_chase_tui_input_micro_fixes.md` already closed OMP TUI Esc and AST whitespace micro-fixes; its `resetDisplay` defer remains out of scope without fresh regression evidence. | Keep active for GJC TUI input/render, selector, and render-loop gaps beyond closed micro-fixes; defer Windows psmux/team behavior to Phase 8 `10.050` unless the proven gap is strictly TUI rendering. |
| `10.046` | No direct closed RLM card found in this Phase 9 scan. | Keep active as split-only; research mode may map to JWC `autoresearch` rather than upstream `rlm`. |
| `10.049` | `struct_har/chase/_fin/10/10.025_gjc_chase_perf_corpus_geobench.md` closed prior perf corpus/geobench evidence. | Treat as track-only unless a concrete new benchmark/corpus gap is proven beyond `10.025`. |
| `10.052` | Phase 1-4 notification docs and Phase 8 plugin docs may overlap with parts of external integration docs, but no direct `_fin` card owns this whole docs cluster. | Split docs by integration surface; do not promote speculative external integration docs as implemented behavior. |

## New artifacts

| File | Purpose |
|---|---|
| `90_phase9_tui_perf_research_docs_plan.md` | This plan. |
| `91_phase9_tui_input_render_split.md` | Split `10.041` into TUI input/render candidates. |
| `92_phase9_research_mode_split.md` | Split `10.046` into research/autoresearch candidates. |
| `93_phase9_perf_corpus_split.md` | Split `10.049` into perf/bench/corpus candidates. |
| `94_phase9_external_docs_split.md` | Split `10.052` into external integration docs candidates. |
| `95_phase9_tui_perf_research_docs_audit.md` | Record employee audit and fixes. |
| `96_phase9_tui_perf_research_docs_build.md` | Record docs-only build output. |
| `97_phase9_tui_perf_research_docs_check.md` | Record verification and commit evidence. |

## Chase docs to update

| File | Planned change |
|---|---|
| `struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md` | Add Phase 9 owner/split evidence, keep active. |
| `struct_har/chase/10.046_gjc_chase_rlm_research_mode.md` | Add Phase 9 owner/split evidence, keep active. |
| `struct_har/chase/10.049_gjc_chase_performance_bench_corpus.md` | Add Phase 9 track-only overlap evidence, keep active. |
| `struct_har/chase/10.052_gjc_chase_docs_external_integrations.md` | Add Phase 9 owner/split evidence, keep active. |

## Candidate slices after this phase

Each future slice requires its own PABCD cycle. TUI edits require Frontend review; research/network docs require Backend/Docs review; benchmark changes require deterministic runtime evidence.

| Candidate | Owner card | Scope |
|---|---|---|
| `10.041-A` | `10.041` | Input-controller and composer key handling: Esc/newline/IME/PowerShell chord regressions beyond closed OMP micro-fixes. |
| `10.041-B` | `10.041` | Selector identity, hook-selector inline input, and active monitor/jobs panel behavior after confirming JWC gaps. |
| `10.041-C` | `10.041` | Render-loop and terminal lifecycle hardening for long sessions and resize/preedit edge cases, excluding `20.006` `resetDisplay` work unless fresh regression evidence exists. |
| `10.046-A` | `10.046` | Map upstream RLM command semantics to JWC `autoresearch` command/state owners without adding a duplicate `rlm` namespace. |
| `10.046-B` | `10.046` | Managed environment/resume/autonomous gates for research runs, if current JWC `autoresearch` lacks them. |
| `10.046-C` | `10.046` | Live model e2e posture and failure finalization docs/tests using JWC search/provider abstractions. |
| `10.049-A` | `10.049` | Track-only confirmation that `10.025` already covers perf corpus/geobench closure. |
| `10.049-B` | `10.049` | Add deterministic benchmark/corpus gates only for gaps not covered by `10.025`. |
| `10.049-C` | `10.049` | Hotspot/profile docs updates only if new JWC benchmark evidence exists. |
| `10.052-A` | `10.052` | External integration docs inventory and stale-link/brand cleanup. |
| `10.052-B` | `10.052` | Grok Build, Hermes MCP, bridge, CodeGraph, and generic controller docs alignment with implemented JWC surfaces. |
| `10.052-C` | `10.052` | Notification/Telegram/remote docs reconciliation after Phase 1-4 notification implementation slices. |

## Explicit non-changes

- Do not patch GJC source under `devlog/_gjc_chase`.
- Do not change TUI runtime, controller, or rendering behavior in this docs-first phase.
- Do not introduce an upstream `rlm` command namespace before mapping it to JWC `autoresearch`.
- Do not modify benchmark thresholds or generated performance artifacts in this docs-first phase.
- Do not claim external integration docs describe implemented behavior unless the JWC code/tests already prove it.
- Do not close any of the four cards.
- Do not stage unrelated `devlog/.gitignore` or `devlog/_tmp/`.

## Verification plan

Docs check:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/90_phase9_tui_perf_research_docs_plan.md devlog/_plan/260628_jwc_native_chase_implementation/91_phase9_tui_input_render_split.md devlog/_plan/260628_jwc_native_chase_implementation/92_phase9_research_mode_split.md devlog/_plan/260628_jwc_native_chase_implementation/93_phase9_perf_corpus_split.md devlog/_plan/260628_jwc_native_chase_implementation/94_phase9_external_docs_split.md struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md struct_har/chase/10.046_gjc_chase_rlm_research_mode.md struct_har/chase/10.049_gjc_chase_performance_bench_corpus.md struct_har/chase/10.052_gjc_chase_docs_external_integrations.md
```

Focused existing tests:

```sh
bun test packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/input-controller-keybindings.test.ts packages/coding-agent/test/hook-selector-inline-input.test.ts packages/coding-agent/test/hook-selector-overflow.test.ts packages/coding-agent/test/tui-tree-list-collapsed-lines.test.ts
```

```sh
bun test packages/coding-agent/test/autoresearch-discovery.test.ts packages/coding-agent/test/autoresearch-state.test.ts packages/coding-agent/test/autoresearch-tools.test.ts packages/coding-agent/test/perf-corpus.test.ts packages/coding-agent/test/bench/context-optimization-effectiveness.test.ts packages/coding-agent/test/notifications-docs.test.ts packages/coding-agent/test/docs-utility-surface-cleanup.test.ts
```
