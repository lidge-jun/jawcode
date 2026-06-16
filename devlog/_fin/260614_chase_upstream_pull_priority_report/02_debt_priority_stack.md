# 02 — 부채 우선순위 스택 (통합)

> **목적**: 지금 쌓인 부채를 **한 줄기 실행 순서**로 정렬한다.  
> 축: **G3** jwc 자체(99·제품) → **G1** gjc 따라잡기 → **G2** omp 참조 → **로컬 WIP** · **인프라**.  
> **RPC 명명**: [008 naming](../../../struct_har/chase/008_gjc_jwc_naming_contract.md) · **`python/jwc-rpc`**

**구현가치** 열은 [002_gap_inventory](../../../struct_har/chase/002_gap_inventory.md) MLB 20–80과 동일 척도.  
**P** = chase 카드 P0–P3 / [006](../../../struct_har/chase/006_jwc_own_backlog.md) CRITICAL.

---

## Tier 0 — 운영·정본 (코드 없음, 막히면 전부 헛돔)

| 순 | 항목 | 산출 | 정본 |
|---|------|------|------|
| 0.1 | chase 사이클 완료 | MOC `reviewed through` = 클론 HEAD | [10.001](../../../struct_har/chase/10.001_gjc_chase_cycle.md) · [20.001](../../../struct_har/chase/20.001_omp_chase_cycle.md) |
| 0.2 | 본 pull 보고 | 델타 + priority stack | [01](./01_pull_delta_gjc_omp.md) · 본 문서 · [03](./03_rpc_bundle_feasibility_jwc_rpc.md) |
| 0.3 | struct_har (선택) | gjc/omp origin facts | `struct_har/_scripts/*` |

---

## Tier 1 — G3 jwc 자체 (제품·게이트·MLB 드라이버)

[006_jwc_own_backlog](../../../struct_har/chase/006_jwc_own_backlog.md) · [50_status](../../../structure/50_status.md) 착수 순서.

| 우선 | ID | 부채 | P | MLB | 상태 | 비고 |
|:---:|---|------|---|:---:|------|------|
| **1** | **99.02** | `check:schemas` + biome + docs CI 마감 | CRITICAL | — | 코드 ✅ / **마감 ⬜** | MLB **62** 임계(99.02+99.03); 원격 CI는 160+ |
| **2** | **99.04** | HUD `.jwc` 정정 + TUI `/goal` 별칭·세그먼트 | HIGH | — | 설계 ✅ / 구현 ⬜ | 080·060 밴드 |
| **3** | **99.05** | auth 릴리즈 게이트 | MED | — | ⬜ | 090; G1 [10.002](../../../struct_har/chase/10.002_gjc_chase_ai_auth.md)와 동레인 |
| **4** | **99.06** | 문서 stale 스윕 | MED | — | ⬜ | structure + README |
| **5** | **99.07** | 슬래시 패리티 잔여 | MED | — | U1/U2 ✅ / 패리티 ⬜ | reset·cancel 완료 |
| **6** | **TUI ctrl+t** | full transcript overlay PABCD | HIGH | — | 계획 ✅ / 구현 ⬜ | [260614_tui](../../../devlog/_plan/260614_tui_codex_live_toggle/10_pabcd_ctrl_t_full_transcript_p_plan.md); goal G001 |
| **7** | **jaw-interview** | markdown mode / mutation guard WIP | MED | — | 🟡 worktree | `devlog/_plan/260614_jaw_interview_markdown_mode/` |
| **8** | **160–310** | cli-jaw merge · UI selector · code mode | LONG | — | 로드맵 | [distribution MOC](../../../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md) |

**Tier 1 원칙**: 사용자-facing 버그·goal/TUI·99.02 마감이 **G1 대량 cherry-pick**보다 먼저 unless P0 incident (RPC down 등).

---

## Tier 2 — G1 gjc 따라잡기 (선별 병합)

활성 카드 + [01](./01_pull_delta_gjc_omp.md). **완료**는 [_fin/10](../../../struct_har/chase/_fin/INDEX.md) (009–017).

| 우선 | NNN / slug | 부채 | P | MLB | 비용 | 분류 |
|:---:|------------|------|---|:---:|------|------|
| **9** | **10.011** | receipt spool exporter | P1 | 60 | 소~중 | **🟡** 코어 landed; tests·`_fin` |
| **10** | **10.008** | RPC lifecycle | P1 | 60 | 중 | **🟡** `get_state` landed; rpc-mode durability open |
| **10a** | **10.018** | RPC registry + UDS + **`jwc_rpc`** | P1 | 60 | 중~대 | [008](../../../struct_har/chase/008_gjc_jwc_naming_contract.md) |
| **10b** | **10.026** | RPC issues 01–13 매트릭스 | P2 | 50 | 소 | [03](./03_rpc_bundle_feasibility_jwc_rpc.md) |
| **11** | **10.022** | goal `AgentBusyError` (#616) | P1 | 55 | 소 | 신규 |
| **12** | **10.004** | session compaction HARD-EDIT | P1 | 65 | **대** | 083 충돌 |
| **13** | **10.007** | team `@gjc-profile` self-heal | P1 | 55 | 중 | `team` 표면 안정 후 |
| **14** | **10.002** | ai·auth drift | P1 | 60 | 중 | 99.05와 묶음 |
| **15** | **10.003** | cursor / provider | P1 | 60 | 중 | kiro 분기 유지 |
| **16** | **10.012-steer** | goal steering | P2 | 50 | 중 | #610 동레인 |
| **17** | **10.021** | goal red-team (#610) | P2 | 50 | 중 | 10.012-steer 이후 |
| **18** | **10.019** | `jwc gc` / file-lock GC | P2 | 45 | 중 | harness 청소 |
| **19** | **10.005** | task/subagent | P2 | 50 | 중 | jaw 가드 반전 |
| **20** | **10.013-cache** | assistant cache | P3 | 40 | 소 | perf |
| **21** | **10.006** | upstream TUI core | P3 | 45 | 중 | 99.04 선행 |
| **22** | **10.020·023–025** | interview·coordinator·perf ref | P3 | 30–50 | — | [007](../../../struct_har/chase/007_follow_index.md) |

**Tier 2 원칙**: **10.011 → 10.008 → 10.018 → 10.026** (RPC 묶음, [03](./03_rpc_bundle_feasibility_jwc_rpc.md), **`python/jwc-rpc`**) → **10.022** → **10.004** (전용 PABCD).

---

## Tier 3 — G2 omp 참조 (설계·선별, 이식 아님)

[20_omp_chase_MOC](../../../struct_har/chase/20_omp_chase_MOC.md) · OMP +370 커밋 반영.

| 우선 | NNN | 부채 | MLB | jwc 착수 조건 |
|:---:|-----|------|:---:|---------------|
| **23** | **20.006** | TUI Esc·ast status micro | 50 | **99.20** / 082 |
| **24** | **20.005** | steering delivery · queue drain | 60 | G1 #616과 겹침 — **한 PABCD** |
| **25** | **20.003** | memory·auto-learn | 55 | 99.01 이후 |
| **26** | **20.007** | session modules | — | 참조만 |
| **27** | **20.004** | LSP/DAP | 45 | 보류 |
| **28** | **20.002** | worker/catalog | 45 | 100 완료 후 M2 |
| — | **20.008** | 15.13 delta index | — | [20.008](../../../struct_har/chase/20.008_omp_chase_pull_15_13_delta.md) |

---

## Tier 4 — 백로그·비채택

| 항목 | 처리 |
|------|------|
| model-profiles UX (gjc `a12a751`) | 사용자 worktree 패치 — chase 카드 없음 |
| omp collab/brew | 비채택 |
| gjc deep-interview / ralplan / ultragoal **upstream SKILL** | orchestrate/jaw-interview/goal **번역만** ([003](../../../struct_har/chase/003_reference_from_gjc.md) γ) |
| Fable profile 제거 (gjc) | [10.017 NA](../../../struct_har/chase/_fin/10/10.017_gjc_retired_fable_na.md) |

---

## 한 페이지 요약 (보스용)

```
0  chase HEAD·문서 동기화 (260614 + 008 jwc-rpc)
1  99.02 마감 → MLB 62 게이트
2  99.04 HUD + ctrl+t full transcript (제품)
3  10.011 → 10.008 → 10.018 → 10.026 (RPC; jwc-rpc 정본)
4  10.022 goal busy-loop + 20.005/20.006
5  10.004 session HARD-EDIT (전용 사이클)
6  99.05–07 + 10.002/003/007 + goal steering
7  omp session/autolearn/STT 참조 (선별)
8  160+ cli-jaw / 인프라
```

---

## 갱신 규칙

- upstream pull마다: [01](./01_pull_delta_gjc_omp.md) 갱신 또는 신규 `260614_*` 폴더 누적
- 카드 완료: `_fin/10|20/` + [002](../../../struct_har/chase/002_gap_inventory.md) 표
- jwc MLB/readiness: [50_status](../../../structure/50_status.md) · [006](../../../struct_har/chase/006_jwc_own_backlog.md)