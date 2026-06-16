# 040 MOC — 워크플로 병합 ①: Interview

> 상태: ✅ (260612 10:00 완료 — 인터뷰 7라운드 + [041](./041_plan_jaw_interview_merge.md) 결정 14건 + [042](./042_diff_jaw_interview.md) diff 플랜 + B1~B5 구현).
> 결정 근거: D3 [확정] 매핑 병합 (deep-interview ↔ jaw Interview).
> 산출물: jaw-interview 스킬(rename+이중감사), structured-renderer, jwc.interview 설정, [043 스키마 계약](./043_contract_elicitation_schema.md).
> 알려진 한계: ① 레거시 on-disk state 파일명(deep-interview-state.json)은 미조회 — 진행 중이던 구 인터뷰 세션 재개 불가(값 수준 normalize는 동작) ② /skill:deep-interview 직접 호출은 미지원(CLI alias·키워드 트리거는 호환) ③ 050 소비 e2e는 050 밴드 착수 시.

## 병합 소재 (코드 검증 완료, 04 로그 R4)

| 출처 | 가져올 것 |
|------|----------|
| gjc deep-interview | 수학적 ambiguity 스코어 표시(투명 점수), Round 0 topology gate(컴포넌트 목록 잠금), `.gjc/specs/deep-interview-{slug}.md` 핸드오프, explore 에이전트 선행 조사, 언어 추종(`language.instruction`) |
| jaw Interview | 4차원 고정(goal/constraint/success/ontology), negativity bias(헤징 답변 강등), known/unknown 누적 트래커, source/confidence 메타 |

## 스코프

1. 단일 스킬 `jaw-interview`로 병합: deep-interview를 베이스로 4차원을 스코어링 차원으로 주입
   (gjc의 가중 차원 자리에 jaw 4차원 + 가중치)
2. negativity bias 규칙을 Execution_Policy에 삽입
3. 트래커 스케일: gjc 수학 스코어(0~1 ambiguity)와 jaw 레벨(low~max) 통일 필요 —
   [제안] ambiguity 역수를 5단계 양자화해 레벨 표기, 원점수 병기
4. 질문 수: [기본값] **라운드당 1개** (gjc Execution_Policy "Ask ONE question at a time -- never batch")
   / [제안] jaw처럼 1–3개 허용 완화 — 결정 필요
5. 핸드오프: [기본값] `.gjc/specs/deep-interview-{slug}.md` 경로·포맷 유지, ralplan(050)과
   PABCD P단계가 같은 spec을 입력으로 소비

## 기본값/제안

- [기본값] pipeline: `deep-interview → plan`, handoff-policy: approval-required (frontmatter 기존 계약 유지)
- [제안] 기존 deep-interview 스킬 보존(업스트림 검증용) + jaw-interview 별도 등록, jwc 기본 진입은 jaw-interview
- ⚠️ [기본값 가드] `scripts/rebrand-inventory.ts:32`가 번들 워크플로 스킬을 **정확히 4종으로 기계 강제** —
  jaw-interview를 번들로 추가하려면 `expectedBundledWorkflowSkills` 확장(포크 수정) 필요.
  대안: 번들이 아닌 `.gjc` 디스커버리 계층으로 배포 (010 MOC §리포 가드 참조)

## 완료 기준

- 모호한 요청 → 게이트 통과 전 실행 거부 + 4차원 점수 라운드별 표시
- spec 핸드오프 파일 산출 → 050 플랜 입력으로 소비되는 e2e
- 헤징 답변("아마/maybe") 시 해당 차원 점수 강등 테스트

## 열린 질문

- topology gate를 4차원 체계 어디에 거는가 — [기본값] ontology 차원의 Round 0 선행 게이트
- cli-jaw 쪽 Interview 모드(orchestrate I)와의 텍스트 동기화 시점 (M2 130에서)
