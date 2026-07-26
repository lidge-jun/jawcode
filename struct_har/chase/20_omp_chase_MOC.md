# 20 — omp_chase_MOC (omp 따라잡기)

> 상태: 🟡 운영 중 (2026-07-17 · worktree `0e8d9f4`)
> **정본 디렉터리**: `struct_har/chase/20_*` · `20.NNN_*`
> **의미**: `devlog/_omp_chase/oh-my-pi` 대비 jwc **약함(G2)** — 참조·설계 (`20.NNN`). **1:1 이식 ❌**

## 번호

| **20** | 본 MOC |
| **20.NNN** | `20.001_…` 파일명 |

규약: [005_devlog_numbering.md](./005_devlog_numbering.md)

## 링크

| | |
|---|---|
| G2 | [002_gap_inventory.md](./002_gap_inventory.md) |
| 참조 | [004_reference_from_omp.md](./004_reference_from_omp.md) |
| omp | [../omp_origin/](../omp_origin/) |
| 따라갈 순 | [007_follow_index.md](./007_follow_index.md) |

## Reviewed through

| omp | jwc |
|---|---|
| `59619623` (`origin/main`, v17.1.3) | `a446321` (dev, 2026-07-25 chase refresh) |

> GJC head is intentionally not repeated here; see [10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md).

## Recent reference-only deltas

| 영역 | OMP source facts | jwc 처리 |
|---|---|---|
| multi-advisor runtime | concurrent advisors with TUI mgmt (`fbad280b5`); advisors use mutating tools (`0501addbd`); advisor model role with independent resolution (`8bc99a616`); project-context injection (`a6ac86fe7`) | 016 참조; jwc에 advisor 개념 없음 — 미래 설계 입력 |
| pi dialect removal + thinking normalization | REMOVED pi dialect entirely (`053da98dd`); universal thinking tag healing (`3e06557c2`); cross-provider thinking demotion to canonical dialect (`b08d95111`); Gemini reasoning runaway detection (`71e044cfe`) | 016 참조; jwc에 pi dialect 없었으므로 무조치; thinking normalization은 ai provider 표면 대비 평가 필요 |
| task-agent discovery | `.omp/agents` roots and Claude plugin roots; first-wins exact-name dedup; execution-time rediscovery; `read-summarize: false`; plan-mode tool narrowing (`devlog/_omp_chase/oh-my-pi/docs/task-agent-discovery.md:38,59,68-77,114,126-130,180-186`) | 030/099 참조; jwc role-agent 4종 표면 유지 |
| task tool lifecycle | batch default-on, required shared `context`, no per-call `schema`, async jobs, `agent://`/`history://`, yield-required finish, idle/parked revival, semaphore/recursion gates, IRC follow-up (`docs/tools/task.md:29-46,52-58,69-71,76-97,132-140,157-163`) | subagent UX/contract gap으로만 분해 |
| session ops | export `subSessions`, custom share failure no-fallback, encrypted share, fork parentSession metadata, cross-project resume re-root/fork, rollback switch caveats (`docs/session-operations-export-share-fork-resume.md:21-28,45,115-130,181-190,236-249,257-277,313-327`) | operator semantics 후보 |
| memory | disabled-by-default local pipeline, Memory Guidance injection, `memory://`, extraction/consolidation, redaction, model-role fallback (`docs/memory.md:3-5,16-24,28-30,44-56,76-89,95-98`) | 99.01 후보 |
| compaction pruning | superseded read pruning, useless-result elision, protected tools, 40k protect/20k min savings, suffix/idle prompt-cache-aware flush (`packages/agent/src/compaction/pruning.ts:19-39,48-70,108-138,146-165,171-215,243-274,284-331`) | 083/session 후보 |
| steering delivery | yield-boundary `lateSteering` re-poll; settle-time stranded queue drain; steer image-normalization idle mirror (`packages/agent/src/agent-loop.ts:1066-1081`, `agent-session.ts:1432-1447,6373-6410,6599-6611`, `42ffc83`) | **[20.005](./_fin/20/20.005_omp_chase_steering_delivery.md)** — jwc 부분 보유, gjc 미수용 |
| TUI 입력 micro | Esc draft clear + selector `resetDisplay` (`e914bf0`); double-esc history **revert** (`d055f64`); ast-edit status 공백 축약 (`3d646d8`) | **[20.006](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md)** ✅ **_fin** _fin — Esc draft-clear+ast collapse 채택(jwc `a291199`), resetDisplay defer(`ui.resetDisplay()` 부재); collab/brew 비채택 |
| OMP 15.12→15.13 | session split, auto-learn, STT/TTS, compaction UI | [20.008](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) |
| OMP v16.2.5→16.2.9 (175 commits, `ca9f2847e..b6c9747d4`) | 8 reference 클러스터: AI providers/catalog/service-tier, MCP oauth/reauth, compaction/snapcompact/session-scope, TUI loader/MCP-enable, prompts/subagent/discovery, web-search/provider, stats sync/perf, misc(dictation·binary·CJK font·yield·irc·windows) | 20.023 archived reference through [20.030](./20.030_omp_chase_misc_dictation_binary_font_yield_irc_win.md) reference-only (1:1 port ❌) — 미래 설계 입력 |
| OMP v16.2.9→16.3.1 (433 commits, `b6c9747d4..0ea6ea630`) | native/search through tool schema/task/TTS/stats | [20.031](./20.031_omp_chase_native_search_pipeline.md)–20.034 active reference; 20.035 archived reference |
| OMP v16.3.1→16.3.4 (216 commits, `0ea6ea630..d0c1890a6`) | 5 reference clusters: AI catalog/auth/usage, session/async/plan integrity, hashline/tool/plugin/task safety, TUI/terminal/render resilience, robomp/ISO/sandbox/release references | [20.036](./20.036_omp_chase_ai_catalog_auth_usage.md)–[20.040](./20.040_omp_chase_robomp_iso_sandbox_release.md) active reference |
| OMP v16.3.4→16.3.12 (541 commits, `d0c1890a6..f25ab54c5`) | 4 reference clusters: Codex usage self-heal/auth rotation, LiteLLM catalog/vision metadata, skill autocomplete/discovery/GitHub refs, plan execution/agent hooks/subagent/TTSR | [20.041](./_fin/20/20.041_omp_chase_codex_usage_self_heal_auth_rotation.md)–[20.044](./_fin/20/20.044_omp_chase_plan_execution_agent_subagent_hooks.md) active reference |
| OMP v16.3.12→16.4.2 (140 non-merge commits, `f25ab54c5..7aa1d581c`) | 6 reference clusters: model catalog GPT-5.6/Grok-4.5/effort tiers, codex broker blocks/responses-lite/version headers, xAI OAuth device flow/replay/reasoning, agent yield/abort/ask-timeout integrity, OAuth refresh serialization/MCP discovery, TUI grid-render/tools/natives/config | 20.045 archived reference through [20.050](./20.050_omp_chase_tui_grid_render_tools_natives_config.md) active reference |

## 활성 (`20.NNN`)

| NNN | 문서 | 스코프 | jaw | 상태 |
|---|---|---|---|---|
| 001 | [20.001_omp_chase_cycle.md](./20.001_omp_chase_cycle.md) | fetch·regen | struct_har | 🟡 |
| 002 | [20.002_omp_chase_worker_catalog.md](./_fin/20/20.002_omp_chase_worker_catalog.md) | worker | 100 | ✅ **_fin** _fin |
| 003 | [20.003_omp_chase_memory_skills.md](./_fin/20/20.003_omp_chase_memory_skills.md) | memory·skills | 99.01 | ✅ **_fin** _fin |
| 004 | [20.004_omp_chase_lsp_dap.md](./20.004_omp_chase_lsp_dap.md) | LSP/DAP | 081 | ⬜ |
| 005 | [20.005_omp_chase_steering_delivery.md](./_fin/20/20.005_omp_chase_steering_delivery.md) | steer/followUp 전달 | session | ✅ **_fin** _fin |
| 006 | [20.006_omp_chase_tui_input_micro_fixes.md](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md) | Esc·ast status | 082·99.20 | ✅ **_fin** _fin |
| 007 | [20.007_omp_chase_session_modularization.md](./_fin/20/20.007_omp_chase_session_modularization.md) | session modules | 083 | ✅ **_fin** _fin |
| 008 | [20.008_omp_chase_pull_15_13_delta.md](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) | 15.13 index | 횡단 | ✅ **_fin** _fin |
| 009 | [20.009_omp_chase_append_only_context_integrity.md](./_fin/20/20.009_omp_chase_append_only_context_integrity.md) | append-only context integrity | reference | [20.009](./_fin/20/20.009_omp_chase_append_only_context_integrity.md) 260701 (IMPORT: stable-prefix + digest meta + malformed-call sanitizer) |
| 010 | [20.010_omp_chase_ai_oauth_reasoning_replay.md](./_fin/20/20.010_omp_chase_ai_oauth_reasoning_replay.md) | AI OAuth/reasoning replay | reference | ✅ **_fin** _fin |
| 011 | [20.011_omp_chase_tui_image_drafts_terminal_edges.md](./_fin/20/20.011_omp_chase_tui_image_drafts_terminal_edges.md) | TUI image drafts/terminal edges | reference | _fin |
| 012 | [20.012_omp_chase_bash_snapshot_env_security.md](./_fin/20/20.012_omp_chase_bash_snapshot_env_security.md) | bash snapshot/env security | reference | _fin |
| 013 | [20.013_omp_chase_plugin_virtual_registry_bundle.md](./_fin/20/20.013_omp_chase_plugin_virtual_registry_bundle.md) | plugin virtual registry/bundle | reference | _fin |
| 014 | [20.014_omp_chase_goal_compaction_provider_concurrency.md](./_fin/20/20.014_omp_chase_goal_compaction_provider_concurrency.md) | goal compaction/provider concurrency | reference | ✅ **_fin** _fin |
| 015 | [20.015_omp_chase_release_test_leak_hardening.md](./_fin/20/20.015_omp_chase_release_test_leak_hardening.md) | release/test leak hardening | reference | _fin |
| 016 | [20.016_omp_chase_advisor_thinking_dialect_session_title.md](./_fin/20/20.016_omp_chase_advisor_thinking_dialect_session_title.md) | split index → 017-022 | reference | ✅ **_fin** split |
| 017 | [20.017_omp_chase_multi_advisor_runtime.md](./20.017_omp_chase_multi_advisor_runtime.md) | multi-advisor concurrent runtime (split←016) | reference | ⬜ |
| 018 | [20.018_omp_chase_thinking_normalization.md](./20.018_omp_chase_thinking_normalization.md) | thinking/reasoning normalization (split←016) | reference | ⬜ |
| 019 | [20.019_omp_chase_codex_ai_config.md](./_fin/20/20.019_omp_chase_codex_ai_config.md) | codex/AI config: base URL·reasoning·verbosity (split←016) | reference | ✅ **_fin** [20.019](./_fin/20/20.019_omp_chase_codex_ai_config.md) 260701 (ADAPT: base-url fix + textVerbosity) |
| 020 | [20.020_omp_chase_session_title_idle_recap.md](./_fin/20/20.020_omp_chase_session_title_idle_recap.md) | session title + LLM idle recap (split←016) | reference | ✅ **_fin** 260701 (ADAPT: title casing) |
| 021 | [20.021_omp_chase_v2_streaming_integrity.md](./_fin/20/20.021_omp_chase_v2_streaming_integrity.md) | v2 streaming integrity + replay (split←016) | reference | ✅ **_fin** [20.021](./_fin/20/20.021_omp_chase_v2_streaming_integrity.md) 260701 (IMPORT: partialJson terminal scrub) |
| 022 | [20.022_omp_chase_ssh_tooling_ux.md](./20.022_omp_chase_ssh_tooling_ux.md) | ssh:// + tooling/UX expansions (split←016) | reference | ⬜ |
| 023 | [20.023_omp_chase_ai_providers_catalog_service_tier.md](./_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) | AI providers/catalog/service-tier (v16.2.9←175 delta) | reference | ✅ **_fin** [20.023](./_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) 260701 (reference-triage, no code) |
| 024 | [20.024_omp_chase_mcp_oauth_reauth_flow.md](./_fin/20/20.024_omp_chase_mcp_oauth_reauth_flow.md) | MCP oauth/reauth flow + cmd-shim launch | reference | ✅ **_fin** |
| 025 | [20.025_omp_chase_compaction_snapcompact_session_scope.md](./_fin/20/20.025_omp_chase_compaction_snapcompact_session_scope.md) | compaction/snapcompact caps + session-branch scope | reference | ✅ **_fin** [20.025](./_fin/20/20.025_omp_chase_compaction_snapcompact_session_scope.md) 260701 (IMPORT: bounded edit snapshots) |
| 026 | [20.026_omp_chase_tui_input_loader_mcp_enable.md](./20.026_omp_chase_tui_input_loader_mcp_enable.md) | TUI loader re-arm/double-Esc + MCP enable | reference | ⬜ |
| 027 | [20.027_omp_chase_prompts_subagent_discovery_rules.md](./_fin/20/20.027_omp_chase_prompts_subagent_discovery_rules.md) | prompts/subagent(tester·sonic)/discovery (identity-sensitive) | reference | ✅ **_fin** _fin (1 ADOPT #5, 5 defer) |
| 028 | [20.028_omp_chase_web_search_provider_settings.md](./_fin/20/20.028_omp_chase_web_search_provider_settings.md) | web-search DuckDuckGo + provider settings | reference | ✅ **_fin** [20.028](./_fin/20/20.028_omp_chase_web_search_provider_settings.md) 260701 (IMPORT: DDG browser-aligned request + CLI provider settings; gemini api-key defer③) |
| 029 | [20.029_omp_chase_stats_sync_worker_perf.md](./20.029_omp_chase_stats_sync_worker_perf.md) | stats sync worker + perf index | reference | ⬜ |
| 030 | [20.030_omp_chase_misc_dictation_binary_font_yield_irc_win.md](./20.030_omp_chase_misc_dictation_binary_font_yield_irc_win.md) | misc dictation/binary/font/yield/irc/windows | reference | ⬜ |
| 031 | [20.031_omp_chase_native_search_pipeline.md](./20.031_omp_chase_native_search_pipeline.md) | native traversal/search pipeline | reference | ⬜ |
| 032 | [20.032_omp_chase_ai_thinking_catalog_speech.md](./20.032_omp_chase_ai_thinking_catalog_speech.md) | AI thinking/catalog + speech | reference | ⬜ |
| 033 | [20.033_omp_chase_session_patch_rewind_integrity.md](./_fin/20/20.033_omp_chase_session_patch_rewind_integrity.md) | session/patch/rewind integrity | reference | ✅ **_fin** |
| 034 | [20.034_omp_chase_tui_collab_browser_resilience.md](./20.034_omp_chase_tui_collab_browser_resilience.md) | TUI/collab/browser resilience | reference | ⬜ |
| 035 | [20.035_omp_chase_tool_schema_task_tts_stats.md](./_fin/20/20.035_omp_chase_tool_schema_task_tts_stats.md) | tool schema/task/TTS/stats | reference | ✅ **_fin** _fin 260702 (public schema reject; task/stats/voice split) |
| 036 | [20.036_omp_chase_ai_catalog_auth_usage.md](./20.036_omp_chase_ai_catalog_auth_usage.md) | AI catalog/auth/usage | reference | ⬜ |
| 037 | [20.037_omp_chase_session_async_plan_integrity.md](./_fin/20/20.037_omp_chase_session_async_plan_integrity.md) | session/async/plan integrity | reference | ✅ **_fin** |
| 038 | [20.038_omp_chase_hashline_tool_plugin_task_safety.md](./_fin/20/20.038_omp_chase_hashline_tool_plugin_task_safety.md) | hashline/tool/plugin/task safety | reference | ✅ **_fin** |
| 039 | [20.039_omp_chase_tui_terminal_render_resilience.md](./20.039_omp_chase_tui_terminal_render_resilience.md) | TUI/terminal/render resilience | reference | ⬜ |
| 040 | [20.040_omp_chase_robomp_iso_sandbox_release.md](./20.040_omp_chase_robomp_iso_sandbox_release.md) | robomp/ISO/sandbox/release references | reference | ⬜ |
| 041 | [20.041_omp_chase_codex_usage_self_heal_auth_rotation.md](./_fin/20/20.041_omp_chase_codex_usage_self_heal_auth_rotation.md) | Codex usage self-heal/auth rotation/credential sharing | reference | ✅ **_fin** _fin 260709 (reference-triage) |
| 042 | [20.042_omp_chase_litellm_catalog_vision_metadata.md](./_fin/20/20.042_omp_chase_litellm_catalog_vision_metadata.md) | LiteLLM catalog/vision metadata/cache | reference | ✅ **_fin** _fin 260709 (reference-triage) |
| 043 | [20.043_omp_chase_skill_autocomplete_discovery_github.md](./_fin/20/20.043_omp_chase_skill_autocomplete_discovery_github.md) | skill autocomplete/discovery/GitHub refs | reference | ✅ **_fin** _fin 260709 (reference-triage) |
| 044 | [20.044_omp_chase_plan_execution_agent_subagent_hooks.md](./_fin/20/20.044_omp_chase_plan_execution_agent_subagent_hooks.md) | plan execution/agent hooks/subagent/TTSR | reference | ✅ **_fin** _fin 260709 (reference-triage) |
| 045 | [20.045_omp_chase_model_catalog_gpt56_grok_effort.md](./_fin/20/20.045_omp_chase_model_catalog_gpt56_grok_effort.md) | model catalog: GPT-5.6/Grok-4.5, tier routing, effort tiers | reference | ✅ **_fin** |
| 046 | [20.046_omp_chase_codex_broker_blocks_responses_lite.md](./_fin/20/20.046_omp_chase_codex_broker_blocks_responses_lite.md) | codex broker block guards + responses-lite + cache affinity | reference | ✅ **_fin** |
| 047 | [20.047_omp_chase_xai_oauth_replay_reasoning.md](./_fin/20/20.047_omp_chase_xai_oauth_replay_reasoning.md) | xAI OAuth device flow + replay shapes + reasoning | reference | ✅ **_fin** |
| 048 | [20.048_omp_chase_agent_yield_abort_ask_timeout.md](./_fin/20/20.048_omp_chase_agent_yield_abort_ask_timeout.md) | agent yield/abort/ask-timeout + idle-watchdog integrity | reference | ✅ **_fin** |
| 049 | [20.049_omp_chase_oauth_refresh_serialization_mcp.md](./_fin/20/20.049_omp_chase_oauth_refresh_serialization_mcp.md) | OAuth refresh serialization + MCP discovery/stdio | reference | ✅ **_fin** |
| 050 | [20.050_omp_chase_tui_grid_render_tools_natives_config.md](./20.050_omp_chase_tui_grid_render_tools_natives_config.md) | TUI grid render + tools/natives/config misc — **hub → 050a-e** (render/streaming/ACP · grep/read selectors · natives/bash/clipboard · config/extension/session/realm · providers/usage/orchestration) | reference | ⬜ split 260711 |
| 20.051 | [`omp_chase_model_hub_selector`](./_fin/20/20.051_omp_chase_model_hub_selector.md) | ✅ **_fin** (evidence pending wp4) | P1 | model hub, floating selection, role management, search ranking | `7aa1d581c..b0d04e517` |
| 20.052 | [`omp_chase_catalog_pricing_routing`](./_fin/20/20.052_omp_chase_catalog_pricing_routing.md) | ✅ **_fin** (evidence pending wp4) | P1 | Kimi 65K, MAI routes, GLM-5.2, OpenRouter catalog | `7aa1d581c..b0d04e517` |
| 20.053 | [`omp_chase_auth_oauth_credential`](./_fin/20/20.053_omp_chase_auth_oauth_credential.md) | ✅ **_fin** (evidence pending wp4) | P1 | credential rotation, serialized refresh, org-scoped identity | `7aa1d581c..b0d04e517` |
| 20.054 | [`omp_chase_provider_transport_schema`](./_fin/20/20.054_omp_chase_provider_transport_schema.md) | ✅ **_fin** (evidence pending wp4) | P1 | Vertex effort gating, schema coercion, endpoint and stream guards | `7aa1d581c..b0d04e517` |
| 20.055 | [`omp_chase_model_resolver_fallback`](./_fin/20/20.055_omp_chase_model_resolver_fallback.md) | ✅ **_fin** (evidence pending wp4) | P1 | hard-error fallback, retry exhaustion, thinking and vision fallback | `7aa1d581c..b0d04e517` |
| 20.056 | [`omp_chase_vibe_mode`](./_fin/20/20.056_omp_chase_vibe_mode.md) | ✅ **_fin** (evidence pending wp4) | P2 | persistent workers, background agents, session lifecycle | `7aa1d581c..b0d04e517` |
| 20.057 | [`omp_chase_ask_dialog`](./_fin/20/20.057_omp_chase_ask_dialog.md) | ✅ **_fin** (evidence pending wp4) | P2 | rich ask dialog, multi-select gating, notes and redirects | `7aa1d581c..b0d04e517` |
| 20.058 | `omp_chase_tui_render_streaming` | ⬜ | P2 | streamed tables and diffs, viewport stability, cmux routing | `7aa1d581c..b0d04e517` |
| 20.059 | `omp_chase_advisor_steering` | ⬜ | P2 | late blocker steering, unsafe-note quarantine, terminal notes | `7aa1d581c..b0d04e517` |
| 20.060 | `omp_chase_agent_loop_tool_stream` | ⬜ | P2 | toolUse retry, partial-call cleanup, provider error surfacing | `7aa1d581c..b0d04e517` |
| 20.061 | `omp_chase_search_grep_tools` | ⬜ | P2 | xAI web search, advanced grep, ranged budgets, xd consolidation | `7aa1d581c..b0d04e517` |
| 20.062 | `omp_chase_plugin_mcp_discovery` | ⬜ | P2 | plugin guards, MCP roots and stdio, skill reload and cache | `7aa1d581c..b0d04e517` |
| 20.063 | `omp_chase_session_settings_startup` | ⬜ | P3 | settings collisions, startup bounds, plan reentry, print status | `7aa1d581c..b0d04e517` |
| 20.064 | `omp_chase_mnemopi_memory_eval` | ⬜ | P3 | memory trim safety, runtime recovery, isolated evals | `7aa1d581c..b0d04e517` |
| 20.065 | `omp_chase_browser_bash_commit` | ⬜ | P3 | browser watchdogs, shell abort, commit teardown, URL resolution | `7aa1d581c..b0d04e517` |
| 20.066 | `omp_chase_collab_web_extension` | ⬜ | P3 | markdown rendering, transcript dedup, steer queueing | `7aa1d581c..b0d04e517` |
| 20.067 | [`omp_chase_usage_quota_spend_limit`](./_fin/20/20.067_omp_chase_usage_quota_spend_limit.md) | ✅ **_fin** (evidence pending wp4) | P1 | spend-limit taxonomy, usage reconciliation, snapshot validation | `7aa1d581c..b0d04e517` |
| 20.068 | `omp_chase_tui_sixel_subagent_misc` | ⬜ | P3 | SIXEL sizing, subagent sanitization, CJK and editor edges | `7aa1d581c..b0d04e517` |
| 20.069 | `omp_chase_centralized_prompt_small_model` | ⬜ | P2 | small-model preprocessing, task-agent resolution, thinking precedence | `7aa1d581c..b0d04e517` |
| 20.070 | `omp_chase_ci_release_changelog` | ⬜ | P3 | release bumps, changelog dedup, stale tests, CI stabilization | `7aa1d581c..b0d04e517` |
| 20.071 | [`omp_chase_warp_event_bridge`](./_fin/20/20.071_omp_chase_warp_event_bridge.md) | ✅ **_fin** (evidence pending wp4) | P2 | Warp TUI events, OSC emitter, permission | `b0d04e517..5394081390` |
| 20.072 | [`omp_chase_cursor_advisor_xdev`](./_fin/20/20.072_omp_chase_cursor_advisor_xdev.md) | ✅ **_fin** (evidence pending wp4) | P2 | cursor exec bridge, advisor tools, xdev | `b0d04e517..5394081390` |
| 20.073 | `omp_chase_tui_rendering_status` | ⬜ | P2 | TUI rendering, status bar, images, skills | `b0d04e517..5394081390` |
| 20.074 | [`omp_chase_ai_credential_redaction`](./_fin/20/20.074_omp_chase_ai_credential_redaction.md) | ✅ **_fin** (evidence pending wp4) | P1 | credential redaction, blocked retry, BigInt | `b0d04e517..5394081390` |
| 20.075 | [`omp_chase_coding_agent_tool_restoration`](./_fin/20/20.075_omp_chase_coding_agent_tool_restoration.md) | ✅ **_fin** | P2 | transactional MCP refresh rollback; OMP-only owners rejected/split | `b0d04e517..5394081390` |
| 20.076 | [`omp_chase_session_plan_lifecycle`](./_fin/20/20.076_omp_chase_session_plan_lifecycle.md) | ✅ **_fin** (evidence pending wp4) | P2 | session dispose, plan exits, role model | `b0d04e517..5394081390` |
| 20.077 | [`omp_chase_plugins_commonjs_mcp`](./_fin/20/20.077_omp_chase_plugins_commonjs_mcp.md) | ✅ **_fin** (evidence pending wp4) | P2 | CommonJS/ESM, plugin reload, MCP ownership | `b0d04e517..5394081390` |
| 20.078 | `omp_chase_bash_irc_registry` | ⬜ | P3 | bash timeout, PTY shells, IRC lifecycle | `b0d04e517..5394081390` |
| 20.079 | [`omp_chase_codex_lite_telemetry`](./_fin/20/20.079_omp_chase_codex_lite_telemetry.md) | ✅ **_fin** (evidence pending wp4) | P2 | Codex Lite, telemetry OTLP, generate_image | `b0d04e517..5394081390` |
| 20.080 | `omp_chase_ci_style_changelog` | ⬜ | P3 | CI, style, changelog, test fixes | `b0d04e517..5394081390` |
| 20.081 | [omp_chase_ai_catalog_stream_auth](./_fin/20/20.081_omp_chase_ai_catalog_stream_auth.md) | ✅ **_fin** — ADAPT partial; residual: planning/identity/metadata/pricing/recovery | P1 | AI catalog/stream/auth | `b0d04e517..v17.0.8` |
| 20.082 | [`omp_chase_session_context_settings_persistence`](./20.082_omp_chase_session_context_settings_persistence.md) | ⬜ | P1 | session/context/settings (adapt, A) | `b0d04e517..v17.0.8` |
| 20.083 | [omp_chase_tool_fs_shell_git_safety](./_fin/20/20.083_omp_chase_tool_fs_shell_git_safety.md) | ✅ **_fin** — ADAPT partial; residual: C-bucket product/config/public surface | P1 | tool/fs/shell/git safety | `b0d04e517..v17.0.8` |
| 20.084 | [`omp_chase_task_subagent_advisor_launch`](./20.084_omp_chase_task_subagent_advisor_launch.md) | ⬜ | P1 | task/subagent/advisor/launch (split, C) | `b0d04e517..v17.0.8` |
| 20.085 | [`omp_chase_tui_render_input_markdown`](./20.085_omp_chase_tui_render_input_markdown.md) | ⬜ | P2 | TUI/render/input/Markdown (track-only, B) | `b0d04e517..v17.0.8` |
| 20.086 | [`omp_chase_extensions_mcp_lsp_dap_browser`](./20.086_omp_chase_extensions_mcp_lsp_dap_browser.md) | ⬜ | P2 | extensions/MCP/LSP/DAP/browser (split, C) | `b0d04e517..v17.0.8` |
| 20.087 | [`omp_chase_native_diff_search_memory_perf`](./20.087_omp_chase_native_diff_search_memory_perf.md) | ⬜ | P2 | native diff/search/memory perf (adapt, A) | `b0d04e517..v17.0.8` |
| 20.088 | [`omp_chase_release_build_platform_ci`](./20.088_omp_chase_release_build_platform_ci.md) | ⬜ | P2 | release/build/platform/CI (adapt, A) | `b0d04e517..v17.0.8` |
| 20.089 | [`omp_chase_runtime_stats_logging_collab`](./20.089_omp_chase_runtime_stats_logging_collab.md) | ⬜ | P2 | runtime/stats/logging/collab (adapt, A) | `b0d04e517..v17.0.8` |
| 20.090 | [`omp_chase_robomp_swarm_reference`](./20.090_omp_chase_robomp_swarm_reference.md) | ⬜ | P3 | robomp/swarm reference (track-only, B) | `b0d04e517..v17.0.8` |
| 20.101 | [`omp_chase_secret_placeholder_redaction`](./20.101_omp_chase_secret_placeholder_redaction.md) | ⬜ | P1 | secret placeholder identity/redaction (adapt, C) | `v17.0.8..v17.1.0` |
| 20.102 | [`omp_chase_error_notifications_terminal_title`](./20.102_omp_chase_error_notifications_terminal_title.md) | ⬜ | P2 | error notifications + terminal title (adapt, A) | `v17.0.8..v17.1.0` |
| 20.103 | [`omp_chase_workspace_roots_session_lifecycle`](./20.103_omp_chase_workspace_roots_session_lifecycle.md) | ⬜ | P1 | workspace roots + session lifecycle (adapt, C) | `v17.0.8..v17.1.0` |
| 20.104 | [`omp_chase_task_todo_subagent_quiescence`](./20.104_omp_chase_task_todo_subagent_quiescence.md) | ⬜ | P1 | task/todo/subagent quiescence (split, C) | `v17.0.8..v17.1.0` |
| 20.105 | [`omp_chase_providers_oauth_usage_fallback`](./20.105_omp_chase_providers_oauth_usage_fallback.md) | ⬜ | P1 | providers/OAuth/usage/fallback (split, C) | `v17.0.8..v17.1.0` |
| 20.106 | [`omp_chase_prompt_cache_policy_benchmark`](./20.106_omp_chase_prompt_cache_policy_benchmark.md) | ⬜ | P2 | prompt-cache policy + benchmarks (adapt, C) | `v17.0.8..v17.1.0` |
| 20.107 | [omp_chase_compaction_retry_history_resilience](./_fin/20/20.107_omp_chase_compaction_retry_history_resilience.md) | ✅ **_fin** — ADAPT partial; residual: extension-handler FIFO liveness | P1 | compaction/history resilience | `v17.0.8..v17.1.0` |
| 20.108 | [`omp_chase_mcp_rpc_acp_protocol_hardening`](./20.108_omp_chase_mcp_rpc_acp_protocol_hardening.md) | ⬜ | P2 | MCP/RPC/ACP hardening (adapt, C) | `v17.0.8..v17.1.0` |
| 20.109 | [omp_chase_tools_platform_runtime_hardening](./_fin/20/20.109_omp_chase_tools_platform_runtime_hardening.md) | ✅ **_fin** — ADAPT partial; residual: approval/memory/mupdf/PDF/no-surface | P2 | tool/platform runtime hardening | `v17.0.8..v17.1.0` |
| 20.110 | [`omp_chase_advisor_hindsight_vibe_runtime`](./20.110_omp_chase_advisor_hindsight_vibe_runtime.md) | ⬜ | P3 | advisor/Hindsight/vibe runtime (track-only, B) | `v17.0.8..v17.1.0` |
| 20.111 | [`omp_chase_tui_export_extensions_status`](./20.111_omp_chase_tui_export_extensions_status.md) | ⬜ | P2 | TUI/exports/extensions (adapt, C) | `v17.0.8..v17.1.0` |
| 20.112 | [`omp_chase_misc_runtime_quality`](./20.112_omp_chase_misc_runtime_quality.md) | ⬜ | P3 | remaining runtime quality deltas (evidence-fill, B) | `v17.0.8..v17.1.0` |
| 20.121 | [`omp_chase_native_computer_use`](./20.121_omp_chase_native_computer_use.md) | ⬜ | P1 | native computer use (split, C) | `v17.1.0..59619623` |
| 20.122 | [omp_chase_tui_tool_lifecycle](./_fin/20/20.122_omp_chase_tui_tool_lifecycle.md) | ✅ **_fin** — ADAPT partial; residual: protected scroll/viewport anchors | P2 | TUI/tool lifecycle | `v17.1.0..59619623` |
| 20.123 | [`omp_chase_native_live_audio_attestation`](./20.123_omp_chase_native_live_audio_attestation.md) | ⬜ | P2 | native live/audio/attestation (split, C) | `v17.1.0..59619623` |
| 20.124 | [omp_chase_ai_provider_stream_integrity](./_fin/20/20.124_omp_chase_ai_provider_stream_integrity.md) | ✅ **_fin** — ADAPT partial; residual: five C-bucket auth/catalog anchors | P1 | AI/provider stream integrity | `v17.1.0..59619623` |
| 20.125 | [`omp_chase_task_rebuild_search_rendering`](./20.125_omp_chase_task_rebuild_search_rendering.md) | ⬜ | P1 | task/rebuild/search/rendering (split, C) | `v17.1.0..59619623` |
| 20.126 | [`omp_chase_account_usage_launch_stats`](./20.126_omp_chase_account_usage_launch_stats.md) | ⬜ | P2 | account/usage/launch/stats (split, C) | `v17.1.0..59619623` |
| 20.127 | [`omp_chase_shell_native_ci`](./20.127_omp_chase_shell_native_ci.md) | ⬜ | P2 | shell/native CI (evidence-fill, B) | `v17.1.0..59619623` |

> **260717 delta**: +20 cards (20.051–20.070), range `7aa1d581c..b0d04e517` (v16.4.2→v17.0.1, 586 non-merge).

> **260717 delta (supplement 2)**: +10 cards (20.071–20.080), range `b0d04e517..5394081390` (v17.0.1+, 175 non-merge).
> **260725 delta**: +29 cards (20.081–20.090, 20.101–20.112, 20.121–20.127), range `b0d04e517..59619623` (v17.0.1→v17.1.3, 1301 non-merge). Superset re-cluster of the supplement-2 range (175 commits re-verified; 20.071–20.079 already archived).

## 완료

→ [_fin/20/](./_fin/20/README.md)

## gjc

[10_gjc_chase_MOC.md](./10_gjc_chase_MOC.md)

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/20_omp_chase_MOC.md`
> Title: 20 — omp_chase_MOC (omp 따라잡기)
> Lane: OMP
> Status: active chase card
> Canonical source: `devlog/_omp_chase/oh-my-pi` (main tracking origin/main)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_omp_chase/oh-my-pi; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_omp_chase/oh-my-pi` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
2. For GJC-sourced cards, compare against `devlog/_gjc_chase/gajae-code` on `dev` tracking `upstream/dev`.
3. For OMP-sourced cards, compare against `devlog/_omp_chase/oh-my-pi` on `main` tracking `origin/main`.
4. Patch only the JWC implementation surface after the delta is understood; do not edit the chase clone.
5. Keep public command names, state directories, and user-facing examples JWC-first: `jwc`, `.jwc`, and `@jawcode-dev/*`.
6. If a source path uses upstream names such as `gjc`, translate them through `008_gjc_jwc_naming_contract.md` before copying any behavior.
7. If this card points to docs/index behavior, update `structure/`, `struct_har/chase/`, and the relevant devlog plan rather than product code.
8. If this card points to runtime behavior, add or update the nearest package test before declaring the card finished.
9. If the correct patch surface is outside structure/, struct_har/chase/, devlog/_plan/, record why the owner changed in the devlog before widening scope.
10. Do not batch this card with unrelated chase cards unless a MOC explicitly says they form one PABCD bundle.

### Decision needed before patching

1. Decide whether to import the source behavior, adapt it to JWC, reject it, or split it into smaller cards.
2. Decide whether the user-visible contract changes; if yes, update docs and tests with the same patch.
3. Decide whether persistence/state migration is involved; if yes, identify the `.jwc` state files and rollback posture.
4. Decide whether subagents must learn a new rule; if yes, promote the durable rule to `AGENTS.md` or `structure/`, not only this chase file.
5. Decide whether the source behavior conflicts with the fork's TUI, workflow, or naming constraints.
6. Decide whether this card is still active; if already implemented, move or keep it under `_fin` with evidence instead of reopening vague work.
7. Decide which verification command is authoritative for the changed surface: focused test, `bun run check:tools`, `bun run check:ts`, smoke test, or manual artifact proof.
8. Decide whether a failed broad check is caused by this card; unrelated failures must be recorded, not hidden.
9. Decide whether the implementation needs a follow-up goal because the card implies more than one atomic patch.
10. Decide what evidence will convince a read-only reviewer that the chase gap is actually closed.

### Verification and done evidence

1. Re-read this file after patching and verify the stated source lane still matches devlog/_omp_chase/oh-my-pi.
2. Run a focused diff against the source lane and paste the relevant file anchors into the devlog or final report.
3. Run the package-level focused test that proves the affected behavior, not just a broad lint pass.
4. Run `bun run check:tools` for repository formatting/lint hygiene.
5. Run `git diff --check` before committing to catch whitespace and conflict-marker mistakes.
6. If `bun run check:ts` is relevant and fails, classify whether the failure is caused by the patch or a pre-existing dependency drift.
7. Update this card's status line, MOC row, or `_fin` placement only after evidence exists.
8. Add a devlog evidence note for the patch surface, tests, reviewer, and any known residual risks.
9. Ask a read-only reviewer to challenge the closure if the patch touches runtime behavior, workflow state, or subagent routing.
10. Commit only the card's intended docs/code/test files; preserve unrelated worktree changes.

### Sub-agent handoff contract

1. A sub-agent must start from the Project root `/Users/jun/Developer/new/700_projects/jawcode`, not from `~/.cli-jaw`.
2. A sub-agent must read `AGENTS.md`, `structure/00_INDEX.md`, and this file before proposing implementation.
3. A sub-agent must resolve the chase baseline from `devlog/_omp_chase/oh-my-pi` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_omp_chase/oh-my-pi.
2. Source branch checked: main tracking origin/main.
3. JWC owner files listed before edit: structure/, struct_har/chase/, devlog/_plan/.
4. Naming contract checked against `008_gjc_jwc_naming_contract.md`.
5. Current MOC row checked for priority and status.
6. Current devlog plans searched for prior implementation or rejection.
7. Related tests searched before adding new tests.
8. Runtime/state risk classified as none, local, or migration.
9. User-facing command/help change classified as yes or no.
10. Subagent instruction change classified as yes or no.
11. Implementation option chosen: import, adapt, reject, or split.
12. Rejection rationale written if source behavior is not adopted.
13. Focused verification command selected.
14. Broad hygiene command selected.
15. Reviewer/audit route selected when risk is not local.
16. Documentation update location selected: this card, MOC, `structure/`, or devlog.
17. Commit scope listed before staging.
18. Known unrelated failures separated from card failures.
19. Completion evidence attached to final report.
20. Card status changed only after evidence is present.

### Decision log slots

1. Decision A — source behavior classification: import / adapt / reject / split.
2. Decision B — JWC naming impact: none / command text / state path / package namespace.
3. Decision C — test impact: existing test update / new focused test / manual evidence only.
4. Decision D — docs impact: chase only / structure promotion / AGENTS durable rule.
5. Decision E — rollout impact: no migration / local state migration / user-visible behavior note.
6. Decision F — residual risk: closed / monitored / intentionally deferred.
7. Decision G — reviewer needed: no / docs / backend / frontend / architecture.
8. Decision H — bundle policy: single-card commit / PABCD bundle / separate goal.

### Done-state wording

When this card is closed, the final note should say: produce a focused patch or explicit rejection note.
It should cite the source commit, JWC commit, files changed, focused verification, and any rejected source behavior.
It should not say 'done' solely because the document is longer or because a broad lint command passed.
It should leave enough evidence for a future agent to re-open the comparison without reading the whole chat history.


## Lifecycle reconciliation rows — 2026-07-26

| id | card | status |
| --- | --- | --- |
| 20.050a | [20.050a_omp_chase_tui_render_streaming_acp](./20.050a_omp_chase_tui_render_streaming_acp.md) | ⬜ active |
| 20.050b | [20.050b_omp_chase_grep_read_selector_budgets](./20.050b_omp_chase_grep_read_selector_budgets.md) | ⬜ active |
| 20.050c | [20.050c_omp_chase_natives_bash_clipboard](./20.050c_omp_chase_natives_bash_clipboard.md) | ⬜ active |
| 20.050d | [20.050d_omp_chase_config_extension_session_realm](./20.050d_omp_chase_config_extension_session_realm.md) | ⬜ active |
| 20.050e | [20.050e_omp_chase_providers_usage_orchestration_misc](./20.050e_omp_chase_providers_usage_orchestration_misc.md) | ⬜ active |
| 20.058 | [20.058_omp_chase_tui_render_streaming](./20.058_omp_chase_tui_render_streaming.md) | ⬜ active |
| 20.059 | [20.059_omp_chase_advisor_steering](./20.059_omp_chase_advisor_steering.md) | ⬜ active |
| 20.060 | [20.060_omp_chase_agent_loop_tool_stream](./_fin/20/20.060_omp_chase_agent_loop_tool_stream.md) | ✅ **_fin** |
| 20.061 | [20.061_omp_chase_search_grep_tools](./20.061_omp_chase_search_grep_tools.md) | ⬜ active |
| 20.062 | [20.062_omp_chase_plugin_mcp_discovery](./_fin/20/20.062_omp_chase_plugin_mcp_discovery.md) | ✅ **_fin** |
| 20.063 | [20.063_omp_chase_session_settings_startup](./20.063_omp_chase_session_settings_startup.md) | ⬜ active |
| 20.064 | [20.064_omp_chase_mnemopi_memory_eval](./20.064_omp_chase_mnemopi_memory_eval.md) | ⬜ active |
| 20.065 | [20.065_omp_chase_browser_bash_commit](./_fin/20/20.065_omp_chase_browser_bash_commit.md) | ✅ **_fin** |
| 20.066 | [20.066_omp_chase_collab_web_extension](./_fin/20/20.066_omp_chase_collab_web_extension.md) | ✅ **_fin** |
| 20.068 | [20.068_omp_chase_tui_sixel_subagent_misc](./20.068_omp_chase_tui_sixel_subagent_misc.md) | ⬜ active |
| 20.069 | [20.069_omp_chase_centralized_prompt_small_model](./20.069_omp_chase_centralized_prompt_small_model.md) | ⬜ active |
| 20.070 | [20.070_omp_chase_ci_release_changelog](./20.070_omp_chase_ci_release_changelog.md) | ⬜ active |
| 20.073 | [20.073_omp_chase_tui_rendering_status](./20.073_omp_chase_tui_rendering_status.md) | ⬜ active |
| 20.078 | [20.078_omp_chase_bash_irc_registry](./20.078_omp_chase_bash_irc_registry.md) | ⬜ active |
| 20.080 | [20.080_omp_chase_ci_style_changelog](./20.080_omp_chase_ci_style_changelog.md) | ⬜ active |
