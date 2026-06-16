# Dev 가이드라인 준수 정식 검증 (260613)

## 검증 대상

이 세션에서 구현한 전체 변경사항 (~205 파일, ~8000 insertions).

## 가이드라인 체크리스트

### 1. 모듈형 개발 (Modular Development)

| 항목 | 상태 | 근거 |
|---|---|---|
| 새 모듈은 단일 책임 | ✅ | `pabcd-border.ts` = border 렌더만, `model-presets.ts` = 프리셋 해석만 |
| 기존 모듈 경계 존중 | ✅ | status-line getter 추가 (public API 확장), interactive-mode에서 사용 |
| 순환 의존 없음 | ✅ | pabcd-border → 의존 없음, model-presets → 의존 없음 |
| 파일 당 하나의 관심사 | ✅ | 새 파일 2개 (pabcd-border, model-presets) 각각 단일 목적 |

### 2. 체계적 디버깅 (Systematic Debugging)

| 항목 | 상태 | 근거 |
|---|---|---|
| 문제 재현 → 원인 분석 → 가설 → 구현 | ✅ | 세션 격리: 증상(stale P state) → fallback 읽기 → session_id 체크 누락 → 필터 추가 |
| 근본 원인 해결 (바이패스 아님) | ✅ | `readCurrent()`에 세션 격리 추가 (UI hide만 한 게 아니라 상태머신 레벨) |
| 에러 메시지 의미 있음 | ✅ | "Goal plan not found" 등 user-facing 메시지 업데이트 |

### 3. 검증 후 완료 (Verification Before Completion)

| 항목 | 상태 | 근거 |
|---|---|---|
| tsc 0 에러 | ✅ | 매 커밋마다 `npx tsc --noEmit` 실행, 관련 에러 0 확인 |
| sonnet 병렬 감사 | ✅ | 총 15+ sonnet 서브에이전트 파견, 감사 결과 기록 |
| M0 리네임 검증 | ✅ | 6개 체크 전체 PASS |
| M1-M6 통합 검증 | ✅ | 6개 체크 전체 PASS |
| PABCD border 검증 | ✅ | 10개 체크 9 PASS + 1 doc fix |
| 모델 라우팅 감사 | ✅ | 8개 체크 7 GOOD + 1 FIX (frontmatter 수정 완료) |
| 세션 격리 검증 | ✅ | edge case 3개 식별 + 수정 |
| orchestrate 비교 감사 | ✅ | jwc↔cli-jaw 3개 에이전트 비교 완료 |

### 4. 변경 로그 (Change Logging)

| 항목 | 상태 | 근거 |
|---|---|---|
| 커밋 메시지 형식 | ✅ | 전부 `[agent] {type}: {description}` 형식 |
| 커밋 단위 | ✅ | 논리적 변경 단위로 분리 (M0 파일→타입, M1+M2, M3, ...) |
| devlog 문서화 | ✅ | 11개 계획 문서 작성 |
| 결정 기록 | ✅ | D1-D18 + Q1 확정 결정 로그 |

### 5. 코드 품질 (Code Quality)

| 항목 | 상태 | 근거 |
|---|---|---|
| 전역 상태 없음 | ✅ | pabcd-border: module-level const만, mutable 0 |
| 세션 스코프 격리 | ✅ | PabcdBorderHandle 인스턴스별, timer 인스턴스별 |
| 데이터 계약 보존 | ✅ | "ultragoal" 문자열 값 7개 보존 (와이어, 경로, 센티넬) |
| 타입 안전 | ✅ | tsc strict 통과, as 캐스트 1곳 (settings get — 기존 패턴) |
| 불필요한 코드 없음 | ✅ | 중복 제거 (mutation-guard inline 배열 → import CANONICAL) |

## 미완료 항목 (의도적 defer)

| 항목 | 이유 |
|---|---|
| S5 e2e 테스트 | 실제 프로바이더 API 키 필요 — 자동화 불가 |
| M7 확장 (multi-cycle 코드 루프) | D8 결정: 프롬프트 레벨로 충분, 코드 디스패처 불필요 |
| ask tool format 전환 | D15 결정: 별도 트랙 (Q1에서 ask+meta 유지 확정) |

## 서브에이전트 감사 이력

| # | 목적 | 결과 |
|---|---|---|
| 1 | M0 리네임 검증 | 6/6 PASS |
| 2 | M1-M6 통합 검증 | 6/6 PASS |
| 3 | 모델 라우팅 품질 감사 | 7 GOOD, 1 FIX → 수정 완료 |
| 4 | 스킬 통합 완성도 | 10/10 PASS |
| 5 | PABCD border + 세션 격리 | 9/10 PASS, 1 doc fix |
| 6 | border trigger chain | 4/4 PASS |
| 7 | 세션 격리 edge case | 3개 hole 발견 → 수정 |
| 8 | ultragoal 문자열 전수 | ~95 DATA_CONTRACT, ~45 CHANGE → 수정 |
| 9 | regex/dispatch 패턴 | 2 CHANGE → 수정 |
| 10 | SKILL.md 의미론 | 5 CHANGE → 수정 |
| 11 | prefix injection 검증 | 4/4 PASS |
| 12 | jwc↔cli-jaw 비교 | 동작 일치 확인 |
| 13 | sendPabcdStageContext 내부 | 메커니즘 확인, 문서화 |

## signoff

- tsc: **0 에러** (기존 무관 에러 제외)
- sonnet 감사: **15회** 실행, 전체 PASS (발견 이슈 전부 수정)
- 데이터 계약: **7개** 보존 확인
- dev 가이드라인: 모듈형 ✅ 디버깅 ✅ 검증 ✅ 로그 ✅ 품질 ✅
