# M0 패치: 파일 + 타입 리네임 상세

> sonnet 서브에이전트 생성 (260613)

## 파일 리네임 (git mv)

```
ultragoal-runtime.ts  →  goal-engine.ts
ultragoal-guard.ts    →  goal-guard.ts
goal-runtime.ts       →  goal-cli.ts
ralplan-runtime.ts    →  plan-writer.ts
```

## STEP 1: import 경로 업데이트

### `./ultragoal-runtime` → `./goal-engine`

| 파일 | 라인 |
|---|---|
| `orchestrate-runtime.ts` | 35 |
| `goal-guard.ts` (was ultragoal-guard) | 15 |
| `goal-cli.ts` (was goal-runtime) | 28 |
| `commands/ultragoal.ts` | 11 |

### `./ultragoal-guard` → `./goal-guard`

| 파일 | 라인 |
|---|---|
| `goals/tools/goal-tool.ts` | 7 |
| `hooks/skill-state.ts` | 5 |

### `./goal-runtime` → `./goal-cli`

| 파일 | 라인 |
|---|---|
| `commands/goal.ts` | 3 |

### `./ralplan-runtime` → `./plan-writer`

| 파일 | 라인 |
|---|---|
| `jaw-interview-runtime.ts` | 8 |
| `commands/ralplan.ts` | 3 |

## STEP 2: 타입 리네임

### goal-engine.ts 내부 (was ultragoal-runtime.ts)

| 현재 | 변경 | 정의 라인 | 크로스파일 사용 |
|---|---|---|---|
| `UltragoalGoal` | `GoalEntry` | :22 | goal-guard.ts:11,73,78,80,118 / goal-cli.ts:27,111 |
| `UltragoalPlan` | `GoalPlan` | :36 | goal-guard.ts:13,40,73,78,116,219,222 / orchestrate-runtime.ts:35,410 / goal-cli.ts via functions |
| `UltragoalPaths` | `GoalPaths` | :78 | 내부만 (getGoalPaths 반환형) |
| `UltragoalReceiptKind` | `GoalReceiptKind` | :47 | goal-guard.ts:14,80,119 |
| `UltragoalCommandResult` | `GoalEngineCommandResult` | :95 | 내부만 |

### goal-guard.ts 내부 (was ultragoal-guard.ts)

| 현재 | 변경 | 정의 라인 | 크로스파일 사용 |
|---|---|---|---|
| `UltragoalGuardState` | `GoalGuardState` | :17 | 내부만 |

### workflow-readers.ts (status-line)

| 현재 | 변경 | 정의 라인 | 크로스파일 사용 |
|---|---|---|---|
| `UltragoalLedgerStats` | `GoalLedgerStats` | :47 | status-line.ts:31 |

## STEP 3: 함수 리네임 (exported)

### goal-engine.ts (was ultragoal-runtime.ts)

| 현재 | 변경 | 호출 사이트 |
|---|---|---|
| `getUltragoalPaths` | `getGoalPaths` | goal-guard.ts:5,58 |
| `readUltragoalPlan` | `readGoalPlan` | goal-guard.ts:9,222 / orchestrate-runtime.ts:35,410 / goal-cli.ts:24,112,176,290 |
| `createUltragoalPlan` | `createGoalPlan` | goal-cli.ts:21,148,159 |
| `startNextUltragoalGoal` | `startNextGoal` | goal-cli.ts:26,149,160 |
| `checkpointUltragoalGoal` | `checkpointGoal` | orchestrate-runtime.ts:35,419 / goal-cli.ts:20,207,235,251 |
| `checkpointAndContinueUltragoalGoal` | `checkpointAndContinueGoal` | 내부만 |
| `refineUltragoalObjective` | `refineGoalObjective` | goal-cli.ts:25,170 |
| `runNativeUltragoalCommand` | `runNativeGoalEngineCommand` | commands/ultragoal.ts:11,21 |
| `renderUltragoalHelp` | `renderGoalHelp` | 내부만 |

### goal-guard.ts (was ultragoal-guard.ts)

| 현재 | 변경 | 호출 사이트 |
|---|---|---|
| `readUltragoalVerificationState` | `readGoalVerificationState` | hooks/skill-state.ts:5,547,587 |
| `isUltragoalBypassPrompt` | `isGoalBypassPrompt` | hooks/skill-state.ts:5,536 |
| `isKnownUltragoalObjective` | `isKnownGoalObjective` | 내부만 |
| `hasDurableUltragoalState` | `hasDurableGoalState` | 내부만 |

### plan-writer.ts (was ralplan-runtime.ts)

| 현재 | 변경 | 호출 사이트 |
|---|---|---|
| `runNativeRalplanCommand` | `runNativePlanWriterCommand` | jaw-interview-runtime.ts:8,570 / commands/ralplan.ts:3,15 |
| `RalplanCommandError` | `PlanWriterCommandError` | 내부만 (~25개소) |

### workflow-readers.ts

| 현재 | 변경 | 호출 사이트 |
|---|---|---|
| `readUltragoalLedgerStats` | `readGoalLedgerStats` | status-line.ts:31,665 |

## 전체 수정 파일 목록 (14개)

1. `goal-engine.ts` (was ultragoal-runtime.ts) — 파일명 + 내부 전체
2. `goal-guard.ts` (was ultragoal-guard.ts) — 파일명 + import + 내부
3. `goal-cli.ts` (was goal-runtime.ts) — 파일명 + import + 함수명
4. `plan-writer.ts` (was ralplan-runtime.ts) — 파일명 + 내부
5. `orchestrate-runtime.ts` — import 경로 + 함수명
6. `jaw-interview-runtime.ts` — import 경로
7. `commands/ultragoal.ts` — import 경로 + 함수명
8. `commands/goal.ts` — import 경로
9. `commands/ralplan.ts` — import 경로 + 함수명
10. `goals/tools/goal-tool.ts` — import 경로
11. `hooks/skill-state.ts` — import 경로 + 함수명
12. `modes/components/status-line.ts` — 함수명
13. `modes/components/status-line/workflow-readers.ts` — 타입명 + 함수명
14. `status-line/types.ts` — 타입명 (ultragoal → goal 필드명)

## 데이터 계약 보존 (sed 제외 대상)

다음 문자열 값은 **절대 치환하지 않음**:
- `payload.skill = "ultragoal"` (퍼시스트 JSON)
- `"ultragoal"` in `RpcWorkflowStage` union (와이어 프로토콜)
- `source: "ultragoal"` (퍼시스트 JSON)
- `BLOCK_ULTRAGOAL_COMPLETION:` (머신 파싱 토큰)
- `gjc_ultragoal_verification_*` (stop-reason 토큰)
- `.jwc/ultragoal/` (디스크 경로)
- `.jwc/plans/ralplan/` (디스크 경로)
