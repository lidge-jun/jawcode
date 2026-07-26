# chase — 따라갈 내용 인덱스 (실행 순)

> **부채 스택**: [devlog 02_debt_priority_stack](../../devlog/_fin/260614_chase_upstream_pull_priority_report/02_debt_priority_stack.md)
> **pull 델타**: [devlog 01_pull_delta](../../devlog/_fin/260614_chase_upstream_pull_priority_report/01_pull_delta_gjc_omp.md)
> **명명 (필수)**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — `jwc` · **`python/jwc-rpc`** · `.jwc`
> **RPC 묶음 실현성**: [03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)
> 업데이트: **2026-07-25** (chase clone pull refresh: GJC `baa4dc76`, OMP `59619623`)
> **PABCD devlog**: [260614_chase_rpc_harness_bundle](../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md)

## 2026-07-25 세션 상태 (upstream refresh + 문서화 루프)

> **신규 카드 39**: GJC 10 (10.108–10.117, 529 commits `3ddf26079..baa4dc76`) · OMP 29 (20.081–20.090 / 20.101–20.112 / 20.121–20.127, 1301 commits `b0d04e517..59619623`). 해시셋 커버리지 독립 검증 완료(uncovered=0, extraneous=0). 증거: [devlog 001_delta_evidence](../../devlog/_plan/260725_chase_upstream_refresh/001_delta_evidence.md) + coverage notes 020–023.
> **자율 구현 대상 (A bucket)**: GJC 10.110(SDK/ACP/bridge) · 10.112(notifications/Telegram daemon) · 10.116(natives/Windows, A-slice — welcome.ts 제외) · 10.117(CI/release/docs evidence-fill); OMP 20.081·20.082·20.083(A-slice)·20.087·20.088·20.089·20.102·20.107·20.109·20.122·20.124(A-slice).
> **보류 (B)**: 10.109 · 10.115 · 20.085 · 20.090 · 20.110 · 20.112 · 20.127. **사용자 결정 (C)**: 10.108 · 10.111 · 10.113 · 10.114 · 20.084 · 20.086 · 20.101 · 20.103–20.106 · 20.108 · 20.111 · 20.121 · 20.123 · 20.125 · 20.126.
> **정본 정합성 수리**: markerless backlog는 **23장**이다. 재현 가능한 16장은 10 keep + 5 commit-anchor remap + 1 active 복귀(10.090)로 정리하며, legacy malformed 7장(10.017, 10.020, 10.025, 10.026, 10.029, 20.002, 20.007)은 별도 closure audit 대상으로 둔다.

> **번호 충돌 후속(사용자 결정 필요)**: active와 archived가 서로 다른 카드인데 같은 id를 쓰는 12쌍 — 20.015, 10.028, 10.031, 20.009, 20.012, 10.033, 10.030, 20.011, 10.032, 10.035, 20.013, 10.034. 본 reconciliation에서는 renumber하지 않는다.
>
> **Legacy closure-evidence backlog**: `chase-closure-integrity.ts`가 약 144개 기존 `_fin` 카드의 `Closed:` / implementing commit / owner-path 누락을 보고한다. closure convention 이전 카드이므로 별도 audit에서 근거를 보강하거나 active로 돌린다.

## 2026-06-27 세션 상태 (방향-결정 인터뷰 + 닫기 루프)

> **마감(_fin) 9**: reference 6 (20.002·003·007·008, 10.020·025) · 코드 10.013 · doc-judgment 10.024·10.005.
> **방향 기록 9** (인터뷰 elici). **보류/연기 active**: 20.004(held) · 10.006(082/083 게이트).
> **test-env 해제 → 실테스트 마감 +6**: 네이티브 catalog 정렬(`f53f285` natives→`workspace:*`) 후 10.003 · 10.012 · 10.023 · 20.005 · 20.006 · 10.007 모두 실테스트로 마감. 10.007은 추가로 실 tmux 3.6a 스모크가 잠재 버그(`=NAME` option-target 깨짐 → `=NAME:` #580) 발견·수정. (이전 "⛔ blocked 8" 프레이밍 폐기.)
> **잔여 active 0 — 확정 goal 타깃 11개 전부 _fin 마감 완료** (10.002 C4 auth는 독립 보안 감사 기반 split-decision으로 **무코드** 마감: jwc가 모든 안전 축 at-or-ahead, gjc import 시 보안 회귀). **비-타깃 active**: 10.006(082/083 게이트) · 20.004(held) · 10.027(split-off P3 deferred ← 10.021) · 10.019(borderline). **후속 버그**: `tmux-sessions.ts:143` `=NAME` 폼 **✅ 수정**(dd5d7b0). audit 경위: [devlog 16_pause_audit](../../devlog/_plan/260627_chase_direction_interview/16_pause_audit.md) · [18_native_testenv_fix](../../devlog/_plan/260627_chase_direction_interview/18_native_testenv_fix.md).

## G3 — jwc 자체 (Tier 1)

| 순 | 항목 | 문서 |
|---|------|------|
| 1 | 99.02 CI/schemas 마감 | [006](./006_jwc_own_backlog.md) · [50_status](../../structure/50_status.md) |
| 2 | 99.04 HUD | [006](./006_jwc_own_backlog.md) |
| 3 | ctrl+t full transcript | [devlog 260614_tui](../../devlog/_plan/260614_tui_codex_live_toggle/10_pabcd_ctrl_t_full_transcript_p_plan.md) |
| 4 | jaw-interview markdown WIP | [devlog 260614_jaw_interview](../../devlog/_plan/260614_jaw_interview_markdown_mode/) |

## G1 — gjc 카드 (Tier 2)

### Telegram / notifications stack (2026-06-28, upstream/dev `a791d72a`)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| T1 | 028 | [10.028 notifications SDK](./_fin/10/10.028_gjc_chase_notifications_sdk.md) | **P1** | _fin · phases 33,34,35 |
| T2 | 029 | [10.029 notify config CLI](./_fin/10/10.029_gjc_chase_notify_config_cli.md) | **P1** | ✅ **_fin** _fin · phases 1,36 |
| T3 | 030 | [10.030 Telegram managed daemon](./_fin/10/10.030_gjc_chase_telegram_managed_daemon.md) | **P1** | _fin · phases 37-40 |
| T4 | 032 | [10.032 Telegram remote answers](./_fin/10/10.032_gjc_chase_telegram_remote_answers.md) | **P1** | _fin · phases 44-51 |
| T5 | 031 | [10.031 threaded surface](./_fin/10/10.031_gjc_chase_telegram_threaded_surface.md) | P2 | _fin · phases 4,41,42,43 |
| T6 | 034 | [10.034 media/file transfer](./_fin/10/10.034_gjc_chase_telegram_media_file_transfer.md) | P2 | _fin · phases 4,12,53,54,55 |
| T7 | 033 | [10.033 session lifecycle](./_fin/10/10.033_gjc_chase_telegram_session_lifecycle.md) | P2 | _fin · A=ph11, B/C=ph52 |
| T8 | 035 | [10.035 adapters/docs](./_fin/10/10.035_gjc_chase_notifications_adapters_docs.md) | P3 | _fin · phase 56 |

Recommended first user-value path: **028 → 029 → 030 → 032**, then 031/034/033/035.

### Non-Telegram upstream/dev backlog (2026-06-28, split from 616-commit delta)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| U1 | 036 | [10.036 AI provider/auth/model catalog](./_fin/10/10.036_gjc_chase_ai_provider_auth_model_catalog.md) | **P1** | ✅ **_fin** _fin · phases 14,31,32 |
| U2 | 047 | [10.047 security/privacy guardrails](./_fin/10/10.047_gjc_chase_security_privacy_guardrails.md) | **P1** | ✅ **_fin** _fin · phases 14/16/17, 30 |
| U3 | 037 | [10.037 runtime/process lifecycle](./_fin/10/10.037_gjc_chase_runtime_process_lifecycle_hardening.md) | **P1** | ✅ **_fin** _fin · phases 6,17,18,57 |
| U4 | 038 | [10.038 RPC control plane v2](./_fin/10/10.038_gjc_chase_rpc_control_plane_v2.md) | **P1** | ✅ **_fin** _fin · phases 7,20,27,58 |
| U5 | 040 | [10.040 compaction/pruning/resident memory](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) | **P1** | ✅ **_fin** _fin · phases 21–23 |
| U6 | 043 | [10.043 web-search/read URL hardening](./_fin/10/10.043_gjc_chase_web_search_insane_security.md) | **P1** | ✅ **_fin** _fin · phases 24-26, 29 |
| U7 | 051 | [10.051 agent/composer/toolcall integrity](./_fin/10/10.051_gjc_chase_agent_composer_toolcall_integrity.md) | **P1** | ✅ **_fin** _fin · phases 6,15,19,59 |
| U8 | 039 | [10.039 harness receipts/phase rollup](./10.039_gjc_chase_harness_receipts_phase_rollup.md) | P2 | ⬜ |
| U9 | 041 | [10.041 TUI/input/render/Windows psmux](./_fin/10/10.041_gjc_chase_tui_input_render_windows_psmux.md) | P2 | ✅ **_fin** _fin 260701 · ADAPT inline/list-slot autocomplete; remaining broad tmux/session lifecycle split remains 10.050 |
| U10 | 042 | [10.042 deep-interview/ask/goal state](./_fin/10/10.042_gjc_chase_deep_interview_ask_goal_state.md) | P2 | ✅ **_fin** _fin 260701 (ADAPT: 1 slice) |
| U11 | 044 | [10.044 plugin/extensibility bundle](./10.044_gjc_chase_plugin_extensibility_bundle.md) | P2 | ⬜ |
| U12 | 045 | [10.045 computer-use native control](./10.045_gjc_chase_computer_use_native_control.md) | P2 | ⬜ |
| U13 | 048 | [10.048 dev/CI/release packaging](./_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md) | P2 | ✅ **_fin** _fin 260701 · ADAPT affected-path false-green guard (`8b3ab60`); matrix fanout/release credentials deferred |
| U14 | 050 | [10.050 session/tmux/team/worktree](./10.050_gjc_chase_session_tmux_team_worktree.md) | P2 | ⬜ |
| U15 | 046 | [10.046 RLM/research mode](./10.046_gjc_chase_rlm_research_mode.md) | P3 | ⬜ |
| U16 | 049 | [10.049 perf/bench/corpus](./10.049_gjc_chase_performance_bench_corpus.md) | P3 | ⬜ |
| U17 | 052 | [10.052 docs/external integrations](./_fin/10/10.052_gjc_chase_docs_external_integrations.md) | P3 | ✅ **_fin** _fin 260701 · ADAPT docs matrix, bridge-client namespace, generated-docs guard |

Recommended order after Telegram MVP: **036/047 security-auth first**, then runtime/RPC/compaction, then UX/docs/perf reference cards.

### 10.053 cluster (v0.7.7 split, 2026-06-29)

10.053 umbrella split into 054-058 by cluster. Replay/data-integrity card 055 closed.

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| R1 | 055 | [10.055 Codex/AI replay stability](./_fin/10/10.055_gjc_chase_codex_replay_stability.md) | **P1** | ✅ **_fin** _fin 260629 · 1 import (`29f4621`), 1 defer (`16d4e2b`), 3 confirm already-shipped, 1 defer; goal `65f1dc1a-373` |
| R2 | 054 | [10.054 local provider discovery](./_fin/10/10.054_gjc_chase_local_provider_discovery.md) | P2 | ✅ **_fin** _fin 260701 · IMPORT (adapt) all 5 surfaces as JWC code (`8b3b861`/`f8838a4`/`afd7038`); goal `f8909338-255` |
| R3 | 056 | [10.056 terminal bell/completion hook](./_fin/10/10.056_gjc_chase_terminal_bell_notifications.md) | P3 | ✅ **_fin** _fin 260701 · ADAPT terminal bell + global-only `completion.notifyCommand` with `JWC_NOTIFICATION_*` env |
| R4 | 057 | [10.057 Windows hardening](./_fin/10/10.057_gjc_chase_windows_hardening.md) | P3 | ✅ **_fin** _fin 260701 · ADAPT npm shims/update verify/team PowerShell/worktree+coordinator error preservation; v0.7.8 psmux/titles closed in 10.061, broad lifecycle remains 10.050 |
| R5 | 058 | [10.058 status line + misc tooling](./_fin/10/10.058_gjc_chase_status_line_misc_tooling.md) | P3 | ✅ **_fin** _fin 260629 · web-search timeout IMPORT (`2401b6a`), memory GC DEFER (evidence), 5 polish items out-of-scope; goal `65f1dc1a-373` |

### 10.059-065 v0.7.8 델타 (2026-07-01, `fa995807..20c299eb` 21 commits)

신규 7카드. 21커밋 전부 카드 또는 chore/docs no-card 귀속 (미할당 0). 권장 우선순위: 보안/data-safety + 사용자 가치 먼저 (059 render guard·ask gate → 060 render resilience → 062 provider → 064 daemon → 061 tmux → 065 prompt → 063 packaging).

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| V1 | 059 | [10.059 deep-interview/ralplan/ultragoal ask gate + render guard](./_fin/10/10.059_gjc_chase_deep_interview_ask_ralplan_gate.md) | P2 | ✅ **_fin** _fin 260701 (ADAPT+IMPORT: 4 slices) |
| V2 | 060 | [10.060 TUI render resilience + Ctrl+Enter + status-line](./_fin/10/10.060_gjc_chase_tui_render_resilience_editor_submit.md) | P2 | ✅ **_fin** _fin 260701 (IMPORT/ADAPT; custom editor UX deferred) |
| V3 | 062 | [10.062 DeepInfra provider + Gemini UA](./_fin/10/10.062_gjc_chase_ai_provider_deepinfra_gemini_ua.md) | P2 | ✅ **_fin** _fin 260701 · IMPORT (adapt) DeepInfra provider+service-tier + Gemini UA as JWC code (`b249348`/`ad6ec8f`/`27311f6`); goal `f8909338-255` |
| V4 | 064 | [10.064 Telegram daemon entrypoint + Windows bell](./_fin/10/10.064_gjc_chase_telegram_daemon_entrypoint_notify.md) | P2 | ✅ **_fin** _fin 260701 · ADAPT hidden `notify daemon-internal` adapter + Windows Terminal bell docs |
| V5 | 061 | [10.061 tmux/team Windows psmux titles](./_fin/10/10.061_gjc_chase_tmux_team_windows_psmux_titles.md) | P3 | ✅ **_fin** _fin 260701 · ADAPT tmux titles + Windows/psmux launch/team dispatch |
| V6 | 065 | [10.065 prompt self-awareness grounding](./_fin/10/10.065_gjc_chase_prompt_self_awareness_grounding.md) | P3 | ✅ **_fin** _fin 260701 (ADAPT) |
| V7 | 063 | [10.063 natives platform split packages](./10.063_gjc_chase_natives_platform_split_packages.md) | P3 | ⬜ |

> no-card (chore/docs): `af1e9c5d` version bump 0.7.8 · `b948e377` contributing guide (#1312) · `ebacf8d0` Discord invite (#1301). OMP 849-commit 백로그는 범위 밖 — 보류.

### 10.066-069 v0.7.9/v0.7.10 델타 (2026-07-02, `20c299eb..79b42377` 54 commits)

54커밋 = 4카드 + no-card docs/changelog/revert bucket. 권장 검토순: workflow state(067) → session/tmux resilience(068) → UX(066) → provider/search docs(069).

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| X1 | 067 | [10.067 goal/plan skill-state refresh](./10.067_gjc_chase_goal_plan_skill_state_refresh.md) | P1 | ⬜ |
| X2 | 068 | [10.068 tmux/Telegram/session resilience](./_fin/10/10.068_gjc_chase_tmux_telegram_session_resilience.md) | P2 | ✅ **_fin** |
| X3 | 066 | [10.066 composer command/model selector UX](./_fin/10/10.066_gjc_chase_composer_command_model_selector_ux.md) | P2 | ✅ **_fin** |
| X4 | 069 | [10.069 provider/search/docs/model support](./_fin/10/10.069_gjc_chase_provider_search_docs_model_support.md) | P2 | ✅ **_fin** _fin 260702 · already-covered Tavily/Claude retry docs + rejected reverted Aside |

### 10.070-073 v0.7.11 델타 (2026-07-03, `79b42377..db7938e1` 34 commits)

34커밋 = 4 active 카드. 권장 검토순: workflow/state(070) → RPC/session lifecycle(073) → search/utils/edit safety(071) → TUI/tmux UX(072). JWC 코드 무변경 chase-map 갱신만 수행.

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| Y1 | 070 | [10.070 workflow intent/state/artifacts](./10.070_gjc_chase_workflow_intent_state_artifacts.md) | P1 | ⬜ |
| Y2 | 073 | [10.073 RPC/session/notifications lifecycle](./10.073_gjc_chase_rpc_session_notifications_lifecycle.md) | P1 | ⬜ |
| Y3 | 071 | [10.071 search/utils/edit safety](./_fin/10/10.071_gjc_chase_search_utils_edit_safety.md) | P2 | ✅ **_fin** |
| Y4 | 072 | [10.072 model selector/tmux/cmux UX](./10.072_gjc_chase_model_selector_tmux_cmux_ux.md) | P2 | ⬜ |

### 10.087-104 v0.9.6→v0.11.1+ 델타 (2026-07-17, `4a80bac9..3ddf26079` 302 non-merge commits)

실행 순서는 P1 model/security/lifecycle을 먼저 닫고, P2 UX·infra를 이어서 처리한 뒤 P3 CI·misc·docs를 마감한다.

| 순 | NNN | 문서 | P | 상태 |
|---|---:|---|---|---|
| C03 | 089 | [10.089 model preset/fallback selection](./_fin/10/10.089_gjc_chase_model_preset_fallback_selection.md) | P1 | ✅ **_fin** |
| C11 | 097 | [10.097 Grok/Codex benchmark presets](./_fin/10/10.097_gjc_chase_grok_codex_benchmark_presets.md) | P1 | ✅ **_fin** |
| C12 | 098 | [10.098 Codex reasoning/thinking SDK](./_fin/10/10.098_gjc_chase_codex_reasoning_thinking_sdk.md) | P1 | ✅ **_fin** |
| C02 | 088 | [10.088 security/prompt control-token](./_fin/10/10.088_gjc_chase_security_prompt_control_token.md) | P1 | ✅ **_fin** |
| C01 | 087 | [10.087 SDK lifecycle ledger](./_fin/10/10.087_gjc_chase_sdk_lifecycle_ledger_hardening.md) | P1 | ✅ **_fin** |
| C17 | 103 | [10.103 provider safety/transport](./_fin/10/10.103_gjc_chase_provider_safety_transport.md) | P2 | ✅ **_fin** |
| C05 | 091 | [10.091 TUI command palette](./_fin/10/10.091_gjc_chase_tui_command_palette.md) | P2 | ✅ **_fin** |
| C06 | 092 | [10.092 TUI IRC/sidebar/Kitty/tmux](./_fin/10/10.092_gjc_chase_tui_irc_sidebar_kitty_tmux.md) | P2 | ✅ **_fin** |
| C07 | 093 | [10.093 coordinator MCP/session reaper](./_fin/10/10.093_gjc_chase_coordinator_mcp_session_reaper.md) | P2 | ✅ **_fin** |
| C08 | 094 | [10.094 Telegram notification v2](./_fin/10/10.094_gjc_chase_telegram_notification_v2.md) | P2 | ✅ **_fin** |
| C09 | 095 | [10.095 deep-interview/goal/ultragoal](./_fin/10/10.095_gjc_chase_deep_interview_goal_ultragoal.md) | P2 | ✅ **_fin** |
| C10 | 096 | [10.096 session context-usage SSOT](./_fin/10/10.096_gjc_chase_session_context_usage_ssot.md) | P2 | ✅ **_fin** |
| C04 | 090 | [10.090 prompt refactor/compact ralplan](./10.090_gjc_chase_prompt_refactor_compact_ralplan.md) | P2 | ⬜ active — closure withdrawn; no substantiating JWC implementation |
| C13 | 099 | [10.099 RPC durable selection/pet](./_fin/10/10.099_gjc_chase_rpc_durable_selection_pet.md) | P3 | ✅ **_fin** |
| C14 | 100 | [10.100 CI/release stabilization](./10.100_gjc_chase_ci_release_stabilization.md) | P3 | ⬜ |
| C15 | 101 | [10.101 browser/psmux misc](./10.101_gjc_chase_browser_psmux_misc.md) | P3 | ⬜ |
| C16 | 102 | [10.102 agent async misc](./_fin/10/10.102_gjc_chase_agent_async_misc.md) | P3 | ✅ **_fin** |
| C18 | 104 | [10.104 docs/changelog/QA](./10.104_gjc_chase_docs_changelog_qa.md) | P3 | ⬜ |

### 10.105-107 post-v0.11.1 supplement (2026-07-17, `3ddf26079..904eab21c` 41 non-merge commits)

| 순 | NNN | 문서 | P | 상태 |
|---|---:|---|---|---|
| S1 | 105 | [10.105 routing/fallback availability cache](./_fin/10/10.105_gjc_chase_routing_fallback_availability_cache.md) | P1 | ✅ **_fin** |
| S2 | 106 | [10.106 config UX/credential setup](./_fin/10/10.106_gjc_chase_config_ux_credential_setup.md) | P2 | ✅ **_fin** |
| S3 | 107 | [10.107 context compaction/CI](./_fin/10/10.107_gjc_chase_context_compaction_ci.md) | P2 | ✅ **_fin** |

### Legacy RPC / early-priority carried rows
| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| 9 | 011 | [10.011 receipt spool](./_fin/10/10.011_gjc_chase_receipt_spool.md) | P1 | ✅ **_fin** _fin · receipt spool |
| 10 | 008 | [10.008 RPC lifecycle](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) | P1 | ✅ **_fin** _fin · lifecycle evidence |
| 10b | 018 | [10.018 RPC registry/UDS](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | P1 | ✅ **_fin** _fin · TS+Py · UDS P2 |
| 10c | 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | P2 | ✅ **_fin** _fin · residual rows documented |
| 11 | 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | P1 | ✅ **_fin** _fin · busy guard |
| 12 | 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | P1 | ✅ **_fin** _fin · JWC-ahead progress |
| 13 | 007 | [10.007 team profile](./_fin/10/10.007_gjc_chase_team_profile_self_heal.md) | P1 | **✅ **_fin** _fin** self-heal + `=NAME:` 폼 수정 (jwc 7cc3f31, 64/0 + 실 tmux 스모크) |
| 14–15 | 002·003 | [10.002](./_fin/10/10.002_gjc_chase_ai_auth.md) · [10.003](./_fin/10/10.003_gjc_chase_cursor.md) | P1 | **10.002 ✅ **_fin** _fin** (C4 split-decision, 보안감사 무코드 마감) · **10.003 ✅ **_fin** _fin** (timeout fix 4eeffb7) |
| 16–17 | 012 · 021 | 10.012 · 10.021 archived | P2 | steering/redteam closure recorded; split→[10.027](./10.027_gjc_chase_goal_live_artifact_engine.md) active |
| 18 | 019 | [10.019 gc](./_fin/10/10.019_gjc_chase_gc_file_lock.md) | P2 | ✅ **_fin** |
| 19 | 023 | [10.023 task notifications](./_fin/10/10.023_gjc_chase_task_notification_context.md) | P2 | **✅ **_fin** _fin** (omp 0.5.1, e80075b) |
| — | 005·013·020·024·025 | **✅ _fin (260627)** task_subagent·assistant_cache·deep_interview·coordinator·perf_geobench · 006 deferred(082/083) | P2–3 | ✅/⏸ |

### RPC PABCD 묶음 (한 사이클 권장)

```
011 (spool 잔여 테스트) → 008 (rpc-mode durability) → 018 (TS registry + jwc_rpc list_sessions) → 026 (issues 매트릭스 클로즈)
```

- **Python**: `python/jwc-rpc` — upstream `gjc_rpc` diff 참조만 ([008](./008_gjc_jwc_naming_contract.md)).
- **완료 기준**: [03](./../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md) Phase 1 / 1b.

## G2 — omp 카드 (Tier 3)

| 순 | NNN | 문서 |
|---|-----|------|
| 23 | 20.006 | [20.006 TUI micro](./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md) **✅ **_fin** _fin** (omp e914bf0/3d646d8, jwc a291199) |
| 24 | 20.005 | [20.005 steering](./_fin/20/20.005_omp_chase_steering_delivery.md) **✅ **_fin** _fin** (omp 42ffc83, 055aee8) |
| 25 | 20.003 | [20.003 memory/skills](./_fin/20/20.003_omp_chase_memory_skills.md) |
| 26 | 20.007 | [20.007 session modules](./_fin/20/20.007_omp_chase_session_modularization.md) |
| — | 20.008 | [20.008 15.13 delta](./_fin/20/20.008_omp_chase_pull_15_13_delta.md) |


### OMP latest delta split (v16.1.13 → v16.1.20, reference-only)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| O1 | 009 | [20.009 append-only context integrity](./_fin/20/20.009_omp_chase_append_only_context_integrity.md) | P2 | _fin 260701 |
| O2 | 010 | [20.010 AI OAuth/reasoning replay](./_fin/20/20.010_omp_chase_ai_oauth_reasoning_replay.md) | P2 | ✅ **_fin** _fin · reference · phases 10,60 |
| O3 | 011 | [20.011 TUI image drafts/terminal edges](./_fin/20/20.011_omp_chase_tui_image_drafts_terminal_edges.md) | P2 | _fin · ref · phases 10,61 |
| O4 | 012 | [20.012 bash snapshot/env security](./_fin/20/20.012_omp_chase_bash_snapshot_env_security.md) | P2 | _fin · ref · phases 10,61 |
| O5 | 013 | [20.013 plugin virtual registry/bundle](./_fin/20/20.013_omp_chase_plugin_virtual_registry_bundle.md) | P2 | _fin · ref · phases 10,61 |
| O6 | 014 | [20.014 goal compaction/provider concurrency](./_fin/20/20.014_omp_chase_goal_compaction_provider_concurrency.md) | P2 | ✅ **_fin** _fin · ref · phases 10,61 |
| O7 | 015 | [20.015 release/test leak hardening](./_fin/20/20.015_omp_chase_release_test_leak_hardening.md) | P3 | _fin |

### 20.023-030 v16.2.9 델타 (2026-07-01, `ca9f2847e..b6c9747d4` 175 commits, reference-only)

신규 8 reference 카드 (전부 ⬜ open, **1:1 port ❌**). 175커밋 = 105 card-bound + 70 no-card, 미할당 0. OMP는 G2 약함 축이라 전부 설계 참조 — JWC 코드 무변경. 권장 검토순: 보안/AI 표면 먼저 (024 oauth → 023 providers → 027 prompts(identity) → 025 compaction → 028 web-search → 026 TUI → 029 stats → 030 misc).

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| W1 | 024 | [20.024 MCP oauth/reauth flow](./_fin/20/20.024_omp_chase_mcp_oauth_reauth_flow.md) | ref | ✅ **_fin** |
| W2 | 023 | [20.023 AI providers/catalog/service-tier](./_fin/20/20.023_omp_chase_ai_providers_catalog_service_tier.md) | ref | ✅ **_fin** _fin 260701 · reference-triage (no JWC code): service-tier already-shipped, all_turns inapplicable, leaked-fence-heal defer→20.018; goal `f8909338-255` |
| W2.5 | 019 | [20.019 codex/AI config](./_fin/20/20.019_omp_chase_codex_ai_config.md) | ref→ADAPT | ✅ **_fin** _fin 260701 · ADAPT 2 JWC slices: codex base-url host-boundary fix (`bc79608`) + textVerbosity official-endpoint plumbing (`027c3a9`); all_turns inapplicable, default-verbosity/tiny-role defer→③; goal `f8909338-255` |
| W3 | 027 | [20.027 prompts/subagent/discovery (identity)](./_fin/20/20.027_omp_chase_prompts_subagent_discovery_rules.md) | ref | ✅ **_fin** _fin |
| W4 | 025 | [20.025 compaction/snapcompact/session-scope](./_fin/20/20.025_omp_chase_compaction_snapcompact_session_scope.md) | ref | ✅ **_fin** _fin 260701 (IMPORT) |
| W5 | 028 | [20.028 web-search/provider settings](./_fin/20/20.028_omp_chase_web_search_provider_settings.md) | ref | ✅ **_fin** _fin 260701 · IMPORT: DDG browser-aligned request + CLI provider settings; gemini api-key defer③ |
| W6 | 026 | [20.026 TUI loader/MCP-enable](./20.026_omp_chase_tui_input_loader_mcp_enable.md) | ref | ⬜ |
| W7 | 029 | [20.029 stats sync worker/perf](./20.029_omp_chase_stats_sync_worker_perf.md) | ref | ⬜ |
| W8 | 030 | [20.030 misc dictation/binary/font/yield/irc/win](./20.030_omp_chase_misc_dictation_binary_font_yield_irc_win.md) | ref | ⬜ |

> no-card: 38 merge · 12 style · 10 chore · 8 test · 1 revert (`d1e412eef`) · 1 keep (`6f8f76be4`) · version bumps `0ba736f5b`/`38250ce88`/`5bc68f57c`/`b6c9747d4`. behavior gap 없음.

### 20.031-035 v16.3.1 델타 (2026-07-02, `b6c9747d4..0ea6ea630` 433 commits, reference-only)

433커밋 = 5 reference 카드 + no-card docs/changelog/style/test/version buckets. OMP는 G2 약함 축이라 전부 설계 참조 — JWC 코드 무변경. 권장 검토순: session/data safety(033) → tool contract(035) → native/search(031) → AI provider(032) → UI/runtime(034).

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| Z1 | 033 | [20.033 session/patch/rewind integrity](./_fin/20/20.033_omp_chase_session_patch_rewind_integrity.md) | ref | ✅ **_fin** |
| Z2 | 035 | [20.035 tool schema/task/TTS/stats](./_fin/20/20.035_omp_chase_tool_schema_task_tts_stats.md) | ref | ✅ **_fin** _fin 260702 · reference-triage; public schema change rejected, task/stats/voice split |
| Z3 | 031 | [20.031 native/search pipeline](./20.031_omp_chase_native_search_pipeline.md) | ref | ⬜ |
| Z4 | 032 | [20.032 AI thinking/catalog/speech](./20.032_omp_chase_ai_thinking_catalog_speech.md) | ref | ⬜ |
| Z5 | 034 | [20.034 TUI/collab/browser resilience](./20.034_omp_chase_tui_collab_browser_resilience.md) | ref | ⬜ |

### 20.036-040 v16.3.4 델타 (2026-07-03, `0ea6ea630..d0c1890a6` 216 commits, reference-only)

216커밋 = 5 reference 카드 + version/changelog/style/test/no-card buckets. OMP는 G2 약함 축이라 전부 설계 참조 — JWC 코드 무변경. 권장 검토순: AI/auth risk(036) → session/data safety(037) → tool/hashline/plugin/task safety(038) → TUI/runtime(039) → robomp/release references(040).

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| Q1 | 036 | [20.036 AI catalog/auth/usage](./20.036_omp_chase_ai_catalog_auth_usage.md) | ref | ⬜ |
| Q2 | 037 | [20.037 session/async/plan integrity](./_fin/20/20.037_omp_chase_session_async_plan_integrity.md) | ref | ✅ **_fin** |
| Q3 | 038 | [20.038 hashline/tool/plugin/task safety](./_fin/20/20.038_omp_chase_hashline_tool_plugin_task_safety.md) | ref | ✅ **_fin** |
| Q4 | 039 | [20.039 TUI/terminal/render resilience](./20.039_omp_chase_tui_terminal_render_resilience.md) | ref | ⬜ |
| Q5 | 040 | [20.040 robomp/ISO/sandbox/release](./20.040_omp_chase_robomp_iso_sandbox_release.md) | ref | ⬜ |

### 20.051-070 v16.4.2→v17.0.1 델타 (2026-07-17, `7aa1d581c..b0d04e517` 586 non-merge commits, reference-only)

OMP는 1:1 이식하지 않는다. P1 model/auth/provider 레퍼런스를 먼저 평가하고 P2 UX·tooling, P3 운영·release 순으로 따른다.

| 순 | NNN | 문서 | P | 상태 |
|---|---:|---|---|---|
| D01 | 051 | [20.051 model hub/selector](./_fin/20/20.051_omp_chase_model_hub_selector.md) | P1 | ✅ **_fin** |
| D02 | 052 | [20.052 catalog pricing/routing](./_fin/20/20.052_omp_chase_catalog_pricing_routing.md) | P1 | ✅ **_fin** |
| D03 | 053 | [20.053 auth/OAuth/credential](./_fin/20/20.053_omp_chase_auth_oauth_credential.md) | P1 | ✅ **_fin** |
| D04 | 054 | [20.054 provider/transport/schema](./_fin/20/20.054_omp_chase_provider_transport_schema.md) | P1 | ✅ **_fin** |
| D05 | 055 | [20.055 model resolver/fallback](./_fin/20/20.055_omp_chase_model_resolver_fallback.md) | P1 | ✅ **_fin** |
| D17 | 067 | [20.067 usage/quota/spend-limit](./_fin/20/20.067_omp_chase_usage_quota_spend_limit.md) | P1 | ✅ **_fin** |
| D06 | 056 | [20.056 vibe mode](./_fin/20/20.056_omp_chase_vibe_mode.md) | P2 | ✅ **_fin** |
| D07 | 057 | [20.057 ask dialog](./_fin/20/20.057_omp_chase_ask_dialog.md) | P2 | ✅ **_fin** |
| D08 | 058 | [20.058 TUI render/streaming](./20.058_omp_chase_tui_render_streaming.md) | P2 | ⬜ |
| D09 | 059 | [20.059 advisor/steering](./20.059_omp_chase_advisor_steering.md) | P2 | ⬜ |
| D10 | 060 | [20.060 agent-loop/tool/stream](./_fin/20/20.060_omp_chase_agent_loop_tool_stream.md) | P2 | ✅ **_fin** |
| D11 | 061 | [20.061 search/grep/tools](./20.061_omp_chase_search_grep_tools.md) | P2 | ⬜ |
| D12 | 062 | [20.062 plugin/MCP/discovery](./_fin/20/20.062_omp_chase_plugin_mcp_discovery.md) | P2 | ✅ **_fin** |
| D19 | 069 | [20.069 centralized prompt/small model](./20.069_omp_chase_centralized_prompt_small_model.md) | P2 | ⬜ |
| D13 | 063 | [20.063 session/settings/startup](./20.063_omp_chase_session_settings_startup.md) | P3 | ⬜ |
| D14 | 064 | [20.064 mnemopi/memory/eval](./20.064_omp_chase_mnemopi_memory_eval.md) | P3 | ⬜ |
| D15 | 065 | [20.065 browser/bash/commit](./_fin/20/20.065_omp_chase_browser_bash_commit.md) | P3 | ✅ **_fin** |
| D16 | 066 | [20.066 collab-web/extension](./_fin/20/20.066_omp_chase_collab_web_extension.md) | P3 | ✅ **_fin** |
| D18 | 068 | [20.068 TUI/SIXEL/subagent misc](./20.068_omp_chase_tui_sixel_subagent_misc.md) | P3 | ⬜ |
| D20 | 070 | [20.070 CI/release/changelog](./20.070_omp_chase_ci_release_changelog.md) | P3 | ⬜ |

### 20.071-080 post-v17.0.1 supplement 2 (2026-07-17, `b0d04e517..5394081390` 175 non-merge commits, reference-only)

| 순 | NNN | 문서 | P | 상태 |
|---|---:|---|---|---|
| D24 | 074 | [20.074 AI credential redaction](./_fin/20/20.074_omp_chase_ai_credential_redaction.md) | P1 | ✅ **_fin** |
| D21 | 071 | [20.071 Warp event bridge](./_fin/20/20.071_omp_chase_warp_event_bridge.md) | P2 | ✅ **_fin** |
| D22 | 072 | [20.072 cursor/advisor/xdev](./_fin/20/20.072_omp_chase_cursor_advisor_xdev.md) | P2 | ✅ **_fin** |
| D23 | 073 | [20.073 TUI rendering/status](./20.073_omp_chase_tui_rendering_status.md) | P2 | ⬜ |
| D25 | 075 | [20.075 coding-agent tool restoration](./_fin/20/20.075_omp_chase_coding_agent_tool_restoration.md) | P2 | ✅ **_fin** |
| D26 | 076 | [20.076 session/plan lifecycle](./_fin/20/20.076_omp_chase_session_plan_lifecycle.md) | P2 | ✅ **_fin** |
| D27 | 077 | [20.077 plugins/CommonJS/MCP](./_fin/20/20.077_omp_chase_plugins_commonjs_mcp.md) | P2 | ✅ **_fin** |
| D29 | 079 | [20.079 Codex Lite/telemetry](./_fin/20/20.079_omp_chase_codex_lite_telemetry.md) | P2 | ✅ **_fin** |
| D28 | 078 | [20.078 bash/IRC/registry](./20.078_omp_chase_bash_irc_registry.md) | P3 | ⬜ |
| D30 | 080 | [20.080 CI/style/changelog](./20.080_omp_chase_ci_style_changelog.md) | P3 | ⬜ |


## 완료 (_fin)

| NNN | [_fin/10](./_fin/INDEX.md) |
|-----|---------------------------|
| 009–017 | pi-shell, submit, perf×3, context, tool_choice, Fable N/A |

## Jawdev chase expansion — 2026-06-26

> Document: `struct_har/chase/007_follow_index.md`
> Title: chase — 따라갈 내용 인덱스 (실행 순)
> Lane: JWC coordination
> Status: active chase card
> Canonical source: `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` (GJC dev/upstream/dev and OMP main/origin/main)
> Primary patch surfaces: structure/, struct_har/chase/, devlog/_plan/

### Why this is behind or can drift

1. This card exists because JWC must reconcile a concrete upstream/reference behavior with the current Jawcode fork, not because file names happen to differ.
2. The comparison source is devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi; agents must not substitute `devlog/_upstream_*` or the root repository history as the chase baseline.
3. The current drift risk is semantic: behavior, workflow state, command contract, persistence, or operator evidence can diverge even when a simple diff looks small.
4. The fork also carries JWC-specific naming, `.jwc` state, and Jawdev workflow rules, so a direct copy from the source lane can be wrong.
5. For active cards, the lag means JWC either lacks the source behavior, lacks a matching guard, or has not documented a conscious rejection.
6. For completed cards, the lag can return when the source clone advances past the reviewed HEAD or when adjacent JWC code changes without updating this card.
7. Index and MOC documents can drift by pointing agents at stale priority, stale branch names, stale clone paths, or already-finished work.
8. The first Jawdev obligation is to restate the delta in JWC terms before touching implementation files.
9. The second obligation is to decide whether the source behavior is a product requirement, a reference pattern, or a rejected mismatch.
10. The third obligation is to bind the decision to a verification gate so later agents can prove the card is closed.

### Where to patch

1. Start from this document, then open the current source lane at `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` and the matching JWC files under structure/, struct_har/chase/, devlog/_plan/.
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

1. Re-read this file after patching and verify the stated source lane still matches devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi.
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
3. A sub-agent must resolve the chase baseline from `devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi` and verify the branch with `git status --short --branch`.
4. A sub-agent must treat the source clone as read-only evidence unless the explicit task is to fast-forward that clone.
5. A sub-agent must write the patch against JWC files only and must not stage clone contents.
6. A sub-agent must preserve JWC naming and translate upstream identifiers through the naming contract.
7. A sub-agent must report decisions in terms of import/adapt/reject/split, not as vague 'needs follow-up' text.
8. A sub-agent must name the exact files that should change before editing them.
9. A sub-agent must include verification output, not just an implementation summary.
10. A sub-agent must leave this document more accurate than it found it whenever the card's status changes.

### Minimum patch worksheet

1. Source anchor checked: devlog/_gjc_chase/gajae-code + devlog/_omp_chase/oh-my-pi.
2. Source branch checked: GJC dev/upstream/dev and OMP main/origin/main.
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
