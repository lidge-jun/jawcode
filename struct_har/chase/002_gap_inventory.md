# chase — 갭 인벤토리 (횡단)

> 스냅샷: gjc **`5ed80862`** · jwc **`d60b7822`** (worktree) · omp **`dc14689fc`** (2026-06-16 **6차 — pull + chase 카드 10.027–035 / 20.009–017**).
> **reviewed through**: GJC `5ed80862` · OMP `dc14689fc` · JWC `d60b7822`
> **명명**: [008_gjc_jwc_naming_contract.md](./008_gjc_jwc_naming_contract.md) — Python **`python/jwc-rpc`** (`jwc_rpc`); upstream만 `gjc-rpc`.
> **RPC 실현성**: [devlog 03_rpc_bundle_feasibility_jwc_rpc](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md)
> 상태: `⬜` 미착수 · `🟡` 설계/부분 · `✅` jwc 선행 · `—` 해당 없음
> **기록**: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · [20_omp_chase_MOC](./20_omp_chase_MOC.md) (`10.NNN_*` / `20.NNN_*`)

## 요약

| 축 | jwc가 **앞서거나 유일** | jwc가 **뒤처지거나 약함** |
|---|---|---|
| **gjc** | orchestrate/PABCD, jaw 표면, `.jwc`, lazy `computer_use`, pi-shell·submit gate(10.009·10.010 ✅), goal busy-loop #616 ✅, session compaction/progress ✅ | RPC lifecycle 잔여(008), team profile self-heal(007), **process lifecycle P0(10.029)**, computer_use native coordinate/supervisor(10.028 🟡), provider/auth(10.031), subagent controls(10.032), RLM/검색/setup bridge(10.027·033·035) |
| **omp** | 4 workflow 번들, jaw 워크플로 | task-agent, session ops, memory, pruning = **참조** ([20.008](./20.008_omp_chase_pull_15_13_delta.md)); **16.0.2 reference** profiles/advisor/dialect/schema/task/plugins/terminal/review/retry ([20.009](./20.009_omp_chase_profiles_aliases.md)–[20.017](./20.017_omp_chase_unexpected_stop_detection.md)) |
| **자체** | 100 Node 완료, TUI O(n²) 수정, 99.03·99.01·99.07 부분 | 99.02·99.04·99.05·99.06 · M2 110+ |

## 밴드별

| 밴드 | G1 gjc | G2 omp | G3 jwc | 참조 카드 |
|---|---|---|---|---|
| 010_shell | 🟡 bin/퍼블리시 | — | ✅ jwc only | [bands/README.md](./bands/README.md) |
| 020_prompt | 🟡 upstream drift | 🟡 ttsr/docs | ✅ **99.03 M1–M3** | [bands/README.md](./bands/README.md) |
| 030_skills | 🟡 team profile guard | 🟡 skills 3계층 | 🟡 D5 cli-jaw | [bands/README.md](./bands/README.md) |
| 040_interview | 🟡 deep-interview | — | ✅ jaw-interview | [bands/README.md](./bands/README.md) |
| 050_plan | 🟡 ralplan upstream | — | ✅ orchestrate | [bands/README.md](./bands/README.md) |
| 060_goal | ✅ busy-loop #616 | — | ✅ goal · 🟡 steering | [10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| 070_memory | 🟡 hooks | 🟡 mnemopi | ✅ **99.01** | [bands/README.md](./bands/README.md) |
| 080_tui | 🟡 fixes | 🟡 micro | 🟡 **99.04** HUD | [bands/README.md](./bands/README.md) |
| 081_cursor | 🟡 **높음** | 🟡 IDE | 🟡 kiro | [bands/README.md](./bands/README.md) |
| 082_input | 🟡 | — | ✅ IME | [bands/README.md](./bands/README.md) |
| 083_output | 🟡 compaction | 🟡 pruning | ✅ segment·collapse | [bands/README.md](./bands/README.md) |
| 090_auth | 🟡 oauth | 🟡 | 🟡 99.05 | [bands/README.md](./bands/README.md) |
| 099 | — | — | 🟡 99.02·04·05·06 ⬜ | [../jwc_patched/099_stabilization/](../jwc_patched/099_stabilization/) |
| 100_node | 🟡 runtime | 🟡 workerHost | ✅ 완료 | [bands/README.md](./bands/README.md) |

## G1 — gjc에서 흔히 뒤쳐지는 항목

| 영역 | upstream 후보 | jaw 병합 난이도 | 참조 |
|---|---|---|---|
| 세션/autocompact | pre-send `#checkEstimatedContextBeforePrompt` | ✅ pre-send + threshold prune persistence + progress UX | [_fin/10.004](./_fin/10/10.004_gjc_chase_session_compaction.md) |
| RPC lifecycle | malformed JSONL; EOF flush; bridges | **🟡** fast-lane reads ✅; durability diff ⬜ | [10.008](./10.008_gjc_chase_rpc_lifecycle.md) |
| RPC registry/UDS | #589 registry, `--listen` | ✅ TS+`jwc_rpc.list_sessions` + UDS Phase 2 | [10.018](./_fin/10/10.018_gjc_chase_rpc_registry_uds.md) |
| receipt spool | #554 JSONL exporter | **🟡** core ✅; tests/`_fin` ⬜ | [10.011](./10.011_gjc_chase_receipt_spool.md) |
| goal busy-loop | #616 AgentBusyError | ✅ landed 260615 | [_fin/10.022](./_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md) |
| team self-heal | #546 `@gjc-profile` | 중 | [10.007](./10.007_gjc_chase_team_profile_self_heal.md) |
| pi-shell / harness submit | #551 / #549 | ✅ landed 260613 | [_fin/10](./_fin/INDEX.md) |
| model-profiles UX | #553 | 사용자 패치 중 — 카드 없음 | [10.001](./10.001_gjc_chase_cycle.md) |
| providers/schemas | drift | ai diff; **99.02** | `packages/ai/` |
| RLM research | opt-in research notebook/report lane | 중 — public surface decision | [10.027](./10.027_gjc_chase_rlm_research_mode.md) |
| computer_use native | coordinate contract + Rust/tool integration | 중상 — JWC lazy CUA proxy 보유, native coordinate/supervisor 미보유 | [10.028](./10.028_gjc_chase_computer_use_coordinate_contract.md) |
| process lifecycle | owned process/resource cleanup | 높음 — P0 safety bundle | [10.029](./10.029_gjc_chase_process_lifecycle_hardening.md) |
| TUI/output long-session | render lifecycle + output caps | 중 — visual/scroll guards | [10.030](./10.030_gjc_chase_long_session_tui_hardening.md) |
| provider/auth reliability | credential ranking + Codex WS recovery | 중상 — [10.002](./10.002_gjc_chase_ai_auth.md) fold | [10.031](./10.031_gjc_chase_provider_auth_reliability.md) |
| subagent controls | serviceTier + resume durability | 중 — [10.005](./10.005_gjc_chase_task_subagent.md) fold | [10.032](./10.032_gjc_chase_subagent_controls.md) |
| web_search routing | model-provider search fallback | 중 — search policy reconcile | [10.033](./10.033_gjc_chase_web_search_provider_routing.md) |
| workflow state | state-writer invariants | 중상 — JWC semantics-only | [10.034](./10.034_gjc_chase_state_writer_invariants.md) |
| setup/bridge | credential import + bridge opt-in | 중 — onboarding/security split | [10.035](./10.035_gjc_chase_setup_bridge_optins.md) |

### RPC 한 묶음 (PABCD 권장)

**011 → 008 → 018 → 026** — [007_follow_index](./007_follow_index.md) · [03 feasibility](../../devlog/_fin/260614_chase_upstream_pull_priority_report/03_rpc_bundle_feasibility_jwc_rpc.md).
Executor v2 (260614): **011 YES**, **008/026 RISKY**; **018 registry TS+Py landed** @ `d60b7822`; UDS `--listen` + issues 06–08 client API **갭**.

## G2 — omp 참조만

| 영역 | omp | jaw 방향 |
|---|---|---|
| 15.13 delta | session split, auto-learn, STT | [20.008](./20.008_omp_chase_pull_15_13_delta.md) |
| steering delivery | yield re-poll, stranded drain | [20.005](./20.005_omp_chase_steering_delivery.md) |
| TUI micro | Esc draft, ast status | [20.006](./20.006_omp_chase_tui_input_micro_fixes.md) |
| session modules | listing/loader | [20.007](./20.007_omp_chase_session_modularization.md) |
| memory/skills | mnemopi | [20.003](./20.003_omp_chase_memory_skills.md) |
| profiles/auth isolation | `--profile`, profile-scoped config/OAuth | [20.009](./20.009_omp_chase_profiles_aliases.md) |
| advisor/WATCHDOG | passive review lane | [20.010](./20.010_omp_chase_advisor_review_lane.md) |
| tool dialects | in-band tool-call conversion | [20.011](./20.011_omp_chase_tool_dialect.md) |
| AI schema/stream hardening | strict schemas + streamed args | [20.012](./20.012_omp_chase_ai_tool_schema_streaming.md) |
| task coordination | roles, IRC, fallback chains | [20.013](./20.013_omp_chase_task_coordination.md) |
| extensions/plugins | discovery/marketplace hardening | [20.014](./20.014_omp_chase_extensions_plugins.md) |
| terminal resilience | keypad/multiplexer/resize/input | [20.015](./20.015_omp_chase_terminal_resilience.md) |
| review PR URLs | remote PR review UX | ✅ [_fin/20.016](./_fin/20/20.016_omp_chase_review_pr_url.md) |
| unexpected-stop retry | classifier + bounded retry | [20.017](./20.017_omp_chase_unexpected_stop_detection.md) |
| collab/brew | — | **비채택** |

## 260613–16 jwc 독자 성과 + chase pull 기록

Codex reformation · TUI O(n²) · xAI `/searchengine` · 100 Node · MCP discovery · 99.xx TUI — [structure/50_status.md](../../structure/50_status.md).  
**260614**: upstream pull +68 gjc / +370 omp; chase 카드 10.018–026 발급; **008 명명 계약**. **260616**: upstream pull gjc `5ed80862` / omp `dc14689fc`; chase 카드 **10.027–035** + **20.009–017** 발급.

## 구현가치 (MLB) — 활성 핵심

| 항목 | 축 | 가치 | 분류 |
|---|---|:---:|---|
| 10.011 spool | gjc | 60 | 🟡 코어 landed |
| 10.008 RPC | gjc | 60 | 🟡 선별 |
| 10.018 registry | gjc | 60 | ✅ _fin |
| 10.022 busy-loop | gjc | 55 | ✅ _fin |
| 10.004 session compaction | gjc | 60 | ✅ _fin |
| 10.026 issues | gjc | 50 | 설계 |
| 10.002·003 | gjc | 60 | 선별 |
| 20.005 steering | omp | 60 | 참조 |
| 10.029 lifecycle | gjc | 80 | **P0 안전** |
| 10.028 computer_use | gjc | 65 | 🟡 실측 완료 · native safety 결정 |
| 10.031 provider/auth | gjc | 60 | 선별 |
| 10.032 subagent controls | gjc | 55 | 선별 |
| 20.011 dialect | omp | 65 | 참조 |
| 20.012 schema/stream | omp | 65 | 참조 |
| 20.015 terminal | omp | 50 | 선별 |
| 20.006 TUI micro | omp | 50 | 선별 |

## 갱신 체크리스트

```bash
git -C devlog/_upstream_gjc pull --ff-only origin dev
git -C devlog/_upstream_omp pull --ff-only origin main
```

→ 본 표 · [bands/](./bands/) · **008 명명** · MOC `reviewed through` · [10.001](./10.001_gjc_chase_cycle.md) changelog 행.
