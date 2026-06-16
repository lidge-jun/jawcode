# /orchestrate 프롬프트 주입 모델

> sonnet 병렬 비교 감사 결과 (260613)

## 핵심: spawn이 아니라 상태 변경 + 프롬프트 주입

`/orchestrate <stage>`는 subprocess를 띄우지 않음. 현재 세션의 상태를 바꾸고,
해당 phase의 프롬프트를 LLM 세션에 주입하는 구조.

## 주입 경로 2가지

### 1. Initial Turn (최초 진입)

P와 I phase에만 적용. `getStatePrompt()`가 전체 프롬프트를 교체.

```
isInitialPlanningTurn = state === 'P' && !ctx?.plan
isInitialInterviewTurn = state === 'I' && !ctx?.interview
```

| Phase | 조건 | 주입 |
|---|---|---|
| P (최초) | plan 없음 | `getStatePrompt('P') + workspaceBlock + userRequest` |
| I (최초) | interview 없음 | `getStatePrompt('I') + userRequest` |

`skipPrefix = true` → 후속 prefix 중복 방지.

### 2. Subsequent Turns (2회차+)

모든 phase, 매 턴. `getPrefix(state, source, ctx)` 가 프롬프트 앞에 prepend.

| Phase | Source | Prefix | 내용 |
|---|---|---|---|
| I | user | `Ip` | "INTERVIEW MODE — User Response" + perspective rotation |
| P | user | `Pb2` | "PLANNING MODE — User Feedback" |
| A | user | `Ap` | "PLAN AUDIT — User Message" |
| A | worker | `Ab2` | "PLAN AUDIT — Employee Results" |
| B | worker | `Bb2` | "IMPLEMENTATION REVIEW — Employee Results" |
| B | user | — | prefix 없음 |

A와 B는 initial turn 가드 없음 → `getPrefix()`가 1턴부터 바로 적용.

## jwc vs cli-jaw 비교

| | jwc | cli-jaw |
|---|---|---|
| 상태 저장 | JSON 파일 (`pabcd-state.json`) | SQLite DB |
| 최초 프롬프트 | `session.prompt(stdout)` 직접 주입 | `getStatePrompt()` 교체 |
| 후속 prefix | — (조사 필요) | `getPrefix()` prepend |
| subprocess | 없음 | 없음 |
| UI 알림 | status-line 1s 폴링 | WebSocket broadcast |

## 설계 의미

- `/orchestrate`는 **모드 전환 커맨드** — 에이전트의 행동을 phase prompt로 조종
- 매 턴마다 prefix 주입 → 에이전트가 현재 phase 역할을 유지
- spawn 없음 → 컨텍스트 보존. 같은 대화 안에서 phase 전환
