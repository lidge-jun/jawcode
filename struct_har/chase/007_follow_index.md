# chase — 따라갈 내용 인덱스 (실행 순)

> **부채 스택**: [devlog 02_debt_priority_stack](../../devlog/_fin/260614_chase_upstream_pull_priority_report/02_debt_priority_stack.md)
> **pull 델타**: [devlog 01_pull_delta](../../devlog/_fin/260614_chase_upstream_pull_priority_report/01_pull_delta_gjc_omp.md)
> **명명 (필수)**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — `jwc` · **`python/jwc-rpc`** · `.jwc`  
> **RPC 묶음 실현성**: [03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)
> 업데이트: **2026-06-16** (gjc `5ed80862` · omp `dc14689fc` chase refresh)
> **PABCD devlog**: [260614_chase_rpc_harness_bundle](../../devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md)

## G3 — jwc 자체 (Tier 1)

| 순 | 항목 | 문서 |
|---|------|------|
| 1 | 99.02 CI/schemas 마감 | [006](./006_jwc_own_backlog.md) · [50_status](../../structure/50_status.md) |
| 2 | 99.04 HUD | [006](./006_jwc_own_backlog.md) |
| 3 | ctrl+t full transcript | [devlog 260614_tui](../../devlog/_plan/260614_tui_codex_live_toggle/10_pabcd_ctrl_t_full_transcript_p_plan.md) |
| 4 | jaw-interview markdown WIP | [devlog 260614_jaw_interview](../../devlog/_plan/260614_jaw_interview_markdown_mode/) |

## G1 — gjc 카드 (Tier 2)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| 5 | 029 | [10.029 process lifecycle](./_fin/10/10.029_gjc_chase_process_lifecycle_hardening.md) | **P0** | ✅ _fin · lifecycle hardening |
| 6 | 028 | [10.028 computer_use native](./10.028_gjc_chase_computer_use_coordinate_contract.md) | **P1** | 🟡 JWC lazy proxy vs GJC native diff measured |
| 7 | 031 | [10.031 provider/auth](./10.031_gjc_chase_provider_auth_reliability.md) | **P1** | ⬜ |
| 8 | 032 | [10.032 subagent controls](./10.032_gjc_chase_subagent_controls.md) | **P1** | ⬜ |
| 8b | 034 | [10.034 workflow state invariants](./10.034_gjc_chase_state_writer_invariants.md) | **P1** | ⬜ semantics-only |
| 8c | 030 | [10.030 long-session TUI/output](./10.030_gjc_chase_long_session_tui_hardening.md) | **P1** | ⬜ protected UI |
| 9 | 011 | [10.011 receipt spool](./_fin/10/10.011_gjc_chase_receipt_spool.md) | P1 | ✅ _fin · receipt spool |
| 10 | 008 | [10.008 RPC lifecycle](./_fin/10/10.008_gjc_chase_rpc_lifecycle.md) | P1 | ✅ _fin · stdio Phase 1 |
| 10b | 018 | [10.018 RPC registry/UDS](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | P1 | ✅ _fin · TS+Py · UDS P2 |
| 10c | 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | P2 | ✅ _fin · residual rows documented |
| 11 | 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | P1 | ✅ _fin · busy guard |
| 12 | 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | P1 | ✅ _fin · JWC-ahead progress |
| 13 | 007 | [10.007 team profile](./10.007_gjc_chase_team_profile_self_heal.md) | P1 | ⬜ self-heal |
| 14–15 | 002–003 | [10.002](./10.002_gjc_chase_ai_auth.md) · [10.003](./10.003_gjc_chase_cursor.md) | P1 | ⬜ |
| 16–17 | 012-steer · 021 | [10.012](./10.012_gjc_chase_goal_steering.md) · [10.021](./10.021_gjc_chase_goal_redteam_review.md) | P2 | ⬜ |
| 18 | 019 | [10.019 gc](./10.019_gjc_chase_gc_file_lock.md) | P2 | ⬜ |
| 19 | 023 | [10.023 task notifications](./10.023_gjc_chase_task_notification_context.md) | P2 | ⬜ |
| — | 005–006 · 020 · 024–025 · 027 · 033 · 035 | 나머지 활성 카드 | P2–3 | ⬜ |

### RPC PABCD 묶음 (한 사이클 권장)

```
011 (spool 잔여 테스트) → 008 (rpc-mode durability) → 018 (TS registry + jwc_rpc list_sessions) → 026 (issues 매트릭스 클로즈)
```

- **Python**: `python/jwc-rpc` — upstream `gjc_rpc` diff 참조만 ([008](./008_gjc_jwc_naming_contract.md)).
- **완료 기준**: [03](./../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md) Phase 1 / 1b.

## G2 — omp 카드 (Tier 3)

| 순 | NNN | 문서 | P | 상태 |
|---|-----|------|---|------|
| 20 | 20.011 | [20.011 tool dialect](./20.011_omp_chase_tool_dialect.md) | **P1** | ⬜ |
| 21 | 20.012 | [20.012 AI schema/stream](./20.012_omp_chase_ai_tool_schema_streaming.md) | **P1** | ⬜ |
| 22 | 20.005 | [20.005 steering](./20.005_omp_chase_steering_delivery.md) | P1 | ⬜ update with interruptible polling |
| 23 | 20.006 | [20.006 TUI micro](./20.006_omp_chase_tui_input_micro_fixes.md) | P2 | ⬜ |
| 24 | 20.015 | [20.015 terminal resilience](./20.015_omp_chase_terminal_resilience.md) | P2 | ⬜ |
| 25 | 20.009 | [20.009 profiles/auth isolation](./20.009_omp_chase_profiles_aliases.md) | P2 | ⬜ |
| 26 | 20.010 | [20.010 advisor/WATCHDOG](./_fin/20/20.010_omp_chase_advisor_review_lane.md) | P2 | ✅ _fin · 비채택/reference-only |
| 27 | 20.013 | [20.013 task coordination](./20.013_omp_chase_task_coordination.md) | P2 | ⬜ |
| 28 | 20.017 | [20.017 unexpected-stop](./20.017_omp_chase_unexpected_stop_detection.md) | P2 | ⬜ |
| 29 | 20.003 | [20.003 memory/skills](./_fin/20/20.003_omp_chase_memory_skills.md) | P2 | ✅ _fin · 99.01 absorbed |
| 30 | 20.007 | [20.007 session modules](./20.007_omp_chase_session_modularization.md) | P2 | ⬜ |
| 31 | 20.014 | [20.014 extensions](./_fin/20/20.014_omp_chase_extensions_plugins.md) | P3 | ✅ _fin · partial adopt/watch closed |
| — | 20.008 | [20.008 15.13 delta](./20.008_omp_chase_pull_15_13_delta.md) | — | 🟡 index |

## 완료 (_fin)

| NNN | 내용 | 상태 |
|-----|------|------|
| 009–017 | pi-shell, submit, perf×3, context, tool_choice, Fable N/A | ✅ |
| 20.003 | [20.003 memory/skills](./_fin/20/20.003_omp_chase_memory_skills.md) | ✅ reference-only — 99.01 memory/chat absorbed |
| 20.010 | [20.010 advisor/WATCHDOG](./_fin/20/20.010_omp_chase_advisor_review_lane.md) | ✅ 비채택 — PABCD/goal reviewer lanes |
| 20.014 | [20.014 extensions/plugins](./_fin/20/20.014_omp_chase_extensions_plugins.md) | ✅ 부분 채택 — JWC plugin boundary |
| 20.016 | [20.016 review PR URL](./_fin/20/20.016_omp_chase_review_pr_url.md) | ✅ 비채택 — GitHub skill route |
