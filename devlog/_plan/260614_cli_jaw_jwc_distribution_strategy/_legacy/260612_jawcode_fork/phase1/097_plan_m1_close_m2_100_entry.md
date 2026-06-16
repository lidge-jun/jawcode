# 097 — M1 마감(090 게이트) + M2 진입(100~) 실행 계획

> 입력: 사용자 "100번부터, 90번대 통합이 거의 마무리 → 계획 구체화" (260612).
> 정본: [000_roadmap.md](./000_roadmap.md) · M2 설계 [111_design_runtime_attach.md](./111_design_runtime_attach.md) · 부채 [095](./095_plan_debt_cleanup.md) · 잔여 패치 [096](./096_plan_goal_execution.md) · M1 done [090_moc_auth_release_gate.md](./090_moc_auth_release_gate.md).

## 0. 한 줄 위치

| 구간 | 의미 | 지금 |
|------|------|------|
| **090–099** | M1 **done** = G1–G9 release gate | 기능·TUI·인증 시딩은 대부분 착수/부분 완료, **게이트 표면(G1–G9) 공식 클로즈는 미선언** (090 MOC ⬜) |
| **095–096** | M1 **클린 베이스** (브랜드 하드수정·gjc bin 제거·biome·분리 커밋) | 실행 플랜 확정(C1–C12), **트랙 완주 여부는 repo 상태로 재확인** |
| **100–109** | M2 **진입** = Node 포팅 베이스라인 | MOC만 존재, 착수 전제 = M1 done + 111 선행 체인 인지 |

**"100번" = 이슈 번호가 아니라 로드맵 밴드 `100–109` (Node 포팅).** 90번대는 `090` 인증·릴리스 게이트 밴드.

---

## 1. 왜 100 전에 090을 먼저 닫아야 하는가

- [000](./000_roadmap.md): **M1 done = 090–099 gate 통과** (D2: M1 선행).
- [111](./111_design_runtime_attach.md) §0: M2는 **030 디스커버리(brand=jwc)**, **020 identity**, **051 명령 표면**을 "공짜"로 쓴다 — 반쯤 통합된 M1을 들고 100에 들어가면 **셰임/임포트 경로와 cli-jaw 어댑터 계약이 이중으로 흔들림**.
- [095](./095_plan_debt_cleanup.md) 확정 #1: **gjc 셸 bin 제거, jwc 단일 진입** — 100에서 `dist-node` 패키징 대상이 **jwc/sdk** 한 갈래로 고정되어야 함.

---

## 2. Phase A — 클린 트레인 (096 C1–C12, 최우선)

**목표:** `bun run check:ts` green · `git status` clean · 가드/정체성 e2e(096 §검증 4) · 구원칙 문서 배너(W4).

| 단계 | 커밋 묶음 | 산출 |
|------|-----------|------|
| A1 | C1 | biome/kiro 등 **이미 커밋된** lint 레드 제거 |
| A2 | C2–C5 | W2 분리 커밋(094.3/094.4/086/084/M6) + **미추적 파일 추적** |
| A3 | C6–C10 | 085.5 M1–M7 (시스템 프롬프트·번들·**gjc bin 제거**·가드 반전) |
| A4 | C11 | 057 스킬/스테이지 어휘 호환 |
| A5 | C12 | identity leak 테스트 + README/structure/주석 + **struct_har 재생성** |

**게이트 (매 A 단계 후):** `bun run check:ts` · 관련 `bun test <path>` · C12 후 jwc TUI "너는 누구야" → Jaw, GJC 비언급.

**병렬 허용 (095 #7):** A2 이후 086/094 TUI 잔여는 A3와 병렬 가능 — 단 **C10(gjc bin) 전후로 CI/release 스크립트 테스트** 한 번에 모음.

---

## 3. Phase B — 060 goal 병합 (096 조건부 C13~, G6 충족)

**목표:** [061](./061_design_goal_merge.md) M1–M7 → `jwc goal` / `/goal` 단일 엔진, ultragoal ledger 증거.

| 모듈 | 핵심 파일 | G6 연결 |
|------|-----------|---------|
| M1 | `gjc-runtime/goal-runtime.ts` | set→update(evidence)→done |
| M2–M4 | `commands/goal.ts`, TUI 별칭 | slash↔CLI 동형 |
| M3–M6 | pause 2-pass + ledger | jaw parity |
| M7 | `goal-runtime.test.ts` | 자동 증거 |

**착수 조건:** Phase A 완료(특히 C7–C9 프롬프트·번들 jwc 어휘). **060은 100과 무관** — M1 G6 미충족 시 090 선언 불가.

**완료 기준:** 061 §7 테스트 표 green + `bun run check:ts`.

---

## 4. Phase C — M1 Release Gate (090 G1–G9, 증거 기록)

정본: [090_moc_auth_release_gate.md](./090_moc_auth_release_gate.md). **각 항목마다 명령·출력·스크린샷 경로를 090 문서 본문에 append** → M1 done 선언.

| ID | 검증 | 선행 Phase | 증거 예시 |
|----|------|------------|-----------|
| G1 | `jwc --help` jaw 브랜딩, gjc 문자열 0 | A (C10) | help 캡처 + grep |
| G2 | 시스템 프롬프트 jaw 스냅샷 | A (C7–C8) | `system-prompt-identity` 등 |
| G3 | `~/.cli-jaw/skills` 로드 e2e | A+C11 | 스킬 1개 발동 로그 |
| G4 | jaw-interview 게이트·4차원 | 040 밴드 회귀 | 인터뷰 1회 transcript |
| G5 | `/pabcd` 풀사이클 pending-approval | 050 밴드 | pending md 경로 |
| G6 | goal set→checkpoint→done | **B** | ledger.jsonl 발췌 |
| G7 | memory save→search | 070 밴드 | 2세션 회수 |
| G8 | TUI 워크플로·한글 | 080·083·085 HUD | 스크린샷 |
| G9 | 신규 머신: Claude 로그인만으로 대화 | A2(094.3)+090 시딩 | `jwc auth import` 또는 자동 제안 플로우 |

**선택(게이트 아님):** [091](./091_plan_provider_kiro.md) kiro — **ToS 결정 전 착수 금지**. G9와 분리.

**M1 done 선언 조건:** G1–G9 전부 ✅ + [000](./000_roadmap.md)에 "M1 done" 날짜·커밋 SHA 1줄 기록.

---

## 5. Phase D — 100 밴드 구체화 (M2 Week 0–2 스코프)

정본: [100_moc_node_porting.md](./100_moc_node_porting.md). **100 착수 전 체크리스트:**

- [ ] M1 done (Phase C)
- [ ] `packages/jwc/src/sdk.ts` — `createAgentSession` 임포트 계약 동결 (010)
- [ ] cli-jaw 측: `spawn.ts` `child:null` 경로 재확인 (111 §1)
- [ ] 포팅 범위 문서화 고정: `ai` + `agent` + coding-agent **비-TUI** (tui 7파일 Bun 유지)

### D1. 작업 패키지 (100 내부 순서)

| # | 패키지 | 산출물 | 완료 신호 |
|---|--------|--------|-----------|
| D1.1 | **셰임 레이어** | `packages/jwc/src/shims/*` + 런타임 감지 | Bun/Node 동일 import 경로에서 분기 |
| D1.2 | **치환 매핑** | Bun.env/file/spawn/hash/JSONL/JSON5/sqlite | 100 MOC 표 전항 커버 |
| D1.3 | **dist-node 빌드** | esbuild (또는 합의 빌드) `dist-node/` | `node`로 entry 실행 |
| D1.4 | **테스트 베이스라인** | stream.test.ts 등 Node 22 러너 | 통과 목록을 100 MOC에 표로 기록 |
| D1.5 | **natives** | pi-natives Node 로드 | cli-jaw `ensure:native`와 정합 |
| D1.6 | **헬로월드** | createAgentSession + 1 provider 스트림 | 100 완료 기준 1번 |

### D2. 100에서 하지 않을 것 (스코프 가드)

- JawRuntime 싱글톤 → **110**
- jaw.db resume/steer → **120**
- cli-jaw 스킬/PABCD 주입 → **130** (단, 030 brand=jwc는 이미 M1)
- TUI interactive-mode Bun 포팅 → **하지 않음** (듀얼 런타임)

### D3. 100 완료 후 즉시 이어질 110–130 (요약)

| 밴드 | 산출 | M2 done |
|------|------|---------|
| 110 | `cli-jaw/src/agent/jwc-runtime.ts`, spawn 어댑터, bus 매핑 | ① Web UI spawn 없이 대화 |
| 120 | jaw.db 완료 시 1회 기록, resume-classifier 우회 | 재시작·steer e2e |
| 130 | GJC_BRAND_NAME=jwc, auth 시딩, PABCD 정본 연결 | **M2 done 3항목** |
| 140–150 | federation, 기본 cli=jwc 승격 | 후순위 |

상세: [111_design_runtime_attach.md](./111_design_runtime_attach.md).

---

## 6. 권장 타임라인 (순서 고정, 기간은 미정)

```
Phase A (096 C1–C12)
    → Phase B (060 C13+, 061 M1–M7)     [G6]
    → Phase C (090 G1–G9 증거 + M1 done)
    → Phase D (100 D1.1–D1.6)
    → 110 → 120 → 130 (111 체인)
    → 140/150 (병렬 가능)
```

**100번대 "통합"의 의미:** M2에서 **cli-jaw 서버 프로세스 안 jwc 상주**가 완성되는 지점은 **130**이지 100이 아님. 100은 **엔진을 Node에서 import 가능**하게 만드는 공학 기반.

---

## 7. 열린 결정 (100 착수 전에 답하면 좋음)

| # | 질문 | [기본값] |
|---|------|----------|
| 1 | 060 goal을 G6 전에 일부만 넣고 090을 "조건부" 선언할지 | **아니오** — G6은 061 전체 |
| 2 | 100 테스트: Node 단일 CI job 추가 vs 로컬만 | CI job 추가 권장 (회귀) |
| 3 | `packages/gajae-code` 워크스페이스 패키지 잔존 | 엔진 패키지 유지, **gjc bin만 제거**(095 확정) |
| 4 | M2 첫 통합 대상 cli-jaw 브랜치/버전 | jawcode M1 SHA 핀 + cli-jaw `dist` 빌드 3종 세트(AGENTS) |

---

## 8. 다음 문서 액션 (선택)

| 문서 | 시점 |
|------|------|
| `098_checklist_g1_g9.md` | Phase C 착수 시 — 항목별 체크박스·증거 링크만 |
| `100_plan_node_porting.md` | Phase D 착수 시 — D1.1–D1.6을 파일/PR 단위로 쪼갬 |
| `110_plan_jawruntime_impl.md` | 100 헬로월드 통과 직후 — 111 §2–3 매핑 표 |

---

## 9. 완료 정의 (본 플랜 097)

1. Phase A–C 완료 → **M1 done** 공식 선언 가능.
2. Phase D D1.6 통과 → **100 밴드 ⬜→✅**, 110 착수 가능.
3. 본 문서는 "계획 정본"이며, 진행 시 090·100 MOC의 `상태:` 필드와 동기화.