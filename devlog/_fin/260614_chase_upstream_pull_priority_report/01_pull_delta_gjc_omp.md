# 01 — upstream pull 델타 (gjc dev · omp 참조)

> pull: `git -C devlog/_upstream_gjc pull --ff-only origin dev` · `git -C devlog/_upstream_omp pull --ff-only` (2026-06-14)

## GJC: `75d103f45145` → `269387babcbf` (+68 commits)

릴리즈 앵커: **0.5.0** (`20cac179`), **0.5.1** (`f11618dc`), 이후 Unreleased ~ HEAD.

### A. chase에 이미 있던 카드 — upstream에서 추가로 **구체화·랜딩**된 것

| chase | upstream (0.5.0–0.5.1+) | jwc 메모 |
|-------|-------------------------|----------|
| [10.004](../../../struct_har/chase/10.004_gjc_chase_session_compaction.md) | pre-send estimated context + canonical prune persistence (CHANGELOG 0.5.0 Fixed) | `_fin/10.015` 랜딩(260613)과 겹침 — **잔여 HARD-EDIT**는 3-way 재실측 |
| [10.007](../../../struct_har/chase/10.007_gjc_chase_team_profile_self_heal.md) | `@gjc-profile` self-heal when `GJC_TMUX_LAUNCHED=1` (0.5.0) | rebrand → `jwc team` / tmux env |
| [10.008](../../../struct_har/chase/10.008_gjc_chase_rpc_lifecycle.md) | malformed JSONL recovery, EOF flush, slim `get_state` (0.5.0); **0.5.1** registry + UDS `--listen` + fast-lane abort + unattended negotiate | headless/orchestrate **대부분 upstream 선행** — jwc **diff 잔여**만 카드 유지 |
| [10.011](../../../struct_har/chase/10.011_gjc_chase_receipt_spool.md) | receipt spool at `75d103f` (이미 reviewed) | owner/storage clean 실측 유효; **10.008 묶음** |
| model-profiles UX | `137f9f78` preset-first `/model`, 25 profiles (0.5.0) | chase: 사용자 패치 중 — 카드 없음 |

### B. `75d103f` 이후 **신규** (chase 카드 신설 후보 `10.018+`)

| ID | upstream fact | 영역 | 비고 |
|----|---------------|------|------|
| **10.018** | RPC session registry + persistent UDS server (#589, 0.5.1) | RPC | `issues/09`·`10` 해소 upstream; jwc rpc-mode diff |
| **10.019** | `gjc gc` + `file-lock-gc` + harness `gc-adapter` (#588, #618) | harness/storage | TOCTOU guard; workflow 관측·청소 |
| **10.020** | deep-interview state + recorder + ambiguity scoring (#587, #590, #609) | 040 | jaw-interview **의미론만** 참조 — SKILL/ralplan 체리픽 금지 ([003](../../../struct_har/chase/003_reference_from_gjc.md)) |
| **10.021** | ultragoal red-team verification + review mode (#610) | 060 | `goal` 엔진·가드 — [10.012 goal steering](../../../struct_har/chase/10.012_gjc_chase_goal_steering.md)와 동레인 |
| **10.022** | goal continuation `AgentBusyError` loop fix (#616, Unreleased) | 060/session | interactive goal-mode; jwc 동일 클래스 점검 |
| **10.023** | task notification vs context maintenance race (#570, 0.5.1) | session/task | compaction 전 알림 폭주 |
| **10.024** | coordinator MCP event watch + Hermes snapshot (#572, #568) | extensibility | bot/remote steering 참조 |
| **10.025** | perf corpus + session-memory bench + geobench docs (#584) | 횡단 | 참조·게이트만 |
| **10.026** | `issues/01`–`13` RPC/unattended/command-dispatch 감사 메모 | RPC/docs | 구현 전 설계 입력; [10.008](../../../struct_har/chase/10.008_gjc_chase_rpc_lifecycle.md) 보강 |

기타 HEAD 근처: `dev:link`/`dev:doctor` (#611), history project-scope (#604), Grok Build bundle (#596), model-registry display inherit (#617), TUI input latency (#593), Termius IME (#573).

### C. GJC CHANGELOG 구간 요약 (빠른 색인)

- **0.5.0**: tool_choice fallback, model profiles rebuild, resident text cache / serialization perf, RPC get_state slim, tmux profile boundary, pre-send context maintenance, team self-heal, harness/RPC hardening (일부 10.010과 중복).
- **0.5.1**: RPC registry + UDS persistent server, RPC control-plane (serial chain + fast lane), subagent timer freeze, coordinator polling, task-notification/context maintenance, expanded coordinator status.
- **Unreleased**: goal `AgentBusyError` loop (#616).

---

## OMP: `db421bb2ef68` → `7e8122000ad9` (+370 commits, 15.12.3 → **15.13.0**)

**1:1 이식 아님** — [004_reference_from_omp](../../../struct_har/chase/004_reference_from_omp.md). jwc는 **설계·선별**만.

### D. OMP 델타 — chase G2 맵에 해당하는 묶음

| chase / 밴드 | OMP에서 쌓인 것 (요약) |
|--------------|------------------------|
| [20.005](../../../struct_har/chase/20.005_omp_chase_steering_delivery.md) | queued steer, AgentBusyError on plan/goal/loop, compaction cancel restore, loader recovery on interrupt |
| [20.006](../../../struct_har/chase/20.006_omp_chase_tui_input_micro_fixes.md) | Esc compaction/handoff, large-paste collapse, ctrl+j newline, editor height clamp, loop watchdog |
| [20.003](../../../struct_har/chase/20.003_omp_chase_memory_skills.md) | auto-learn + managed skills, mnemopi embedding variant / recall ranking |
| 083 / session | session-manager **모듈 분해** (`session-context`, `session-listing`, `session-loader`, …), compaction UI lifecycle, snapcompact savings journal, usage row |
| 080 TUI | streaming scrollback fix, resize defer, viewport tail, overlay scroll |
| task | role specialization, spawn advisory, IRC roster activity, tool render memoization |
| STT/TTS | asr-worker / tts-worker 로컬 파이프라인 대규모 |
| browser | cmux tab tooling |
| ai/catalog | openai wire streaming, auth sqlite busy, catalog limit fallback, vLLM/context_length discovery |
| CLI | `omp models`, unknown-flag reject, guided-goal interview, token command |

### E. OMP — jwc **비채택** 유지

collab room secrets, brew formula, catalog 패키지 전체 이식, workerHost 문서만 있는 isolation PAL — [002 G2](../../../struct_har/chase/002_gap_inventory.md).

---

## struct_har 재생성 (선택)

upstream HEAD 갱신 후:

```bash
bun struct_har/_scripts/struct-har-regenerate.ts
bun struct_har/_scripts/struct-har-regenerate-logic.ts
bun struct_har/_scripts/struct-har-regenerate-omp.ts
```

`gjc_origin` / `omp_origin` code facts는 재생성 시 반영; 본 보고서는 **CHANGELOG + commit log** 기준 스냅샷이다.