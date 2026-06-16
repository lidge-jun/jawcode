# 000 — JAWCODE 마스터 로드맵 (전면 재편)

> 2026-06-12 02:57 확정 체계. **000–099 = jwc 만들기 (M1) / 100~ = cli-jaw 런타임 이식 (M2)**.
> 각 데케이드 = 작업 밴드 1개, 밴드 착수 시 해당 번호대에 diff 레벨 플랜 문서를 추가한다.
> 결정 근거: [05_interview_conclusions.md](./05_interview_conclusions.md) D1–D9.
> 구 문서(00–10, 2자리)는 리서치 입력으로 흡수 — 01(gjc 실사), 02(cli-jaw 시임), 03(구 로드맵, 본 문서로 대체), 04(인터뷰 로그), 05(결정 전집), 10(jwc 셸, ✅ 완료 → 010 밴드로 편입).

## M1: 000–098 — jwc 만들기 (jaw 워크플로우 네이티브 CLI) — **✅ 전 밴드 완료 (260613)**

> 000–098 밴드는 전부 완료 처리. **잔여·신규 작업은 99 안정화 밴드로만 수렴한다** (아래 §99).
> 밴드별 잔여 이관처는 상태 열에 표기 — 구 밴드 문서에 새 작업을 추가하지 않는다.

| 밴드 | 이름 | 내용 | 상태 (260613) |
|------|------|------|---------------|
| 000–009 | 리서치·결정 | 인터뷰/실사/결정 전집. 구 00–05 흡수. 업스트림 리베이스 정책 문서화 | ✅ |
| 010–019 | jwc 셸 + 표면 리네이밍 | bin `jwc` 정식화, 브랜딩 jaw화, `gjc` bin 제거 (085.5-M7) | ✅ — `jwc` only bin |
| 020–029 | 프롬프팅 개편 | jaw 아이덴티티 시스템 프롬프트, jaw 프리셋 | ✅ — 워크플로 표면 re-facing 잔여는 → **99.03** |
| 030–039 | 스킬 디스커버리 3계층 | 임베디드 → 프로젝트 → `~/.cli-jaw/skills` (D5) | ✅ — cli-jaw 글로벌 정합 후속은 → 99.03/99.07 |
| 040–049 | 워크플로 병합 ①: Interview | `jaw-interview` 단일 스킬 (D3) | ✅ — 게이지 TUI는 → **99.04.03** |
| 050–059 | 워크플로 병합 ②: Plan + PABCD | orchestrate(IPABCD) 런타임 + 범용 진입 | ✅ — 자연어 discovery는 → **99.03** |
| 060–069 | 워크플로 병합 ③: Goal | goal CLI (set→checkpoint→done) | ✅ — TUI `/goal` 별칭 99.02 랜딩 · goal↔pabcd 합성은 → **99.08** · β goal 별도 트랙 |
| 070–079 | 메모리 통합 | → **99.01로 전체 마이그레이션** | ✅ — 99.01 구현 완료 (693c5ee0…7b93de35) |
| 080–089 | TUI 변경 | jaw 테마, 081/082/083 이슈군 수정, 083.7 컴포저(99.09) | ✅ — HUD는 → **99.04** · 신규 표면은 → **99.20** |
| 090–098 | 인증 시딩 | D7 로컬 토큰 시딩, OAuth 유지 (091 kiro는 [제안] 별도) | ✅ 구현 — **M1 마감 공식 선언만 → 99.12** (G1–G9 증거 기록) |

**M1 done 선언 = [99.12](./99.00.00_moc_stabilization.md) (전 99 패키지 완료 후 최후).** (D2: M1이 M2보다 선행)

## 99 — 안정화·마감 밴드 (M1 잔여 수렴지) — 정본: [99.00.00 MOC](./99.00.00_moc_stabilization.md)

> `99.GG.NN` — GG는 착수 순서 (lexicographic = 실행 순서). 모든 신규 M1 작업은 여기로만.
> 레디니스: 현재 **50** → 99.03 후 **62**(데일리 드라이버 임계점) → 전체 후 **68** ([99.00.01](./99.00.01_audit_jwc_readiness.md)).

| GG | 패키지 | 상태 (260613) |
|----|--------|---------------|
| [99.01](./99.01.00_moc_memory.md) | 메모리 병합 (구 070) | ✅ 구현 완료 |
| [99.02](./99.02.00_plan_parallel_landing.md) | 병렬 랜딩 정리 | ✅ 완료 |
| [99.03](./99.03.00_plan_workflow_surface_revision.md) | pabcd discovery 브리지 + 워크플로 표면 개정 | 설계 확정 + 감사 PASS v2 — **다음 착수** |
| [99.04](./99.04.00_moc_workflow_hud.md) | 워크플로 HUD (구 085) | 설계 ✅ / 구현 진행 (99.04.05 융합 랜딩) |
| 99.05 | auth 릴리즈 게이트 (구 090 마감분) | MOC만 |
| 99.06 | 문서 정합 스윕 | ⬜ |
| [99.07](./99.07.00_issue_reset_goal_verb_parity.md) | 슬래시/CLI 패리티 (+orchestrate reset ✅ 260613) | 조사 ✅ / 저우선 |
| [99.08](./99.08.00_plan_goal_pabcd_fusion.md) | goal↔pabcd 합성 | 방향 확정 — 99.03 후 착수, **우선순위 상** |
| 99.09 | 083.7 하단 고정 컴포저 | ✅ 구현 완료 |
| 99.10 | 083.5 잔여 (thinking 포커스) | ⬜ 저우선 |
| 99.11 | **업스트림 동기화** — ① PR 스택 추적 ② chase 수용 1차 | ② ✅ **구현 완료 (260613)**: [99.11.01](./99.11.01_plan_upstream_pishell_utf8_fixup.md) pi-shell UTF-8 (188 tests green) · [99.11.02](./99.11.02_plan_upstream_harness_submit_gate.md) submit gate (175 tests green) / ① ⬜ 수시 |
| 99.12 | **M1 마감 공식 선언** | ⬜ — 전 패키지 완료 후 최후 |
| [99.20](./99.20.00_moc_frontend_uiux.md) | 프런트 UI/UX 전담 (TUI 신규 표면 수렴지) | 진행 — 99.20.01 ✅·99.20.08 `/help` ✅, 감사 잔여 7건 |
| [99.30](./99.30.00_moc_feature_improvement.md) | 기능 개선 | 99.30.01 설계 ✅ / 구현 ⬜ |

## M2: 100~ — cli-jaw 런타임 이식 (상주 네이티브)

> ⚠️ **착수 전 99 선반영 체크 필수** — 100번대 MOC는 260612 작성이라 99 밴드가 먼저 구현/확정한
> 사항이 반영 안 된 곳이 있다. 착수 시 아래 순서로 대조: ① [99.00.00 §결정](./99.00.00_moc_stabilization.md)
> 7(**Code 모드 선행**: M1 마감 → Code 모드(ACP) → 100/110 통합 → in-process 승격) · 8(임베디드에서
> jwc 메모리 consolidation **비활성 — 주입만**, D112-2) · 11(Claude Desktop 보조 트랙 **드랍**) ·
> 12(sidecar는 **npm 설치 경로 재사용**, --compile 옵션 강등) ② [111 §착수 전 실측 보강](./111_design_runtime_attach.md)
> **M1→M2 드리프트 6항목** (PABCD 정본 충돌·orchestrate 자가 전이 단락·Bun.sleep 잔존 등 — 99.03 랜딩 후 재실측)
> ③ 99.01 메모리 구현 완료 → 130 주입 밴드의 memory 브리지는 **재설계 아닌 기구현 연결**.

| 밴드 | 이름 | 내용 | 완료 기준 (testable) | 99 선반영 |
|------|------|------|---------------------|-----------|
| 100–109 | Node 포팅 베이스라인 | `Bun.*` 셰임 + tsc/esbuild 트랜스파일 (ai/agent/비TUI coding-agent). `bun:sqlite`→better-sqlite3 포함 (D8) | 업스트림 핵심 테스트(stream.test.ts 등)가 Node 22에서 통과 | Bun.sleep 잔존 등 드리프트 재실측 (111 ②) |
| 110–119 | JawRuntime 상주 서비스 | cli-jaw 서버 내 싱글톤: `createAgentSession()` 풀, `spawnAgent` 어댑터(`child:null` 경로), AgentEvent→`core/bus` broadcast | 서버 기동 시 상주, Web UI에서 spawn 없이 대화+도구 실행 (M2 done ①) | **Code 모드(ACP) 선행** (결정 7, [112.1](./112.1_plan_code_mode_acp_prototype.md)) |
| 120–129 | 세션 jaw.db 영속화 | resume = DB 메시지 로드 후 세션 재구성, steer = 살아있는 루프에 push (D6). resume-classifier/세션ID 역추적 소멸 | 서버 재시작 후 이어서 대화 + 실행 중 steer 주입 e2e | steer 전달 보장은 omp 선례 [20.005](../../../../struct_har/chase/20.005_omp_chase_steering_delivery.md) 참조 |
| 130–139 | 스킬·PABCD·인증 주입 (cli-jaw 측) | `~/.cli-jaw/skills` 주입(M2 done ③), PABCD 단계 프롬프트 연결, 토큰 시딩 브리지 공유(M2 done ②) | M2 done 3항목 전부 ✅ | 99.01 memory 기구현 연결 + consolidation 비활성 (결정 8) + PABCD 표면은 99.03 산출물이 정본 |
| 140–149 | federation 검색 어댑터 | gjc `history` 스키마 어댑터로 dashboard chat search에 jwc 세션 노출 (D9, 후순위) | `cli-jaw dashboard chat search`가 jwc 세션 히트 반환 | — |
| 150–159 | 메인 런타임 승격 | 기본 cli=`jwc`, 벤더 CLI는 fallback 체인 강등. 도구 패리티 갭 목록화·충당 | 신규 세션 기본값 jwc, 회귀 스위트 통과 | sidecar = npm 설치 재사용 (결정 12) |

**M2 done = 130–139 완료 시점 (3항목).** 140~150은 승격 전 안정화 밴드.

## 밴드별 MOC (2026-06-12 03:01 전 밴드 작성 완료)

각 밴드의 스코프/기본값/완료 기준/열린 질문은 MOC 문서가 정본.
**표기 규약 (03:09 개정)**: [확정] = 인터뷰 확정 / **[기본값] = repo(업스트림 gjc)의 실제 동작 — 결정 없으면 이대로 간다** / [제안] = repo 기본값에서 벗어나는 변경안, 채택은 인터뷰 결정 필요.

| M1 | M2 |
|----|----|
| [010_moc_shell_rename.md](./010_moc_shell_rename.md) | [100_moc_node_porting.md](./100_moc_node_porting.md) |
| [020_moc_prompting.md](./020_moc_prompting.md) | [110_moc_jawruntime.md](./110_moc_jawruntime.md) |
| [030_moc_skills_discovery.md](./030_moc_skills_discovery.md) | [120_moc_session_jawdb.md](./120_moc_session_jawdb.md) |
| [040_moc_interview_merge.md](./040_moc_interview_merge.md) | [130_moc_injection.md](./130_moc_injection.md) ← **M2 done 지점** |
| [050_moc_plan_pabcd.md](./050_moc_plan_pabcd.md) | [140_moc_federation_adapter.md](./140_moc_federation_adapter.md) |
| [060_moc_goal_merge.md](./060_moc_goal_merge.md) | [150_moc_promotion.md](./150_moc_promotion.md) |
| [99.01.00_moc_memory.md](./99.01.00_moc_memory.md) (구 070) | |
| [080_moc_tui.md](./080_moc_tui.md) | |
| [090_moc_auth_release_gate.md](./090_moc_auth_release_gate.md) ← G1–G9 증거는 **99.12에서 기록** | |
| [**99.00.00_moc_stabilization.md**](./99.00.00_moc_stabilization.md) ← **M1 잔여 전체 + done 선언(99.12)** | |


## Chase (`struct_har/chase/10_` · `20_`)

| MOC (정본) | 플랜 |
|---|---|
| [10_gjc_chase_MOC](../../../../struct_har/chase/10_gjc_chase_MOC.md) | `10.001_`…`10.011_` |
| [20_omp_chase_MOC](../../../../struct_har/chase/20_omp_chase_MOC.md) | `20.001_`…`20.006_` |

완료 → [struct_har/chase/_legacy](../../../../struct_har/chase/_legacy/). [005_numbering](../../../../struct_har/chase/005_devlog_numbering.md). 99와 병렬.
구현가치 등급(MLB 20-80)·채택 분류 정본: [002_gap_inventory §구현가치](../../../../struct_har/chase/002_gap_inventory.md).
chase → 구현 승격은 **99.11** 패키지로 (1차: 10.009→99.11.01 ✅ · 10.010→99.11.02 ✅, 260613).
설계 정본 (밴드 횡단): [051_design_command_port.md](./051_design_command_port.md) — D10 명령 이식 (050/060/070 기반) ·
[111_design_runtime_attach.md](./111_design_runtime_attach.md) — M2 런타임 부착 통합 설계 (100–130 기반)

밴드 내 이슈/서브플랜 (260612 06–09시) — **번호는 소속 분류일 뿐, 밴드 순서와 무관하게 선착수 가능**.
버그가 많은 군은 하위번호(081.n)로 묶음:
[081](./081_moc_cursor_tools.md) **cursor 도구군** (MOC/정본) — 081.1 미표시·081.2 타이틀환각·081.3 실행 unbound this·081.4 Glob —
**✅ 4건 수정·e2e 검증 완료** (080 밴드 발현, hotfix 트랙; 업스트림 PR #515 dev 대상 리뷰 대기).
081.5 감사·081.6 host-override(✅)·081.7 자동 compact 미발동(✅ estimate 폴백 수정) ·
[082](./082_moc_tui_input.md) **TUI 입력/IME 이슈군** — 082.1 Ctrl/종료(ESC 2연타 안전망)·082.2 첫 글자 캐럿 점프 — ✅ 수정 완료 ·
[083](./083_moc_tui_output.md) **TUI 출력 접기/노이즈** — 083.1 도구 자동 접힘(✅ minimize + ctrl+↑ 포커스 + alt+t 전체 오버레이)·083.2 도구 간 공백(✅ 1줄)·083.3 추론 인터리빙(✅ 세그먼트 분할) ·
[091](./091_plan_provider_kiro.md) — kiro 프로바이더 [제안] (090 밴드, 기술 의존 없음 — 게이트는 ToS 결정뿐) ·
[112](./112_moc_gui.md) — GUI/Claude Desktop 옵션 (110 밴드 표면 트랙, M2 산출물 의존)

## 횡단 원칙

0. **명령어 체계 cli-jaw 통일 (D10, 260612 04:54)**: jwc 사용자-가시 명령은 cli-jaw 어휘를 따른다 —
   `jwc orchestrate`(PABCD)/`jwc goal`/`jwc memory` 등. 엔진은 gjc 네이티브 재사용, 표면만 통일.
   040–070 밴드의 명령 표면 계약이 이 원칙에 종속되고, M2 임베딩 시 어휘 충돌이 원천 제거됨
1. **리베이스 가드**: 업스트림 수정은 밴드별 최소 diff, 표면 파일 우선. 분기 수용(D4)하되 `git fetch upstream` 충돌 면적을 밴드 문서에 기록
2. **검증 우선**: 각 밴드 완료 기준은 testable — 통과 증거를 밴드 문서에 남김
3. **devlog 연속 기록**: 모든 개선안/결정은 이 폴더에 번호 문서로 (사용자 지시)
4. **cli-jaw 별도 과제 분리**: messages LIKE→FTS5 전환은 jawcode 범위 밖 (D9)
