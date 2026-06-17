# 10 — gjc_chase_MOC

> 상태: 🟡 운영 중 (2026-06-16)
> **정본 디렉터리**: `struct_har/chase/10_*` · `10.NNN_*`
> **의미**: `devlog/_upstream_gjc` 대비 jwc **뒤쳐짐(G1)** — **1갭 = 문서 1개** (`10.NNN`, `001`~)

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
| `5ed80862` (0.5.3 + Unreleased RLM) | `d60b7822` (worktree) |

> OMP head is intentionally not repeated here; see [20_omp_chase_MOC.md](./20_omp_chase_MOC.md).

## Recent GJC dev deltas

| NNN | upstream fact | jwc 처리 |
|---|---|---|
| 004 | pre-send `#checkEstimatedContextBeforePrompt()` before message packing; pruning/compaction at sanctioned maintenance boundary (`devlog/_upstream_gjc/packages/coding-agent/src/session/agent-session.ts:4747-4756,6517-6533,6537-6558`) | ✅ **_fin** [10.004](./_fin/10/10.004_gjc_chase_session_compaction.md) |
| 007 | `GJC_TMUX_LAUNCHED_ENV`-guarded `@gjc-profile` retag only for genuinely launched leaders (`team-runtime.ts:1646-1683`; changelog `:17-18`) | ownership invariant; rebrand-safe team gap |
| 008 | RPC lifecycle stdio | ✅ **_fin** [10.008](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) |
| 009 | pi-shell UTF-8 fixup #551 | ✅ **_fin** [10.009](./_fin/10/10.009_gjc_chase_pishell_utf8_fixup.md) 260613 |
| 010 | harness submit readiness #549 | ✅ **_fin** [10.010](./_fin/10/10.010_gjc_chase_harness_submit_readiness.md) 260613 |
| 011 | receipt spool | ✅ **_fin** [10.011](./_fin/10/10.011_gjc_chase_receipt_spool.md) |
| 018 | RPC registry | ✅ **_fin** [10.018](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) (UDS P2) |
| 022 | goal AgentBusyError (#616) | ✅ **_fin** [10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| 026 | issues/01–13 | ✅ **_fin** [10.026](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) |
| 027 | RLM research mode (#778) | ⬜ **신규** [10.027](./10.027_gjc_chase_rlm_research_mode.md) — public surface decision 필요 |
| 028 | native `computer_use` coordinate contract (#695) | 🟡 [10.028](./10.028_gjc_chase_computer_use_coordinate_contract.md) — JWC lazy CUA proxy vs GJC native coordinate/supervisor diff measured |
| 029 | process/resource lifecycle hardening (F1/U1–U10) | ⬜ **신규** [10.029](./10.029_gjc_chase_process_lifecycle_hardening.md) — P0 safety bundle |
| 030 | long-session TUI/render/output-size hardening | ⬜ **신규** [10.030](./10.030_gjc_chase_long_session_tui_hardening.md) — JWC visual/scroll guards 유지 |
| 031 | provider/auth reliability fixes | ⬜ **신규** [10.031](./10.031_gjc_chase_provider_auth_reliability.md) — [10.002](./10.002_gjc_chase_ai_auth.md) 구현 시 fold |
| 032 | subagent controls/service tier/resume durability | ⬜ **신규** [10.032](./10.032_gjc_chase_subagent_controls.md) — [10.005](./10.005_gjc_chase_task_subagent.md) 업데이트 후보 |
| 033 | native model-provider `web_search` routing | ⬜ **신규** [10.033](./10.033_gjc_chase_web_search_provider_routing.md) — search skill policy와 reconcile |
| 034 | state-writer/workflow invariants | ⬜ **신규** [10.034](./10.034_gjc_chase_state_writer_invariants.md) — JWC orchestrate semantics-only |
| 035 | setup credential import + bridge endpoint opt-ins | ⬜ **신규** [10.035](./10.035_gjc_chase_setup_bridge_optins.md) — onboarding/security split |

## 활성 (`10.NNN`)

| NNN | 문서 | 스코프 | P | 상태 |
|---|---|---|---|---|
| 001 | [10.001_gjc_chase_cycle.md](./10.001_gjc_chase_cycle.md) | fetch·CHANGELOG | P0 | 🟡 |
| 002 | [10.002_gjc_chase_ai_auth.md](./10.002_gjc_chase_ai_auth.md) | ai·090 | **P1** | ⬜ |
| 003 | [10.003_gjc_chase_cursor.md](./10.003_gjc_chase_cursor.md) | 081 | **P1** | ⬜ |
| 005 | [10.005_gjc_chase_task_subagent.md](./10.005_gjc_chase_task_subagent.md) | task | P2 | ⬜ |
| 006 | [10.006_gjc_chase_tui_core.md](./10.006_gjc_chase_tui_core.md) | tui | P3 | ⬜ |
| 007 | [10.007_gjc_chase_team_profile_self_heal.md](./10.007_gjc_chase_team_profile_self_heal.md) | team·leader profile | **P1** | ⬜ |
| 013-cache | [10.013_gjc_chase_assistant_msg_cache.md](./10.013_gjc_chase_assistant_msg_cache.md) | assistant cache | P3 | ⬜ |
| 019 | [10.019_gjc_chase_gc_file_lock.md](./10.019_gjc_chase_gc_file_lock.md) | gc | P2 | ⬜ |
| 021 | [10.021_gjc_chase_goal_redteam_review.md](./10.021_gjc_chase_goal_redteam_review.md) | goal red-team | P2 | ⬜ |
| 023 | [10.023_gjc_chase_task_notification_context.md](./10.023_gjc_chase_task_notification_context.md) | task notify | P2 | ⬜ |
| 020 | [10.020_gjc_chase_deep_interview_semantics.md](./10.020_gjc_chase_deep_interview_semantics.md) | interview ref | P3 | ⬜ |
| 024 | [10.024_gjc_chase_coordinator_mcp_watch.md](./10.024_gjc_chase_coordinator_mcp_watch.md) | coordinator | P3 | ⬜ |
| 025 | [10.025_gjc_chase_perf_corpus_geobench.md](./10.025_gjc_chase_perf_corpus_geobench.md) | perf ref | P3 | ⬜ |
| 027 | [10.027_gjc_chase_rlm_research_mode.md](./10.027_gjc_chase_rlm_research_mode.md) | RLM research lane | P2 | ⬜ |
| 028 | [10.028_gjc_chase_computer_use_coordinate_contract.md](./10.028_gjc_chase_computer_use_coordinate_contract.md) | computer_use native | **P1** | 🟡 실측 완료 · 결정 필요 |
| 029 | [10.029_gjc_chase_process_lifecycle_hardening.md](./10.029_gjc_chase_process_lifecycle_hardening.md) | process lifecycle | **P0** | ⬜ |
| 030 | [10.030_gjc_chase_long_session_tui_hardening.md](./10.030_gjc_chase_long_session_tui_hardening.md) | TUI/output long-session | **P1** | ⬜ |
| 031 | [10.031_gjc_chase_provider_auth_reliability.md](./10.031_gjc_chase_provider_auth_reliability.md) | provider/auth | **P1** | ⬜ |
| 032 | [10.032_gjc_chase_subagent_controls.md](./10.032_gjc_chase_subagent_controls.md) | subagent controls | **P1** | ⬜ |
| 033 | [10.033_gjc_chase_web_search_provider_routing.md](./10.033_gjc_chase_web_search_provider_routing.md) | web_search routing | P2 | ⬜ |
| 034 | [10.034_gjc_chase_state_writer_invariants.md](./10.034_gjc_chase_state_writer_invariants.md) | workflow state invariants | **P1** | ⬜ |
| 035 | [10.035_gjc_chase_setup_bridge_optins.md](./10.035_gjc_chase_setup_bridge_optins.md) | setup/bridge opt-ins | P2 | ⬜ |
| 036+ | _(미할당)_ | | | ⬜ |

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
