# 슬래시 커맨드 + goal→PABCD 브릿지 설계

> 서브에이전트 병렬 조사 결과 (260613)

## 현황

### cli-jaw (이미 존재)

| 커맨드 | 핸들러 | 상태 |
|---|---|---|
| `/goal` | `goalWorkflowHandler` | ✅ full state machine (set/plan/refine/done/run/...) |
| `/goalplan` | `goalplanHandler` (→ `/goal plan` alias) | ✅ |
| `/interview` | `interviewWorkflowHandler` | ✅ PABCD 'I' 전환 |

### jawcode (부분적)

| 커맨드 | 상태 | 위치 |
|---|---|---|
| `/goal` | ✅ built-in | `slash-commands/builtin-registry.ts:414` |
| `/goalplan` | ❌ 없음 | — |
| `/interview` | ❌ 없음 (CLI `jwc jaw-interview`만 존재) | `cli.ts:66`, `commands/interview.ts` |
| `/skill:jaw-interview` | ✅ 스킬 커맨드 | 자동 등록 |
| `/skill:ultragoal` | ✅ 스킬 커맨드 | 자동 등록 |

## 변경 계획

### C1: `/interview` 슬래시 커맨드 등록

`builtin-registry.ts`에 추가:
```typescript
{
  name: "interview",
  aliases: ["jaw-interview", "deep-interview"],
  description: "Socratic requirements gathering (IPABCD I-stage)",
  handle: (session, args) => runNativeJawInterviewCommand(args, session.cwd),
}
```

기존 `/skill:jaw-interview`은 유지 (호환), `/interview`가 우선.

### C2: `/goalplan` 슬래시 커맨드 등록

```typescript
{
  name: "goalplan",
  aliases: ["goal-plan"],
  description: "Create a plan-mode goal (shortcut for /goal plan)",
  handle: (session, args) => runGoalPlan(args, session.cwd),
}
```

### C3: 커맨드 우선순위

autocomplete/routing에서 우선:
```
/interview  (>  /skill:jaw-interview)
/goal       (>  /skill:ultragoal)
/goalplan   (>  없었음)
```

old names는 alias로 존속:
```
/skill:jaw-interview → /interview
/skill:ultragoal     → /goal
/skill:ralplan       → deprecated, /orchestrate p 안내
```

## goal → PABCD 브릿지 (현재 누락)

### 현재 흐름 (agent-in-the-loop)

```
jwc goal set "인증 시스템 리팩터"
  ↓ ultragoal-runtime 텍스트 시그널: next_action=execute-goal
  ↓ 에이전트가 읽고 수동으로:
jwc orchestrate i → p → a → b → c → d
  ↓ orchestrate-c 완료 시 pabcd-quality-gate.json 생성
jwc goal done   ← autoGate가 quality-gate.json 읽음
```

**문제**: 에이전트가 중간에 끊기면 cycle이 멈춤. 프로그래밍적 연결 없음.

### 목표 흐름 (에이전트 판단 기반, 프로그래밍적 루프 아님)

```
/goal set "인증 시스템 전면 리팩터"
  ↓
  PABCD cycle 1: P → A → B → C(pass) → D → IDLE
  ↓ 에이전트가 goal 확인: "아직 할 거 남았네"
  ↓ 알아서 P 재진입
  PABCD cycle 2: P → A → B → C(pass) → D → IDLE
  ↓ 에이전트가 goal 확인: "이제 다 했다"
  ↓ /goal done
```

핵심 설계:
- **디스패처/루프 없음** — 에이전트가 IDLE에서 goal 상태를 보고 자율 판단
- **goal = "IDLE이 끝이 아닐 수 있다"는 인식** — 하나의 goal이 여러 PABCD 사이클을 필요로 할 수 있음
- **I는 goal 밖** — 유저가 직접 `/interview`로 진입. goal은 I를 안 탐
- **C fail → P 재진입** — 에이전트 판단으로 자연스럽게 (코드 강제 아님)
- standalone PABCD (goal 없이)는 **한 사이클로 끝** — 현재와 동일
- 구현: 프롬프트/시스템 프롬프트에서 "goal active + IDLE → 남은 작업 확인 → 필요하면 P 재진입" 가이드

### HITL → HOTL 전환

| 모드 | 설명 | 게이트 |
|---|---|---|
| **standalone PABCD** (HITL) | 현재 동작. 매 전환마다 유저 승인 | I→P⛔ P→A⛔ A→B⛔ B→C⛔ C→D✅ |
| **goal-wrapped PABCD** (HOTL) | goal이 자동 진행. 유저는 관찰 + 필요 시 개입 | 게이트 해제, HUD로 진행 상황 관찰 |

HOTL에서 유저 개입 수단:
- **steer**: goal steering으로 방향 수정 (story 추가/제거/수정)
- **pause**: 아무 때나 `/goal pause` → PABCD 현재 phase에서 정지
- **override**: 특정 phase에 유저 게이트 강제 삽입 (설정: `goal.gates: ["A"]` → A만 유저 확인)
- **cancel**: `/goal cancel` → 현재 story 중단, 롤백

goal이 PABCD를 감쌀 때는 **유저 게이트를 건너뛰고 자동 진행** — 원래 HITL이던 ⛔가 goal 모드에서는 자동 통과.
유저는 HUD에서 `goal:B cycle=1 status=building`을 보면서 필요할 때만 개입.
이것이 "원래 HITL인데 HOTL로 할 수 있게 해주는" 구조.

### 구현: 프롬프트 가이드 (코드 디스패처 아님)

goal→PABCD 연결은 **프롬프트 레벨**에서 해결:

1. **D phase prompt 수정**: D 완료 후 IDLE 시 goal이 active면 → "남은 작업이 있는지 확인하고, 있으면 P로 재진입하라"
2. **system-prompt.md 라우팅 규칙 추가**: `goal active + IDLE → 작업 완료 여부 판단 → 미완료면 P 재진입`
3. **goal HUD에 PABCD 상태 연동**: 에이전트가 현재 phase를 인지할 수 있도록
```

의존: `orchestrate-runtime.ts`의 `runNativeOrchestrateCommand` import.

### 서브에이전트 병렬 검증 (C phase)

C phase에서 서브에이전트 병렬 파견은 **orchestrate-runtime.ts의 C 핸들러**에서 구현:

```
orchestrate C:
  ├─ task({ agent: "executor", model: "cheap:anthropic", tasks: [{ assignment: "run tests" }] })
  ├─ task({ agent: "architect", model: "best:anthropic", tasks: [{ assignment: "review" }] })
  └─ task({ agent: "critic", model: "self", tasks: [{ assignment: "plan compliance" }] })
  → aggregate results → pass/fail
```

TaskItem.model 라우팅 (이미 구현 완료)이 여기서 활용됨.

## 리네임 최종 정리

| 현재 | 변경 | 범위 |
|---|---|---|
| `ultragoal` (사용자 대면) | `goal` | 프롬프트, HUD, CLI help 텍스트 |
| `ultragoal` (엔진 내부) | **유지** | 타입명, 함수명, 데이터 계약, 와이어 프로토콜 |
| `ralplan` (스킬 표면) | 제거 → orchestrate p | `/skill:ralplan` 제거, keyword redirect |
| `ralplan` (CLI + 런타임) | **유지** | `jwc ralplan --write` = orchestrate-p 퍼시스턴스 채널 |
| `/skill:jaw-interview` | `/interview` (alias 유지) | 슬래시 커맨드 우선순위 |
| `/skill:ultragoal` | `/goal` (alias 유지) | 슬래시 커맨드 우선순위 |
| `.jwc/ultragoal/` | **유지** | 디스크 경로 (마이그레이션 비용 > 이점) |
| `.jwc/plans/ralplan/` | **유지** | 디스크 경로 |

## 구현 순서 (병렬 가능 그룹)

### Phase 1 — 병렬 실행 (독립)
- **W1**: `/interview` 슬래시 커맨드 등록 (builtin-registry.ts)
- **W2**: `/goalplan` 슬래시 커맨드 등록 (builtin-registry.ts)
- **W3**: ultragoal→goal 사용자 대면 텍스트 REWRITE (프롬프트 ~20개소)

### Phase 2 — 병렬 실행 (Phase 1 후)
- **W4**: system-prompt.md 라우팅 테이블 개편 (ralplan/ultragoal 하드코딩 제거)
- **W5**: skill-keywords.ts `$ralplan` → orchestrate redirect
- **W6**: HUD ultragoal→goal 네임스페이스 변경
- **W7**: goal HOTL 프롬프트 가이드 — D→IDLE 시 goal active면 P 재진입 (프롬프트 수정만, 코드 디스패처 없음)

### Phase 3 — 순차 (의존성)
- **W7**: goal→PABCD 프로그래밍적 브릿지 (executeGoalWithPabcd)
- **W8**: C-phase 서브에이전트 병렬 검증 dispatch
- **W9**: multi-cycle 루프 + cycle counter

### Phase 4 — 검증
- **W10**: e2e — `/goal set` → PABCD 1 cycle 완주
- **W11**: e2e — C fail → P 재진입 → 2nd cycle
