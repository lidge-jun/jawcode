# 10 — gjc_chase_MOC

> 상태: 🟡 운영 중 (2026-07-17 · worktree `0e8d9f4`)
> **정본 디렉터리**: `struct_har/chase/10_*` · `10.NNN_*`
> **의미**: `devlog/_gjc_chase/gajae-code` 대비 jwc **뒤쳐짐(G1)** — **1갭 = 문서 1개** (`10.NNN`, `001`~)

## 번호

| **10** | 본 MOC (`10_gjc_chase_MOC.md`) |
| **10.NNN** | 플랜 (`10.001_…` 파일명) |

규약 · `_fin`: [005_devlog_numbering.md](./005_devlog_numbering.md)

## 링크

| | |
|---|---|
| 갭 | [002_gap_inventory.md](./002_gap_inventory.md) |
| **명명** | **[008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md)** |
| 참조 | [003_reference_from_gjc.md](./003_reference_from_gjc.md) |
| bands | [bands/](./bands/) |
| 델타 | [structure/40_fork-delta.md](../../structure/40_fork-delta.md) |
| 따라갈 순 | [007_follow_index.md](./007_follow_index.md) |

## Reviewed through

| gjc | jwc |
|---|---|
| `3ddf26079` (`upstream/dev`, v0.11.1+) | `0e8d9f4` (worktree, 2026-07-17 chase refresh) |

> OMP head is intentionally not repeated here; see [20_omp_chase_MOC.md](./20_omp_chase_MOC.md).

## Recent GJC dev deltas

| NNN | upstream fact | jwc 처리 |
|---|---|---|
| 053 | local OpenAI-compatible provider (#1257,#1260-#1263), terminal bell (#1278), Windows npm shims (#1274), replay encrypted sanitization (#1208,#1214,#1218), harmony invoke-envelope leak (#1219), GPT-5.5 context cap (#1231) — 55 commits `a791d72a..fa995807` (v0.7.4→0.7.7) | ✅ split → 054-058 |
| 059-065 | v0.7.8 delta `fa995807..20c299eb` (21 commits): deep-interview/ralplan/ultragoal ask gate + render guard (#1287,#1290,#1294), TUI render isolation + Ctrl+Enter + status-line (#1291,#1296,#1298,#1302), tmux/Windows psmux titles (#1303,#1306), DeepInfra provider + Gemini UA (#1284,#1314), natives platform split (#1300), Telegram daemon entrypoint + Windows bell (#1299), prompt self-awareness grounding | ⬜ → 059-065 (3 no-card chore/docs) |
| 066-069 | v0.7.9/v0.7.10 delta `20c299eb..79b42377` (54 commits): composer command/model selector UX, goal/plan skill-state refresh, tmux/Telegram/session resilience, provider/search/docs/model support | 🟡 → 066-068 active; 069 ✅ _fin (Tavily/Claude retry evidence, reverted Aside rejected) |
| 070-073 | v0.7.11 delta `79b42377..db7938e1` (34 commits): workflow intent/state/artifact contracts, search/utils/edit safety, model-selector/tmux/cmux UX, RPC/session/notifications lifecycle | ⬜ → 070-073 active |
| 074-081 | v0.7.11→v0.9.1 delta `db7938e1..b3b5b8a9` (248 commits): notifications/Telegram v2 rich streaming, ultragoal pipeline/extragoal, TUI viewport/media/compose v2, context/perf/compaction audit, skill discovery/slash commands, subagent/fork/session hardening, model/provider v2 (effort/Fugu/safety), session vanish/postmortem/lifecycle/CI | ⬜ → 074-081 active |
| 082-086 | v0.9.1→v0.9.6 delta `b3b5b8a9..4a80bac9` (68 non-merge commits): IRC visualization + kitty sidebar + expiry integrity, GPT-5.6 tier family + models.json embed (v0.9.3 startup crash), session resume/cache-cost/startup/TS7/ACP/RPC, Anthropic OAuth/Bedrock stream integrity, TUI/tmux/Telegram operator UX + credential pinning + MCP disclosure | ⬜ → 082-086 active |
| 004 | pre-send `#checkEstimatedContextBeforePrompt()` before message packing; pruning/compaction at sanctioned maintenance boundary (`devlog/_gjc_chase/gajae-code/packages/coding-agent/src/session/agent-session.ts:4747-4756,6517-6533,6537-6558`) | ✅ **_fin** [10.004](./_fin/10/10.004_gjc_chase_session_compaction.md) |
| 007 | `GJC_TMUX_LAUNCHED_ENV`-guarded `@gjc-profile` retag only for genuinely launched leaders (`team-runtime.ts:1646-1683`; changelog `:17-18`) | ownership invariant; rebrand-safe team gap |
| 008 | RPC lifecycle stdio | ✅ **_fin** [10.008](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) |
| 009 | pi-shell UTF-8 fixup #551 | ✅ **_fin** [10.009](./_fin/10/10.009_gjc_chase_pishell_utf8_fixup.md) 260613 |
| 010 | harness submit readiness #549 | ✅ **_fin** [10.010](./_fin/10/10.010_gjc_chase_harness_submit_readiness.md) 260613 |
| 011 | receipt spool | ✅ **_fin** [10.011](./_fin/10/10.011_gjc_chase_receipt_spool.md) |
| 018 | RPC registry | ✅ **_fin** [10.018](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) (UDS P2) |
| 022 | goal AgentBusyError (#616) | ✅ **_fin** [10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| 026 | issues/01–13 | ✅ **_fin** [10.026](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) |

## 활성 (`10.NNN`)

| NNN | 문서 | 스코프 | P | 상태 |
|---|---|---|---|---|
| 001 | [10.001_gjc_chase_cycle.md](./10.001_gjc_chase_cycle.md) | fetch·CHANGELOG | P0 | 🟡 |
| 002 | [10.002_gjc_chase_ai_auth.md](./_fin/10/10.002_gjc_chase_ai_auth.md) | ai·090 | **P1** | ✅ _fin |
| 003 | [10.003_gjc_chase_cursor.md](./_fin/10/10.003_gjc_chase_cursor.md) | 081 | **P1** | ✅ _fin |
| 005 | [10.005_gjc_chase_task_subagent.md](./_fin/10/10.005_gjc_chase_task_subagent.md) | task | P2 | ✅ _fin |
| 006 | [10.006_gjc_chase_tui_core.md](./10.006_gjc_chase_tui_core.md) | tui | P3 | ⬜ |
| 007 | [10.007_gjc_chase_team_profile_self_heal.md](./_fin/10/10.007_gjc_chase_team_profile_self_heal.md) | team·leader profile | **P1** | ✅ _fin |
| 012-steer | [10.012_gjc_chase_goal_steering.md](./_fin/10/10.012_gjc_chase_goal_steering.md) | goal steering | P2 | ✅ _fin |
| 013-cache | [10.013_gjc_chase_assistant_msg_cache.md](./_fin/10/10.013_gjc_chase_assistant_msg_cache.md) | assistant cache | P3 | ✅ _fin |
| 019 | [10.019_gjc_chase_gc_file_lock.md](./10.019_gjc_chase_gc_file_lock.md) | gc | P2 | ⬜ |
| 021 | [10.021_gjc_chase_goal_redteam_review.md](./_fin/10/10.021_gjc_chase_goal_redteam_review.md) | goal red-team | P2 | ✅ _fin (split→027) |
| 023 | [10.023_gjc_chase_task_notification_context.md](./_fin/10/10.023_gjc_chase_task_notification_context.md) | task notify | P2 | ✅ _fin |
| 020 | [10.020_gjc_chase_deep_interview_semantics.md](./_fin/10/10.020_gjc_chase_deep_interview_semantics.md) | interview ref | P3 | ✅ _fin |
| 024 | [10.024_gjc_chase_coordinator_mcp_watch.md](./_fin/10/10.024_gjc_chase_coordinator_mcp_watch.md) | coordinator | P3 | ✅ _fin |
| 025 | [10.025_gjc_chase_perf_corpus_geobench.md](./_fin/10/10.025_gjc_chase_perf_corpus_geobench.md) | perf ref | P3 | ✅ _fin |
| 027 | [10.027_gjc_chase_goal_live_artifact_engine.md](./10.027_gjc_chase_goal_live_artifact_engine.md) | live-artifact engine (split←021) | P3 | ⬜ |
| 028 | [10.028_gjc_chase_notifications_sdk.md](./_fin/10/10.028_gjc_chase_notifications_sdk.md) | notifications SDK core | **P1** | ✅ _fin |
| 029 | [10.029_gjc_chase_notify_config_cli.md](./_fin/10/10.029_gjc_chase_notify_config_cli.md) | notify setup/status config | **P1** | ✅ _fin |
| 030 | [10.030_gjc_chase_telegram_managed_daemon.md](./_fin/10/10.030_gjc_chase_telegram_managed_daemon.md) | Telegram managed daemon | **P1** | ✅ _fin |
| 031 | [10.031_gjc_chase_telegram_threaded_surface.md](./_fin/10/10.031_gjc_chase_telegram_threaded_surface.md) | threaded session topics/render/inbound | P2 | ✅ _fin |
| 032 | [10.032_gjc_chase_telegram_remote_answers.md](./_fin/10/10.032_gjc_chase_telegram_remote_answers.md) | remote ask answers/buttons/free text | **P1** | ✅ _fin |
| 033 | [10.033_gjc_chase_telegram_session_lifecycle.md](./_fin/10/10.033_gjc_chase_telegram_session_lifecycle.md) | Telegram-driven session lifecycle | P2 | ✅ _fin |
| 034 | [10.034_gjc_chase_telegram_media_file_transfer.md](./_fin/10/10.034_gjc_chase_telegram_media_file_transfer.md) | media/files/telegram_send | P2 | ✅ _fin |
| 035 | [10.035_gjc_chase_notifications_adapters_docs.md](./_fin/10/10.035_gjc_chase_notifications_adapters_docs.md) | adapters/docs/release surface | P3 | ✅ _fin |
| 036 | [10.036_gjc_chase_ai_provider_auth_model_catalog.md](./_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md) | AI provider/auth/model catalog | **P1** | ✅ _fin |
| 037 | [10.037_gjc_chase_runtime_process_lifecycle_hardening.md](./_fin/10/10.037_gjc_chase_runtime_process_lifecycle_hardening.md) | runtime/process lifecycle | **P1** | ✅ _fin |
| 038 | [10.038_gjc_chase_rpc_control_plane_v2.md](./_fin/10/10.038_gjc_chase_rpc_control_plane_v2.md) | RPC control plane v2 | **P1** | ✅ _fin |
| 039 | [10.039_gjc_chase_harness_receipts_phase_rollup.md](./10.039_gjc_chase_harness_receipts_phase_rollup.md) | harness receipts/phase rollup | P2 | ⬜ |
| 040 | [10.040_gjc_chase_compaction_pruning_resident_memory.md](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) | compaction/pruning/resident memory | **P1** | ✅ _fin |
| 041 | [10.041_gjc_chase_tui_input_render_windows_psmux.md](./_fin/10/10.041_gjc_chase_tui_input_render_windows_psmux.md) | TUI/input/render/Windows psmux | P2 | ✅ **_fin** 260701 (ADAPT: inline/list-slot autocomplete) |
| 042 | [10.042_gjc_chase_deep_interview_ask_goal_state.md](./_fin/10/10.042_gjc_chase_deep_interview_ask_goal_state.md) | deep-interview/ask/goal state | P2 | ✅ **_fin** 260701 (ADAPT) |
| 043 | [10.043_gjc_chase_web_search_insane_security.md](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) | web-search/read URL hardening | **P1** | ✅ _fin |
| 044 | [10.044_gjc_chase_plugin_extensibility_bundle.md](./10.044_gjc_chase_plugin_extensibility_bundle.md) | plugin/extensibility bundle | P2 | ⬜ |
| 045 | [10.045_gjc_chase_computer_use_native_control.md](./10.045_gjc_chase_computer_use_native_control.md) | computer-use native control | P2 | ⬜ |
| 046 | [10.046_gjc_chase_rlm_research_mode.md](./10.046_gjc_chase_rlm_research_mode.md) | RLM/research mode | P3 | ⬜ |
| 047 | [10.047_gjc_chase_security_privacy_guardrails.md](./_fin/10/10.047_gjc_chase_security_privacy_guardrails.md) | security/privacy guardrails | **P1** | ✅ _fin |
| 048 | [10.048_gjc_chase_dev_ci_release_packaging.md](./_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md) | dev/CI/release packaging | P2 | ✅ **_fin** 260701 (ADAPT: affected-path false-green guard) |
| 049 | [10.049_gjc_chase_performance_bench_corpus.md](./10.049_gjc_chase_performance_bench_corpus.md) | perf/bench/corpus | P3 | ⬜ |
| 050 | [10.050_gjc_chase_session_tmux_team_worktree.md](./10.050_gjc_chase_session_tmux_team_worktree.md) | session/tmux/team/worktree | P2 | ⬜ |
| 051 | [10.051_gjc_chase_agent_composer_toolcall_integrity.md](./_fin/10/10.051_gjc_chase_agent_composer_toolcall_integrity.md) | agent/composer/toolcall integrity | **P1** | ✅ _fin |
| 052 | [10.052_gjc_chase_docs_external_integrations.md](./_fin/10/10.052_gjc_chase_docs_external_integrations.md) | docs/external integrations | P3 | ✅ **_fin** 260701 (ADAPT: conservative external integration matrix + docs guards) |
| 053 | [10.053_gjc_chase_local_provider_terminal_bell_windows.md](./10.053_gjc_chase_local_provider_terminal_bell_windows.md) | split index → 054-058 | P2 | ✅ split |
| 054 | [10.054_gjc_chase_local_provider_discovery.md](./_fin/10/10.054_gjc_chase_local_provider_discovery.md) | local provider discovery + fallback (split←053) | P2 | ✅ **_fin** [10.054](./_fin/10/10.054_gjc_chase_local_provider_discovery.md) 260701 |
| 055 | [10.055_gjc_chase_codex_replay_stability.md](./_fin/10/10.055_gjc_chase_codex_replay_stability.md) | Codex/AI replay stability + sanitization (split←053) | **P1** | ✅ **_fin** [10.055](./_fin/10/10.055_gjc_chase_codex_replay_stability.md) 260629 |
| 056 | [10.056_gjc_chase_terminal_bell_notifications.md](./_fin/10/10.056_gjc_chase_terminal_bell_notifications.md) | terminal bell + completion hook (split←053) | P3 | ✅ **_fin** 260701 (ADAPT: terminal bell + global-only completion hook) |
| 057 | [10.057_gjc_chase_windows_hardening.md](./_fin/10/10.057_gjc_chase_windows_hardening.md) | Windows hardening: shims·workers·psmux (split←053) | P3 | ✅ **_fin** 260701 (ADAPT: npm shims, worker PowerShell quoting, worktree/coordinator error preservation) |
| 058 | [10.058_gjc_chase_status_line_misc_tooling.md](./_fin/10/10.058_gjc_chase_status_line_misc_tooling.md) | status line + misc tooling (split←053) | P3 | ✅ **_fin** [10.058](./_fin/10/10.058_gjc_chase_status_line_misc_tooling.md) 260629 (web-search timeout import `2401b6a`; memory GC defer; 5 polish out-of-scope) |
| 059 | [10.059_gjc_chase_deep_interview_ask_ralplan_gate.md](./_fin/10/10.059_gjc_chase_deep_interview_ask_ralplan_gate.md) | deep-interview wording · ralplan/ultragoal ask gate · render guard (v0.7.8) | P2 | ✅ **_fin** 260701 (ADAPT+IMPORT) |
| 060 | [10.060_gjc_chase_tui_render_resilience_editor_submit.md](./_fin/10/10.060_gjc_chase_tui_render_resilience_editor_submit.md) | TUI render resilience · Ctrl+Enter submit · status-line UX (v0.7.8) | P2 | ✅ **_fin** 260701 (IMPORT/ADAPT; custom editor UX deferred) |
| 061 | [10.061_gjc_chase_tmux_team_windows_psmux_titles.md](./_fin/10/10.061_gjc_chase_tmux_team_windows_psmux_titles.md) | tmux workspace titles · Windows/psmux team spawn (v0.7.8) | P3 | ✅ **_fin** 260701 (ADAPT) |
| 062 | [10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md](./_fin/10/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md) | DeepInfra provider + service-tier · Gemini CLI UA (v0.7.8) | P2 | ✅ **_fin** [10.062](./_fin/10/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md) 260701 |
| 063 | [10.063_gjc_chase_natives_platform_split_packages.md](./10.063_gjc_chase_natives_platform_split_packages.md) | split @natives into per-platform packages (v0.7.8) | P3 | ⬜ |
| 064 | [10.064_gjc_chase_telegram_daemon_entrypoint_notify.md](./_fin/10/10.064_gjc_chase_telegram_daemon_entrypoint_notify.md) | compiled Telegram daemon entrypoint · Windows Terminal bell (v0.7.8) | P2 | ✅ **_fin** 260701 (ADAPT: hidden daemon adapter + Windows bell docs) |
| 065 | [10.065_gjc_chase_prompt_self_awareness_grounding.md](./_fin/10/10.065_gjc_chase_prompt_self_awareness_grounding.md) | system prompt self-awareness source grounding (v0.7.8) | P3 | ✅ **_fin** 260701 (ADAPT) |
| 066 | [10.066_gjc_chase_composer_command_model_selector_ux.md](./10.066_gjc_chase_composer_command_model_selector_ux.md) | composer command/model selector UX (v0.7.9/0.7.10) | P2 | ⬜ |
| 067 | [10.067_gjc_chase_goal_plan_skill_state_refresh.md](./10.067_gjc_chase_goal_plan_skill_state_refresh.md) | goal/plan skill-state refresh + role artifacts | P1 | ⬜ |
| 068 | [10.068_gjc_chase_tmux_telegram_session_resilience.md](./10.068_gjc_chase_tmux_telegram_session_resilience.md) | tmux/Telegram/session resilience | P2 | ⬜ |
| 069 | [10.069_gjc_chase_provider_search_docs_model_support.md](./_fin/10/10.069_gjc_chase_provider_search_docs_model_support.md) | provider/search/docs/model support | P2 | ✅ _fin 260702 (already-covered Tavily/Claude retry docs; reverted Aside no-adopt) |
| 070 | [10.070_gjc_chase_workflow_intent_state_artifacts.md](./10.070_gjc_chase_workflow_intent_state_artifacts.md) | workflow intent/state/artifact contracts | P1 | ⬜ |
| 071 | [10.071_gjc_chase_search_utils_edit_safety.md](./10.071_gjc_chase_search_utils_edit_safety.md) | search perf + utils/edit safety | P2 | ⬜ |
| 072 | [10.072_gjc_chase_model_selector_tmux_cmux_ux.md](./10.072_gjc_chase_model_selector_tmux_cmux_ux.md) | model selector + tmux/cmux UX | P2 | ⬜ |
| 073 | [10.073_gjc_chase_rpc_session_notifications_lifecycle.md](./10.073_gjc_chase_rpc_session_notifications_lifecycle.md) | RPC/session/notifications lifecycle | P1 | ⬜ |
| 074 | [10.074_gjc_chase_notifications_telegram_v2_rich_streaming.md](./10.074_gjc_chase_notifications_telegram_v2_rich_streaming.md) | notifications/Telegram v2: rich, streaming, slash commands | P2 | ⬜ |
| 075 | [10.075_gjc_chase_ultragoal_pipeline_extragoal.md](./10.075_gjc_chase_ultragoal_pipeline_extragoal.md) | ultragoal pipeline + extragoal review gates | P2 | ⬜ |
| 076 | [10.076_gjc_chase_tui_viewport_media_compose_v2.md](./10.076_gjc_chase_tui_viewport_media_compose_v2.md) | TUI viewport/media/compose v2 | P2 | ⬜ |
| 077 | [10.077_gjc_chase_context_perf_compaction_audit.md](./10.077_gjc_chase_context_perf_compaction_audit.md) | context/perf audit + prompt lifecycle | **P1** | ⬜ |
| 078 | [10.078_gjc_chase_skill_discovery_slash_commands.md](./10.078_gjc_chase_skill_discovery_slash_commands.md) | runtime skill discovery + slash commands | P2 | ⬜ |
| 079 | [10.079_gjc_chase_subagent_fork_session_hardening.md](./10.079_gjc_chase_subagent_fork_session_hardening.md) | subagent/fork/session hardening + MCP lifecycle | P2 | ⬜ |
| 080 | [10.080_gjc_chase_model_provider_effort_fugu_safety.md](./10.080_gjc_chase_model_provider_effort_fugu_safety.md) | model/provider v2: effort, Fugu, safety refusals | **P1** | ⬜ |
| 081 | [10.081_gjc_chase_session_vanish_postmortem_lifecycle.md](./10.081_gjc_chase_session_vanish_postmortem_lifecycle.md) | session vanish/postmortem + CI stabilization | P2 | ⬜ |
| 082 | [10.082_gjc_chase_irc_visualization_kitty_sidebar.md](./10.082_gjc_chase_irc_visualization_kitty_sidebar.md) | IRC visualization + kitty sidebar + expiry integrity | **P1** | ⬜ |
| 083 | [10.083_gjc_chase_gpt56_tier_models_catalog_embed.md](./10.083_gjc_chase_gpt56_tier_models_catalog_embed.md) | GPT-5.6 tiers + models.json embed + effort persistence | **P1** | ⬜ |
| 084 | [10.084_gjc_chase_session_resume_startup_ts7_acp_rpc.md](./10.084_gjc_chase_session_resume_startup_ts7_acp_rpc.md) | session resume/cache-cost/startup + TS7 + ACP/RPC | **P1** | ⬜ |
| 085 | [10.085_gjc_chase_provider_stream_oauth_integrity.md](./10.085_gjc_chase_provider_stream_oauth_integrity.md) | Anthropic OAuth/Bedrock stream + credential integrity | **P1** | ⬜ |
| 086 | [10.086_gjc_chase_tui_tmux_telegram_operator_ux.md](./10.086_gjc_chase_tui_tmux_telegram_operator_ux.md) | TUI/tmux/Telegram operator UX + MCP disclosure | P2 | ⬜ |
| 10.087 | `gjc_chase_sdk_lifecycle_ledger_hardening` | ⬜ | P1 | SDK lifecycle ledger crash-safety, PID reuse, receipt parsing | `4a80bac9..3ddf26079` |
| 10.088 | `gjc_chase_security_prompt_control_token` | ⬜ | P1 | control-token neutralization, untrusted content framing | `4a80bac9..3ddf26079` |
| 10.089 | `gjc_chase_model_preset_fallback_selection` | ⬜ | P1 | sticky fallback chains, durable default model selection | `4a80bac9..3ddf26079` |
| 10.090 | `gjc_chase_prompt_refactor_compact_ralplan` | ⬜ | P2 | core prompt compaction, shared ralplan guidance | `4a80bac9..3ddf26079` |
| 10.091 | `gjc_chase_tui_command_palette` | ⬜ | P2 | searchable command palette, double-Esc draft clear | `4a80bac9..3ddf26079` |
| 10.092 | `gjc_chase_tui_irc_sidebar_kitty_tmux` | ⬜ | P2 | IRC sidebar 70:30, Kitty anchored-wrap, sixel probe | `4a80bac9..3ddf26079` |
| 10.093 | [`gjc_chase_coordinator_mcp_session_reaper`](./_fin/10/10.093_gjc_chase_coordinator_mcp_session_reaper.md) | ✅ **_fin** | P2 | owner-proof idle reaper, tmux probe, stdio dispatch | `4a80bac9..3ddf26079` |
| 10.094 | `gjc_chase_telegram_notification_v2` | ⬜ | P2 | /verbose /lean, directed replay, shared notification service | `4a80bac9..3ddf26079` |
| 10.095 | `gjc_chase_deep_interview_goal_ultragoal` | ⬜ | P2 | deep-interview continuation, goal reminder, ultragoal receipt | `4a80bac9..3ddf26079` |
| 10.096 | `gjc_chase_session_context_usage_ssot` | ⬜ | P2 | provider-reported usage SSOT, context snapshot cache | `4a80bac9..3ddf26079` |
| 10.097 | `gjc_chase_grok_codex_benchmark_presets` | ⬜ | P1 | Grok 4.5, GPT-5.6 Codex presets, mpreset | `4a80bac9..3ddf26079` |
| 10.098 | `gjc_chase_codex_reasoning_thinking_sdk` | ⬜ | P1 | thinking capabilities, invalid_prompt circuit breaker | `4a80bac9..3ddf26079` |
| 10.099 | `gjc_chase_rpc_durable_selection_pet` | ⬜ | P3 | durable default model via RPC, deferred selection, pet | `4a80bac9..3ddf26079` |
| 10.100 | `gjc_chase_ci_release_stabilization` | ⬜ | P3 | affected-path, SDK publish, shard isolation, biome | `4a80bac9..3ddf26079` |
| 10.101 | `gjc_chase_browser_psmux_misc` | ⬜ | P3 | expired browser tabs, psmux lifecycle, context maintenance | `4a80bac9..3ddf26079` |
| 10.102 | `gjc_chase_agent_async_misc` | ⬜ | P3 | async resume, session dirs, MCP tools-only, admission | `4a80bac9..3ddf26079` |
| 10.103 | `gjc_chase_provider_safety_transport` | ⬜ | P2 | provider safety stops, managed fallback authority | `4a80bac9..3ddf26079` |
| 10.104 | `gjc_chase_docs_changelog_qa` | ⬜ | P3 | changelog dedup, QA evidence, SDK guide repair | `4a80bac9..3ddf26079` |
| 10.105 | `gjc_chase_routing_fallback_availability_cache` | ⬜ | P1 | routing/fallback hardening, availability cache, subagent stickiness | `3ddf26079..904eab21c` |
| 10.106 | `gjc_chase_config_ux_credential_setup` | ⬜ | P2 | config doctor, credential setup, keybindings, SDK UX | `3ddf26079..904eab21c` |
| 10.107 | `gjc_chase_context_compaction_ci` | ⬜ | P2 | compaction/pruning/hindsight budgets, CI native addon | `3ddf26079..904eab21c` |

> **260717 delta**: +18 cards (10.087–10.104), range `4a80bac9..3ddf26079` (v0.9.6→v0.11.1+, 302 non-merge).
> **260717 delta (supplement)**: +3 cards (10.105–10.107), range `3ddf26079..904eab21c` (post-v0.11.1, 41 non-merge).

## 완료

→ [_fin/10/](./_fin/10/README.md) · [INDEX](./_fin/INDEX.md)

| NNN | 문서 | 완료일 | 구현 |
|---|---|---|---|
| 009 | [10.009 pi-shell UTF-8 panic](./_fin/10/10.009_gjc_chase_pishell_utf8_fixup.md) | 260613 | [99.11.01](../../devlog/_plan/260612_jawcode_fork/phase1/99.11.01_plan_upstream_pishell_utf8_fixup.md) — 188 tests green |
| 010 | [10.010 harness submit gate](./_fin/10/10.010_gjc_chase_harness_submit_readiness.md) | 260613 | [99.11.02](../../devlog/_plan/260612_jawcode_fork/phase1/99.11.02_plan_upstream_harness_submit_gate.md) — 175 tests green |
| 008 | [10.008 RPC lifecycle](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) | 260615 | [RPC bundle](../../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md) — 31+3 tests |
| 011 | [10.011 receipt spool](./_fin/10/10.011_gjc_chase_receipt_spool.md) | 260615 | same |
| 018 | [10.018 registry](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | 260615 | same; UDS P2 |
| 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | 260615 | [RPC bundle](../../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md) — Phase 1 appendix + UDS issue 09 |
| 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | 260615 | goal continuation busy/compaction guard — 19 tests green |
| 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | 260615 | pre-send + pruning persistence + compaction progress — 45 focused tests green |

## 불변

orchestrate · jaw-interview · `.jwc` · `packages/jwc` only bin · `@jawcode-dev/*`

## omp

[20_omp_chase_MOC.md](./20_omp_chase_MOC.md)

`10_phase1_jwc_shell`(devlog) = 010 셸 ✅, 본 MOC 무관.

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/10_gjc_chase_MOC.md`
> Title: 10 — gjc_chase_MOC
> Lane: GJC
> Status: active chase card
> Canonical source: `devlog/_gjc_chase/gajae-code` (dev tracking upstream/dev)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_gjc_chase/gajae-code; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_gjc_chase/gajae-code` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
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

1. Re-read this file after patching and verify the stated source lane still matches devlog/_gjc_chase/gajae-code.
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
3. A sub-agent must resolve the chase baseline from `devlog/_gjc_chase/gajae-code` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_gjc_chase/gajae-code.
2. Source branch checked: dev tracking upstream/dev.
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
