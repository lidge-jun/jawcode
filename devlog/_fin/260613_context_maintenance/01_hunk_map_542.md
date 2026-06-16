# 01 — #542 Hunk Map (Sonnet 조사 결과)

> upstream: gjc dev `534b4f0` — `fix(compaction): run pre-prompt context maintenance (#542)`
> 총 13 hunk: CLEAN 3 / OFFSET 2 / CONFLICT 8

## agent-session.ts (7 hunk)

| # | 위치 | 함수 | jwc 줄 | 분류 | 설명 |
|---|---|---|---|---|---|
| 1 | `@4749` | `#sendPrompt` pre-prompt block | **4915** | CONFLICT(의존) | `#checkEstimatedContextBeforePrompt()` 호출 삽입 — hunk 2 선행 |
| 2 | `@6530` | 신규 메서드 삽입점 | **6718** | OFFSET | `#checkEstimatedContextBeforePrompt` 25줄 — `#checkCompaction` 닫힘 직후, `#assistantEndedWithSuccessfulYield` 직전. context 일치, 줄만 ~30 offset |
| 3 | `@7258` | `#runAutoCompaction` 시그니처 | **7447** | CONFLICT | 3-arg → 4-arg(`options?`) + `deferHandoffMaintenance` 가드 리팩터 |
| 4 | `@7316` | `#runAutoCompaction` — `continueAfterMaintenance` | **7468–7510** | CONFLICT | hunk 3 의존. const 삽입 + `scheduleAutoContinuePrompt` 가드 prepend |
| 5 | `@7352` | handoff 경로 guards | **7571–7580** | CONFLICT | `continueAfterMaintenance &&` prepend ×2 |
| 6 | `@7419` | queued-messages 분기 | **7800** | CONFLICT | 동일 prepend |
| 7 | `@7427` | autoContinue 분기 | **7810** | CONFLICT | 동일 prepend |

## compaction.ts (1 hunk)

| # | 위치 | 함수 | jwc 줄 | 분류 | 설명 |
|---|---|---|---|---|---|
| 8 | `@542` | `findCutPoint` — 폴백 | **527–535** | CONFLICT | `foundCutPoint` 변수 + 미발견 시 `cutPoints[last]` 폴백. **#557 cherry-pick으로 context 이동됨** — manual apply |

## test (5 hunk)

| # | 파일 | 분류 | 설명 |
|---|---|---|---|
| 9 | compaction.test.ts | OFFSET | `ToolResultMessage` import 추가 |
| 10 | compaction.test.ts | CLEAN | `createToolResultMessage` 헬퍼 + findCutPoint 테스트 추가 |
| 11–12 | agent-session-auto-compaction-queue.test.ts | CONFLICT | `streamFn` mock + `streamCallCount` — Agent 생성자 jawcode 차이 |
| 13 | agent-session-auto-compaction-queue.test.ts | CLEAN | 새 테스트 2개 (pre-prompt compaction + handoff) — 11–12 의존 |

## 적용 순서 (확정)

```
1. compaction.ts hunk 8     — findCutPoint 버그픽스 (독립)
2. agent-session.ts hunk 3  — #runAutoCompaction 시그니처 확장
3. agent-session.ts hunk 4,5,6,7 — continueAfterMaintenance 가드 (기계적)
4. agent-session.ts hunk 2  — #checkEstimatedContextBeforePrompt 메서드 삽입
5. agent-session.ts hunk 1  — 호출점 삽입 (4 의존)
6. tests hunk 9,10          — compaction 테스트 (clean)
7. tests hunk 11,12,13      — auto-compaction-queue 테스트 (manual merge)
```

핵심 위험: hunk 1의 `skipCompactionCheck` 전파 확인 (재진입 방지).
