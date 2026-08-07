# 009 — chase follow tiers (따라가기 난이도 분류)

> 상태: 🟡 운영 중 · 2026-07-01 ② 결정 인터뷰 기반
> **의미**: active chase 카드를 "따라가기 난이도"로 3분류. [007_follow_index](./007_follow_index.md)가 우선순위(P)라면, 009는 **결정 부담** 축.
> 규약: [005_devlog_numbering](./005_devlog_numbering.md) · 판정 근거는 각 카드 "Interview decision (2026-07-01)" 블록.

## 분류 정의

| Tier | 의미 | 처리 |
|---|---|---|
| ① | 기능 결정 없이 따라갈 수 있음 (격리 버그픽스·플랫폼·UX 말단·확정 import/adapt) | 카드별 구현 goal로 바로 진행 가능 |
| ② | 기능 결정 필요 (정체성·아키텍처·과금·상태 마이그레이션·보안) | 구현 전 인터뷰/리뷰 게이트 필수 |
| ③ | 더 하드닝 될 때까지 백로그 (게이트 미충족·JWC 개념 부재·대형 미성숙) | 선행조건 충족 시 재평가 |

## ① 기능 결정 없이 따라갈 수 있음

### ②→① 격하 (2026-07-01 인터뷰 확정, 15장)

| NNN | 스코프 | 판정 |
|---|---|---|
| [10.065](./_fin/10/10.065_gjc_chase_prompt_self_awareness_grounding.md) | prompt self-awareness | ✅ **_fin** _fin 260701 (ADAPT · content JWC-authored) |
| [20.027](./_fin/20/20.027_omp_chase_prompts_subagent_discovery_rules.md) | prompts/subagent/discovery | ✅ **_fin** _fin · ADAPT · 1 ADOPT (#5 agent-param), 5 defer |
| [10.062](./_fin/10/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md) | DeepInfra + Gemini UA | IMPORT ✅ **_fin** _fin 260701 |
| [10.054](./_fin/10/10.054_gjc_chase_local_provider_discovery.md) | local provider discovery | IMPORT ✅ **_fin** _fin 260701 |
| [20.023](./_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) | providers/catalog/service-tier | IMPORT/ADAPT ✅ **_fin** _fin 260701 (reference-triage, no code) |
| [20.019](./_fin/20/20.019_omp_chase_codex_ai_config.md) | codex/AI config | ADAPT ✅ **_fin** _fin 260701 (base-url fix + textVerbosity; default-verbosity/tiny-role defer→③) |
| [20.021](./_fin/20/20.021_omp_chase_v2_streaming_integrity.md) | v2 streaming integrity | ✅ **_fin** _fin 260701 (IMPORT: partialJson terminal scrub) |
| [20.009](./_fin/20/20.009_omp_chase_append_only_context_integrity.md) | append-only context integrity | _fin 260701 (IMPORT) |
| [20.025](./_fin/20/20.025_omp_chase_compaction_snapcompact_session_scope.md) | snapcompact/session-scope | ✅ **_fin** _fin 260701 (IMPORT: bounded edit snapshots; snapcompact/session-loader defer③) |
| [20.020](./_fin/20/20.020_omp_chase_session_title_idle_recap.md) | session title/idle recap | ✅ **_fin** _fin 260701 (ADAPT: title casing) |
| [10.042](./_fin/10/10.042_gjc_chase_deep_interview_ask_goal_state.md) | deep-interview ask+goal-state | ✅ **_fin** _fin 260701 (ADAPT) |
| [10.059](./_fin/10/10.059_gjc_chase_deep_interview_ask_ralplan_gate.md) | ralplan ask gate + render guard | ✅ **_fin** _fin 260701 (ADAPT+IMPORT) |
| [10.019](./_fin/10/10.019_gjc_chase_gc_file_lock.md) | jwc gc 명령 | ADAPT |
| [20.028](./_fin/20/20.028_omp_chase_web_search_provider_settings.md) | web-search provider settings | ✅ **_fin** _fin 260701 (IMPORT: DDG request-shape + CLI provider settings; gemini api-key defer③) |
| [10.048](./_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md) | dev/CI/release packaging | ✅ **_fin** _fin 260701 (ADAPT: affected-path false-green guard) |

> 추가 ① 후보(플랫폼/UX 말단) 구현 goal: 10.060 · 10.041 · 10.057 · 10.061 · 10.056 · 10.064 · 10.052 · 20.015 all closed.

| NNN | 스코프 | 판정 |
|---|---|---|
| [10.060](./_fin/10/10.060_gjc_chase_tui_render_resilience_editor_submit.md) | TUI render resilience | ✅ **_fin** _fin 260701 |
| [10.041](./_fin/10/10.041_gjc_chase_tui_input_render_windows_psmux.md) | TUI input/render Windows psmux | ✅ **_fin** _fin 260701 |
| [10.057](./_fin/10/10.057_gjc_chase_windows_hardening.md) | Windows hardening | ✅ **_fin** _fin 260701 |
| [10.061](./_fin/10/10.061_gjc_chase_tmux_team_windows_psmux_titles.md) | tmux/team Windows psmux titles | ✅ **_fin** _fin 260701 |
| [10.056](./_fin/10/10.056_gjc_chase_terminal_bell_notifications.md) | terminal bell + completion hook | ✅ **_fin** _fin 260701 (ADAPT: global-only command hook) |
| [10.064](./_fin/10/10.064_gjc_chase_telegram_daemon_entrypoint_notify.md) | Telegram daemon entrypoint + Windows bell | ✅ **_fin** _fin 260701 (ADAPT: hidden daemon adapter + Windows bell docs) |
| [10.052](./_fin/10/10.052_gjc_chase_docs_external_integrations.md) | docs external integrations | ✅ **_fin** _fin 260701 (ADAPT: conservative integration matrix + docs guards) |
| [20.015](./_fin/20/20.015_omp_chase_release_test_leak_hardening.md) | release/test leak hardening | _fin 260701 (track-only reference closure; release implementation owned by 10.048) |

## ② 기능 결정 필요 (게이트 유지)

| NNN | 스코프 | 판정 |
|---|---|---|
| [20.024](./_fin/20/20.024_omp_chase_mcp_oauth_reauth_flow.md) | MCP oauth/reauth | ADAPT + 독립 보안리뷰 게이트 (① 격하 금지) |

## ③ 더 하드닝 될 때까지 백로그

### 인터뷰 확정 defer (2026-07-01, 3장)

| NNN | 스코프 | 사유 |
|---|---|---|
| [10.027](./10.027_gjc_chase_goal_live_artifact_engine.md) | goal live-artifact 검증엔진 | 대형 신규표면, 코어 안정화 대기 |
| [10.044](./10.044_gjc_chase_plugin_extensibility_bundle.md) | plugin extensibility/bundle | 대형 신규표면 |
| [10.063](./10.063_gjc_chase_natives_platform_split_packages.md) | natives 플랫폼 분리 | 대형 배포아키텍처, 저긴급 |

### 기존 게이트/미성숙 (미인터뷰)

| NNN | 사유 |
|---|---|
| [10.006](./10.006_gjc_chase_tui_core.md) | 082/083 분리 후에만 |
| [20.004](./20.004_omp_chase_lsp_dap.md) | held |
| [20.017](./20.017_omp_chase_multi_advisor_runtime.md) | JWC에 advisor 개념 부재 — 미래 설계 입력 |
| [20.018](./20.018_omp_chase_thinking_normalization.md) | pi-dialect 부재 — 재설계 |
| [20.022](./20.022_omp_chase_ssh_tooling_ux.md) | ssh:// 표면 미성숙 |
| [10.045](./10.045_gjc_chase_computer_use_native_control.md) | 대형 |
| [10.046](./10.046_gjc_chase_rlm_research_mode.md) | 대형 |
| [10.039](./10.039_gjc_chase_harness_receipts_phase_rollup.md) | harness 레인 선행 |
| [10.049](./10.049_gjc_chase_performance_bench_corpus.md) | 벤치 코퍼스 미성숙 |
| [10.050](./10.050_gjc_chase_session_tmux_team_worktree.md) | 대형 |
| [20.029](./20.029_omp_chase_stats_sync_worker_perf.md) | JWC packages/stats peer 부재 |

> OMP 20.* 카드는 설계상 전부 reference-only(1:1 port ❌)이므로, ①로 분류돼도 "그대로 복사"가 아니라 "JWC식 재설계 후 채택"을 뜻한다.

## 2026-07-25 신규 카드 tier 배정 (autonomy bucket 매핑: A≈①, C≈②, B≈③)

### ① 기능 결정 없이 따라갈 수 있음 (A bucket, 15장)

| NNN | 스코프 |
|---|---|
| [10.110](./10.110_gjc_chase_sdk_acp_bridge_lifecycle.md) | SDK/ACP/bridge lifecycle |
| [10.112](./10.112_gjc_chase_notifications_telegram_daemon.md) | notifications/Telegram daemon |
| [10.116](./_fin/10/10.116_gjc_chase_natives_windows_platform.md) | natives/Windows/platform (A-slice — welcome.ts 제외) |
| [10.117](./_fin/10/10.117_gjc_chase_ci_release_docs_test_evidence.md) | CI/release/docs evidence-fill |
| [20.081](./_fin/20/20.081_omp_chase_ai_catalog_stream_auth.md) | AI catalog/stream/auth |
| [20.082](./20.082_omp_chase_session_context_settings_persistence.md) | session/context/settings |
| [20.083](./_fin/20/20.083_omp_chase_tool_fs_shell_git_safety.md) | tool/fs/shell/git safety (A-slice만 ①, config/policy는 ②) |
| [20.087](./_fin/20/20.087_omp_chase_native_diff_search_memory_perf.md) | native diff/search/memory perf |
| [20.088](./_fin/20/20.088_omp_chase_release_build_platform_ci.md) | release/build/platform/CI |
| [20.089](./_fin/20/20.089_omp_chase_runtime_stats_logging_collab.md) | runtime/stats/logging/collab |
| [20.102](./_fin/20/20.102_omp_chase_error_notifications_terminal_title.md) | error notifications/terminal title |
| [20.107](./_fin/20/20.107_omp_chase_compaction_retry_history_resilience.md) | compaction/history resilience |
| [20.109](./_fin/20/20.109_omp_chase_tools_platform_runtime_hardening.md) | tool/platform runtime hardening |
| [20.122](./_fin/20/20.122_omp_chase_tui_tool_lifecycle.md) | TUI/tool lifecycle |
| [20.124](./_fin/20/20.124_omp_chase_ai_provider_stream_integrity.md) | AI/provider stream integrity (A-slice만 ①, auth/tier는 ②) |

### ② 기능 결정 필요 (C bucket, 17장)

| NNN | 스코프 |
|---|---|
| [10.108](./10.108_gjc_chase_security_network_authority.md) | security/network authority |
| [10.111](./10.111_gjc_chase_workflow_interview_handoff_agents.md) | workflow/interview/handoff/agents |
| [10.113](./10.113_gjc_chase_tui_cli_terminal_interaction.md) | TUI/CLI/terminal interaction |
| [10.114](./10.114_gjc_chase_ai_models_providers_retry.md) | AI/models/providers/retry |
| [20.084](./20.084_omp_chase_task_subagent_advisor_launch.md) | task/subagent/advisor/launch |
| [20.086](./20.086_omp_chase_extensions_mcp_lsp_dap_browser.md) | extensions/MCP/LSP/DAP/browser |
| [20.101](./20.101_omp_chase_secret_placeholder_redaction.md) | secret placeholder identity |
| [20.103](./20.103_omp_chase_workspace_roots_session_lifecycle.md) | workspace roots/session lifecycle |
| [20.104](./20.104_omp_chase_task_todo_subagent_quiescence.md) | task/todo/subagent quiescence |
| [20.105](./20.105_omp_chase_providers_oauth_usage_fallback.md) | providers/OAuth/usage/fallback |
| [20.106](./20.106_omp_chase_prompt_cache_policy_benchmark.md) | prompt-cache policy/benchmarks |
| [20.108](./20.108_omp_chase_mcp_rpc_acp_protocol_hardening.md) | MCP/RPC/ACP hardening |
| [20.111](./20.111_omp_chase_tui_export_extensions_status.md) | TUI/exports/extensions |
| [20.121](./20.121_omp_chase_native_computer_use.md) | native computer use |
| [20.123](./20.123_omp_chase_native_live_audio_attestation.md) | native live/audio/attestation |
| [20.125](./20.125_omp_chase_task_rebuild_search_rendering.md) | task/rebuild/search/rendering |
| [20.126](./20.126_omp_chase_account_usage_launch_stats.md) | account/usage/launch/stats |

### ③ 백로그 / track-only (B bucket, 7장)

| NNN | 사유 |
|---|---|
| [10.109](./10.109_gjc_chase_session_storage_migration.md) | 상태 마이그레이션 — 게이트 대기 |
| [10.115](./10.115_gjc_chase_tools_search_memory_plugins.md) | 대형/참조 |
| [20.085](./20.085_omp_chase_tui_render_input_markdown.md) | track-only |
| [20.090](./20.090_omp_chase_robomp_swarm_reference.md) | reference-only |
| [20.110](./20.110_omp_chase_advisor_hindsight_vibe_runtime.md) | JWC 개념 부재 — 설계 입력 |
| [20.112](./20.112_omp_chase_misc_runtime_quality.md) | evidence-fill 잔여 |
| [20.127](./20.127_omp_chase_shell_native_ci.md) | evidence-fill 잔여 |
