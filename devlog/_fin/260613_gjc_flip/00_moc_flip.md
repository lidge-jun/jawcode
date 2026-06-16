# 00 — MOC: gjc→jwc 소스코드 플립

> 상태: ✅ 완료 (260613) — F1~F6 전부 랜딩+검증, `8e17a1ce refactor!: flip gjc→jwc across
> source + composer footer + /help + ralplan farewell`로 커밋 (분할 대신 단일 커밋 채택).
> 후속 작업(100.01 dist-node 등)이 플립 위에서 진행 중.
> 입력: 사용자 260613 — "소스코드도 flip하는 플랜을 세우고, 소스코드의 gjc 부분을 jwc로.
> devlog _plan 아래 새 폴더. sonnet 서브에이전트 병렬 파견해서 논의 → 계획 확정 → flip
> 차례차례 진행, 전부 구현 + 검증까지 완료." + "전부 플랜을 세우고 진행해야돼".
> 선행 결정: [99.30.02](../../_plan/260612_jawcode_fork/phase1/99.30.02_plan_workflow_skill_alignment.md) §7
> **이별** — upstream gjc ralplan 트랙과 결별, chase는 의미론적 팔로우만 (chase 003 원칙 5).
> ⚠️ 본 플립은 [065.1](../../_plan/260612_jawcode_fork/phase1/065.1_plan_internal_identifiers.md) "내부 식별자
> 보존" 결정과 fork-delta **보존 경계(BOUNDARY: gjc-internal-identifiers)를 의도적으로 뒤집는다**
> — 이별 결정의 소스코드 귀결.

## 문서

| # | 문서 | 내용 |
|---|---|---|
| 00 | 본 MOC | 입력·결정 계보·진행 추적 |
| [01](./01_analysis_identifiers.md) | 분석 A1 — 식별자·심볼·경로 인벤토리 + 위험 분류 |
| [02](./02_analysis_packages.md) | 분석 A2 — 패키지 스코프·빌드 인프라 |
| [03](./03_analysis_persistence.md) | 분석 A3 — 퍼시스턴스·호환 계약·마이그레이션 |
| [04](./04_analysis_tests_order.md) | 분석 A4 — 테스트/체크 표면 + 실행 순서 |
| [05](./05_plan_flip.md) | **확정 플랜** — 단계(F1..Fn)·검증 게이트 |
| [06](./06_impl_log.md) | 실행 로그 — 단계별 랜딩·검증 결과 |

## 진행

- [x] A1~A4 Sonnet 병렬 분석 파견 + 회수 (01~04)
- [x] 05 플랜 확정 (D1~D6 + F1~F6 + 연기 명단)
- [x] F1~F5 + F2.5 실행 완료 — 06 로그
- [x] 전체 검증: 루트 풀스위트 **7,842 pass / 15 fail(전부 stash-입증 기존: 14 + check:schemas
  기존 stale)** · tsc 전 패키지 0 · biome 이슈 9 (기준선 20 대비 감소) · check:jwc-ui 0 ·
  ci-jwc-state-gates 0
- [x] 06 실행 로그 마감
- [x] 후속: phase1/ 재편(149문서+링크 보정) · 100~150 플랜 9건 "260613 플립 기준 재구체화" 마커
  완료 (100·110·120 = Sonnet, 나머지 직접) · fork-delta 보존 경계 반전 기록
- [x] 사용자 검수 → 커밋 — 분할 대신 단일 커밋(`8e17a1ce`)으로 랜딩 (devlog는 `586a4379`)
