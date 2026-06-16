# chase — 따라갈 내용 인덱스 (실행 순)

> **부채 스택**: [devlog 02_debt_priority_stack](../../devlog/_plan/260614_chase_upstream_pull_priority_report/02_debt_priority_stack.md)  
> **pull 델타**: [devlog 01_pull_delta](../../devlog/_plan/260614_chase_upstream_pull_priority_report/01_pull_delta_gjc_omp.md)  
> **명명 (필수)**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — `jwc` · **`python/jwc-rpc`** · `.jwc`  
> **RPC 묶음 실현성**: [03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_plan/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)  
> 업데이트: **2026-06-14** (executor v2 · chase refresh)
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
| 9 | 011 | [10.011 receipt spool](./10.011_gjc_chase_receipt_spool.md) | P1 | 🟡 코어 landed |
| 10 | 008 | [10.008 RPC lifecycle](./10.008_gjc_chase_rpc_lifecycle.md) | P1 | 🟡 partial |
| 10b | 018 | [10.018 RPC registry/UDS](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) | P1 | ✅ _fin · TS+Py · UDS P2 |
| 10c | 026 | [10.026 issues audit](./_fin/10/10.026_gjc_chase_rpc_issues_audit.md) | P2 | ✅ _fin · residual rows documented |
| 11 | 022 | [10.022 goal busy-loop](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) | P1 | ✅ _fin · busy guard |
| 12 | 004 | [10.004 session compaction](./_fin/10/10.004_gjc_chase_session_compaction.md) | P1 | ✅ _fin · JWC-ahead progress |
| 13 | 007 | [10.007 team profile](./10.007_gjc_chase_team_profile_self_heal.md) | P1 | ⬜ self-heal |
| 14–15 | 002–003 | [10.002](./10.002_gjc_chase_ai_auth.md) · [10.003](./10.003_gjc_chase_cursor.md) | P1 | ⬜ |
| 16–17 | 012-steer · 021 | [10.012](./10.012_gjc_chase_goal_steering.md) · [10.021](./10.021_gjc_chase_goal_redteam_review.md) | P2 | ⬜ |
| 18 | 019 | [10.019 gc](./10.019_gjc_chase_gc_file_lock.md) | P2 | ⬜ |
| 19 | 023 | [10.023 task notifications](./10.023_gjc_chase_task_notification_context.md) | P2 | ⬜ |
| — | 005–006 · 020 · 024–025 | 나머지 활성 카드 | P2–3 | ⬜ |

### RPC PABCD 묶음 (한 사이클 권장)

```
011 (spool 잔여 테스트) → 008 (rpc-mode durability) → 018 (TS registry + jwc_rpc list_sessions) → 026 (issues 매트릭스 클로즈)
```

- **Python**: `python/jwc-rpc` — upstream `gjc_rpc` diff 참조만 ([008](./008_gjc_jwc_naming_contract.md)).
- **완료 기준**: [03](./../../devlog/_plan/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md) Phase 1 / 1b.

## G2 — omp 카드 (Tier 3)

| 순 | NNN | 문서 |
|---|-----|------|
| 23 | 20.006 | [20.006 TUI micro](./20.006_omp_chase_tui_input_micro_fixes.md) |
| 24 | 20.005 | [20.005 steering](./20.005_omp_chase_steering_delivery.md) |
| 25 | 20.003 | [20.003 memory/skills](./20.003_omp_chase_memory_skills.md) |
| 26 | 20.007 | [20.007 session modules](./20.007_omp_chase_session_modularization.md) |
| — | 20.008 | [20.008 15.13 delta](./20.008_omp_chase_pull_15_13_delta.md) |

## 완료 (_fin)

| NNN | [_fin/10](./_fin/INDEX.md) |
|-----|---------------------------|
| 009–017 | pi-shell, submit, perf×3, context, tool_choice, Fable N/A |