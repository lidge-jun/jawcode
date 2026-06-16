# 053 — P 단계 Boss-author + 3-reviewer (050 IPABCD 재매핑)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 2026-06-12 후속 결정. **050번대 lexicographic 연속** (D050-3).
> 선행: [050_moc_plan_pabcd.md](./050_moc_plan_pabcd.md), [051_design_command_port.md](./051_design_command_port.md), [052_decisions_ipabcd.md](./052_decisions_ipabcd.md)
> 배경: cli-jaw **P = Boss 1명이 계획 초안** vs gjc **ralplan = Planner가 작성** — 050은 **표면 cli-jaw, 리뷰 엔진 gjc**로 합친다.

## Metadata

| 항목 | 값 |
|------|-----|
| 결정 방식 | 설계 대화 확정 (jaw-interview 미재개) |
| 선행 topology | 050 Plan+IPABCD (052와 동일) |
| 패치 대상 | 050 MOC, 051 §3 — 본 세션에서 본문 반영 |

## 결정 (D050-10 … D050-15)

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-10 | **P 작성자** | **`orchestrate p` = Boss(메인 세션)가 spec 기반 plan 초안 작성** — devlog plan 파일 + 사용자용 요약/Mermaid. **Planner subagent는 작성자가 아님** | [확정] |
| D050-11 | **P 리뷰 루프** | Boss 초안 후 **순차 subagent**: Planner → Architect → Critic (ralplan SKILL과 동일 순서·fresh spawn 규칙). Critic `OKAY` 또는 max 5회 후 Boss가 초안 수정·재리뷰 | [개정→D050-19] |
| D050-12 | **A 단계** | **Critic은 P 안에서 완료**. **`orchestrate a` = cli-jaw A** — audit employee dispatch + `parseWorkerVerdict` (import/시그니처/통합 리스크). ralplan Critic을 A에 **중복 배치하지 않음** | [개정→D050-20] |
| D050-13 | **산출물 이중화** | **사람-facing**: Boss devlog plan → `pabcd.json` `plan_ref` + 채팅 요약. **실행 게이트 정본**: `gjc ralplan --write --stage final` → `.gjc/plans/ralplan/<run-id>/pending-approval.md`. 리뷰 stage는 planner/architect/critic/revision + receipt-only | [확정] |
| D050-14 | **`/skill:ralplan` vs `orchestrate p`** | **`jwc orchestrate p`** = Boss-author P (IPABCD 네이티브). **`/skill:ralplan`** = Planner-author consensus **유지** (jaw-interview handoff·team gate). M1에서 SKILL 본문 통합 **하지 않음** — 054에서 `orchestrate p` 런타임만 | [확정] |
| D050-15 | **trivial bypass** | 단일 파일·단일 동작·AC 명시 → Boss + **Planner 1-pass** (Architect/Critic 생략). `--deliberate`/high-risk/multi-file → **풀 3-reviewer**. `ctx.p_review_mode: "short"\|"full"` | [폐기→D050-21] |

## P 단계 흐름 (구판 — D050-19~21로 개정됨, 정본은 속집 2)

```
orchestrate p
  │
  ├─ 1. Boss: spec → devlog plan 초안 + 사용자 요약/Mermaid
  ├─ 2. (full) Planner  — AC/scope 리뷰 → --write stage planner
  ├─ 3. (full) Architect — steelman/tradeoff → stage architect
  ├─ 4. (full) Critic    — OKAY|ITERATE|REJECT → stage critic
  │        loop ≤5 → Boss revises
  ├─ 5. Boss: final → devlog + ralplan --write --stage final
  └─ 6. ⛔ STOP → 사용자 승인 → orchestrate a
```

**Subagent 규칙:** read-only, receipt-only; Architect/Critic **매 패스 fresh spawn**.

## A 단계 (D050-12)

- **P:** Critic까지 plan 품질·합의 완료
- **A:** audit employee + `parseWorkerVerdict` — 기술 audit만 (cli-jaw 동형)

## 패치·후속

- [x] 050 MOC, 051 §3·§3.1, 052 supersede 노트
- [ ] **054** `orchestrate p` 구현 diff

## 속집 — cli-jaw 인터뷰 확정분 (260612 10:00, D050-16 … 18)

> 같은 날 cli-jaw `orchestrate I` 인터뷰(R1-2)에서 052 미확정 3건을 닫음.
> ⚠️ 인터뷰 트랜스크립트는 이를 "D050-10~12"로 불렀으나 본 문서가 선채번 — **D050-16~18이 정본**.

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-16 | **D 단계 산출물** | **cli-jaw D 동형 + receipt 병행** — 요약(변경 파일/충족 기준)+WONDER/REFLECT 텍스트가 사용자 산출물, `pabcd.json`에 gjc receipt 관례로 종결 기록 | [확정] |
| D050-17 | **C 체크리스트** | **cli-jaw 3스테이지(기계 검증→정밀 검토→평결) 프롬프트 사본 + repo 게이트 구체화** — 본 repo는 `bun run check`/대상 테스트/rebrand 게이트 명시, 타 repo는 프로젝트 컨벤션 자동 감지 문구 | [확정] |
| D050-18 | **슬래시/CLI 정본** | **`/orchestrate`·`jwc orchestrate` 정본 + `/pabcd`·`jwc pabcd` alias**. 단계 HUD 표시는 080 TUI 밴드 위임 | [확정] |

## 속집 2 — P/A 리뷰어 재배치 (260612 10:13, D050-19 … 21)

> cli-jaw `orchestrate I` 인터뷰 R3-4에서 확정. 핵심: 리뷰어 3명을 폐기하는 게 아니라 **단계별 재배치** —
> Critic은 P의 품질 게이트, Planner+Architect는 A의 병렬 감사(cli-jaw 병렬 직원 디스패치 동형).

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-19 | **P 리뷰 루프 (D050-11 개정)** | Boss 초안 + **Critic 1-pass**(plan 품질 — 빠진 AC/스코프 구멍/모호한 단계)만. Planner/Architect는 P에서 제외. 타당성·통합 리스크는 전부 A로 위임 → P/A 비중복 | [확정] |
| D050-20 | **A 단계 (D050-12 개정)** | **`orchestrate a` = Planner + Architect 2명 병렬 감사** + `parseWorkerVerdict` 평결 수집. 감사자는 **read-only**(발견 + file:line 증거 + 수정안 제시까지), **플랜 수정은 Boss가 적용 → 델타 재감사**. **max 3라운드** 내 미PASS → 사용자 에스컬레이션 (040 밴드 2라운드 PASS로 검증된 패턴) | [확정] |
| D050-21 | **trivial bypass (D050-15 대체)** | P측 short/full 모드 소멸. trivial(단일 파일·단일 동작·AC 명시) → **A 감사 1명만 — 기본 Architect**(통합 리스크가 A의 본질, 계획 정합은 P Critic이 커버). `ctx.p_review_mode` 폐기 → `ctx.a_audit_mode: "solo"\|"dual"` | [확정] |

### 개정 흐름 (정본)

```
orchestrate p
  │
  ├─ 1. Boss: spec → devlog plan 초안 + 사용자 요약/Mermaid
  ├─ 2. Critic 1-pass — plan 품질 (AC 누락/스코프 구멍/모호 단계) → --write stage critic
  │        FAIL → Boss revises → 재검 (경량 루프)
  ├─ 3. Boss: final → devlog + ralplan --write --stage final
  └─ 4. ⛔ STOP → 사용자 승인 → orchestrate a

orchestrate a
  │
  ├─ 1. Planner ∥ Architect 병렬 감사 (trivial → Architect 단독, ctx.a_audit_mode)
  │        read-only — 발견 + file:line 증거 + 수정안 제시
  ├─ 2. parseWorkerVerdict 평결 수집 → FAIL이면 Boss가 플랜 수정 → 델타 재감사
  │        loop ≤3 → 미PASS 시 사용자 에스컬레이션
  └─ 3. ⛔ STOP → 사용자 승인 → orchestrate b
```

**Subagent 규칙(유지):** read-only, receipt-only, `--write`는 stage 기록용; 매 라운드 fresh spawn.

### 속집 2 패치 체크리스트

- [ ] 050 MOC §스코프, 051 §3 P/A행 재반영 — **054 P 단계 작업 항목**
- [ ] 052/본문 D050-11·12·15 참조처에 개정 포인터 확인

## 속집 3 — 054 A-1라운드 회수 결정 (260612 10:31, D050-22 … 24)

> 054 diff 플랜의 소규모 A 1라운드(Planner∥Architect 병렬 감사 — D050-20 첫 도그푸딩)가 FAIL로 회수한 결정 3건.

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-22 | **pabcd 상태 등록 구조** | **별도 native-state 레지스트리 신설** — `CANONICAL_GJC_WORKFLOW_SKILLS`(번들 4종) 불변, 051 R14("스킬 아님") 정합, rebrand/G002/dogfood 게이트 무접촉. state-runtime에 orchestrate 전용 경로 추가 | [확정] |
| D050-23 | **verdict 어휘** | **단계별 분리** — A = `PASS\|FAIL`(`parseWorkerVerdict` 신규 이식 + orchestrate 전용 audit 프롬프트로 출력 형식 고정), P Critic = `OKAY\|ITERATE\|REJECT`(ralplan 생태계 — critic.md·receipt·HUD 재사용) | [확정] |
| D050-24 | **명령 등록 브랜드 게이트** | **jaw 전용 등록 게이트 신설** — cli.ts 조건부 등록 빌더, gjc 브랜드에서 orchestrate/pabcd 미노출(051 §5 diff-0 원문 유지). interview 무게이트 등록의 소급 여부는 후속 검토 | [확정] |

~~수용된 [기본값] 3건~~ → **[확정] 일괄 승격** (260612 10:44 최종 클로징 라운드): P `p_round ≤2`(재FAIL 시 pending-approval 금지+에스컬레이션) / trivial 판정 = `orchestrate a` 진입 시 + `--deliberate` override / envelope 파일명 `pabcd-state.json`(문서상 `pabcd.json`은 논리 계약명).

## 속집 4 — 최종 클로징 라운드 (260612 10:44, D050-25 … 26)

| ID | 주제 | 결정 | 표기 |
|----|------|------|------|
| D050-25 | **interview 게이트 소급** | D050-24 조건부 등록 빌더에 `interview`(+`deep-interview` alias)도 편입 — **054 B2 스코프에 포함**. gjc 브랜드 표면 비대칭(interview 노출·orchestrate 미노출) 제거, diff-0 원칙 일관 | [확정] |
| D050-26 | **`$orchestrate` skill-keyword** | **미채택** — keyword는 `{keyword→skill}` 매핑이라 native 명령 노선(D050-22)과 구조 부정합. 진입 표면은 CLI·슬래시로 충분 | [확정] |

> 맹점 기록: 이번 도그푸딩에서 **D050-20/21(A 병렬·solo 감사 루프)은 실전 검증 완료**(054 A 1~3라운드), **D050-19(P Critic 1-pass)는 미검증** — D050-7 풀사이클 e2e가 첫 검증이 된다.

## 미확정 (054+)

- Planner/Architect **병렬 감사 프롬프트 조각**, Critic 1-pass 프롬프트 조각, devlog `plan_ref` 자동 번호
- 슬래시 HUD 구현 — 080 위임 (D050-18)

## Acceptance

- [x] D050-10 … D050-15 기록
- [x] D050-16 … D050-18 기록 (cli-jaw 인터뷰 속집)
- [x] D050-19 … D050-21 기록 (P/A 리뷰어 재배치 속집 2)
- [x] D050-22 … D050-24 기록 (054 A-1라운드 회수 속집 3)
- [x] D050-25 … D050-26 기록 + 기본값 3건 [확정] 승격 (최종 클로징 속집 4) — **050 인터뷰 완전 종결**
- [x] 050/051 본문 패치
- [ ] `jwc orchestrate p` 구현 (054 diff 플랜)
