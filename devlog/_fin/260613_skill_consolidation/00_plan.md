# 스킬 통합: ultragoal → goal 흡수, ralplan → orchestrate p 대체

> 상태: 🟢 M0-M8 구현 완료 + PABCD border 구현 (260613)
> 소속: jawcode M2+ · 선행: 99.03.00 workflow surface revision

## 핵심 결정

| 현재 | 변경 | 이유 |
|---|---|---|
| `ultragoal` (번들 스킬) | `/goal` 네이티브 커맨드에 흡수 | 이미 동일 엔진 (`ultragoal-runtime.ts`) 공유, 스킬은 가이드 래퍼일 뿐 |
| `ralplan` (번들 스킬) | `jwc orchestrate p`로 완전 대체, 제거 | 99.30.02에서 superseded 선언 완료, 레거시 호환만 유지 중 |

## 현황: 왜 분리돼 있나

```
ultragoal SKILL.md (가이드)
    ↓ goal({op}) tool 호출
ultragoal-runtime.ts (엔진)
    ↓ 동일 함수
/goal CLI verbs (어댑터)
    ↓ 동일 저장소
.jwc/ultragoal/ (아티팩트)
```

- ultragoal 스킬 = 에이전트에게 "이렇게 goal tool을 써라"는 가이드
- `/goal` CLI = 사람이 쓰는 동일 엔진 어댑터
- **완전한 중복** — 스킬이 별도 존재할 이유 없음

ralplan은 이미 SKILL.md 첫 줄에 "SUPERSEDED" 선언. 실질적으로 `jwc orchestrate p`가 대체.

## 스킬 이름 변경

| 현재 | 변경 | 비고 |
|---|---|---|
| `/skill:ultragoal` | **제거** → goal 네이티브 가이드로 흡수 | `goal({op})` tool description에 가이드 통합 |
| `/skill:ralplan` | **제거** | `jwc orchestrate p` 완전 대체 |
| `/skill:jaw-interview` | 유지 | 독립 워크플로우, 변경 없음 |
| `/skill:team` | 유지 | 독립 워크플로우, 변경 없음 |
| `/skill:browse` | 유지 | tool-help 스킬, 변경 없음 |
| `/skill:search` | 유지 | tool-help 스킬, 변경 없음 |

번들 기본 스킬: **6 → 4** (jaw-interview, team, browse, search)

## 영향 범위 전수

### S1: ultragoal → goal 흡수

| 파일 | 변경 |
|---|---|
| `defaults/jwc/skills/ultragoal/SKILL.md` | 삭제 (가이드 내용은 goal tool description으로 이전) |
| `defaults/jwc/skills/ultragoal/ai-slop-cleaner.md` | goal 서브디렉토리로 이전 or tool prompt에 인라인 |
| `defaults/jwc-defaults.ts` | `ultragoal` 엔트리 제거 |
| `prompts/system/system-prompt.md` | `<skill name="ultragoal">` 하드코딩 제거 |
| `prompts/tools/skill.md` | ultragoal 참조 업데이트 |
| `jwc-runtime/workflow-manifest.ts:214` | `skill: "ultragoal"` → 네이티브 참조로 변경 |
| `modes/shared/agent-wire/workflow-gate-broker.ts:28` | `V1_STAGES`에서 `"ultragoal"` 제거 or 리네임 |
| `modes/shared/agent-wire/approval-gate.ts` | ultragoal execution gate → goal gate |
| `prompts/agents/executor.md` | `<ultragoal_red_team_mode>` → `<goal_red_team_mode>` |
| `cli.ts:45` | `ultragoal` CLI subcommand → `goal` 통합 (이미 goal-runtime.ts가 래핑) |

핵심: ultragoal-runtime.ts는 **그대로 유지** (엔진). 제거하는 건 스킬 래퍼뿐.

### S2: ralplan → orchestrate p 대체

| 파일 | 변경 |
|---|---|
| `defaults/jwc/skills/ralplan/SKILL.md` | 삭제 |
| `defaults/jwc-defaults.ts` | `ralplan` 엔트리 제거 |
| `prompts/system/system-prompt.md` | `<skill name="ralplan">` 하드코딩 제거 |
| `jwc-runtime/ralplan-runtime.ts` | 레거시 실행만 유지 or deprecate 경고 추가 |
| `jwc-runtime/workflow-manifest.ts:175` | `skill: "ralplan"` 제거 |
| `modes/shared/agent-wire/workflow-gate-broker.ts:28` | `"ralplan"` 제거 |
| `modes/shared/agent-wire/approval-gate.ts` | ralplan approval gate 제거 |
| `tools/bash-allowed-prefixes.ts:124` | `jwc ralplan --write` 제거 |
| `prompts/agents/planner.md` | `jwc ralplan --write` → `jwc orchestrate p` |
| `prompts/agents/critic.md` | 동일 치환 |
| `prompts/agents/architect.md` | 동일 치환 |
| `prompts/jaw/orchestrate-p.md` | ralplan 경로 참조 정리 |
| `prompts/jaw/orchestrate-a.md` | 동일 |
| `jaw-interview/SKILL.md` | ralplan 참조 → orchestrate p |
| `team/SKILL.md` | ralplan 참조 → orchestrate p |
| `cli.ts:46` | `ralplan` CLI subcommand 제거 or deprecation wrapper |

### S3: system-prompt.md 정리

현재 하드코딩 (lines 23-37):
```xml
<skill name="jaw-interview" ...>...</skill>
<skill name="ralplan" ...>...</skill>    ← 제거
<skill name="ultragoal" ...>...</skill>  ← 제거
<skill name="team" ...>...</skill>
```

변경 후:
```xml
<skill name="jaw-interview" ...>...</skill>
<skill name="team" ...>...</skill>
```

+ 동적 `{{#list skills}}` 블록이 나머지 스킬 렌더 (이미 구현 완료)

### S4: goal tool description 강화

ultragoal SKILL.md의 핵심 가이드를 goal tool의 description에 통합:
- multi-goal story plan 구조
- aggregate mode
- quality gate (ai-slop-cleaner, architect review)
- dynamic steering
- completion gate

위치: goal tool definition (현재 위치 확인 필요)

## 구현 순서

| # | 내용 | 위험도 | 병렬 |
|---|---|---|---|
| M0 | **파일 + 타입 리네임** (아래 상세) | 낮음 (기계적) | ✅ W1-W4 병렬 |
| M1 | ralplan 스킬 표면 제거 + orchestrate p redirect | 낮음 | M0 후 |
| M2 | system-prompt.md 하드코딩 제거 + 라우팅 개편 | 낮음 | M1과 병렬 |
| M3 | ultragoal SKILL.md → goal tool description 이전 | 중간 | M0 후 |
| M4 | defaults 정리 (스킬 등록 업데이트) | 낮음 | M3 후 |
| M5 | `/interview` + `/goalplan` 슬래시 커맨드 등록 | 낮음 | M0 후 병렬 |
| M6 | HUD 통합 — goal + PABCD phase 표시 | 중간 | M0 후 |
| M7 | goal→PABCD 브릿지 + multi-cycle + C-phase 병렬 검증 | 높음 | M5,M6 후 |
| M8 | 테스트 — 전체 워크플로우 검증 | — | 마지막 |

### M0: 파일 + 타입 리네임 (Phase 0 — 기계적, 병렬 실행)

#### 파일 리네임

| 현재 | 변경 | 비고 |
|---|---|---|
| `ultragoal-runtime.ts` | `goal-engine.ts` | 엔진 (1700줄) |
| `ultragoal-guard.ts` | `goal-guard.ts` | 검증 가드 |
| `goal-runtime.ts` | `goal-cli.ts` | CLI 어댑터 (이름 충돌 해소) |
| `ralplan-runtime.ts` | `plan-writer.ts` | orchestrate-p 퍼시스턴스 채널 |
| `goal-mode-request.ts` | 유지 | 충돌 없음 |

#### 타입 리네임

| 현재 | 변경 |
|---|---|
| `UltragoalPlan` | `GoalPlan` |
| `UltragoalGoal` | `GoalStory` |
| `UltragoalGuardState` | `GoalGuardState` |
| `UltragoalGuardDiagnostic` | `GoalGuardDiagnostic` |
| `UltragoalLedgerStats` | `GoalLedgerStats` |
| `UltragoalCheckpointEvidence` | `GoalCheckpointEvidence` |
| `UltragoalPaths` | `GoalPaths` |
| `RalplanCommandError` | `PlanWriterError` |
| `isKnownUltragoalObjective` | `isKnownGoalObjective` |
| `hasDurableUltragoalState` | `hasDurableGoalState` |
| `readUltragoalVerificationState` | `readGoalVerificationState` |
| `assertCanCompleteCurrentGoal` | 유지 (이미 goal 네이밍) |
| `getUltragoalPaths` | `getGoalPaths` |
| `readUltragoalLedgerStats` | `readGoalLedgerStats` |
| `createUltragoalPlan` | `createGoalPlan` |
| `readUltragoalPlan` | `readGoalPlan` |
| `renderUltragoalHelp` | `renderGoalHelp` |

#### 데이터 계약 (문자열 값 유지 — 리네임 금지)

| 값 | 위치 | 이유 |
|---|---|---|
| `"ultragoal"` in `payload.skill` | goal-engine.ts | `.jwc/state/` 퍼시스트 |
| `"ultragoal"` in `RpcWorkflowStage` | rpc-types.ts | 와이어 프로토콜 |
| `source: "ultragoal"` | goal-mode-request.ts | 퍼시스트 JSON |
| `BLOCK_ULTRAGOAL_COMPLETION:` | skill-state.ts | 머신 파싱 토큰 |
| `gjc_ultragoal_verification_*` | skill-state.ts | stop-reason 토큰 |
| `.jwc/ultragoal/` | 디스크 경로 | 기존 아티팩트 호환 |
| `.jwc/plans/ralplan/` | 디스크 경로 | 기존 아티팩트 호환 |

#### 병렬 실행 단위

| Worker | 범위 | 파일 수 |
|---|---|---|
| W1 | `ultragoal-runtime.ts` → `goal-engine.ts` + 모든 import 업데이트 | ~15 |
| W2 | `ultragoal-guard.ts` → `goal-guard.ts` + import 업데이트 | ~5 |
| W3 | `goal-runtime.ts` → `goal-cli.ts` + import 업데이트 | ~3 |
| W4 | `ralplan-runtime.ts` → `plan-writer.ts` + import 업데이트 | ~8 |
| 후속 | 타입명 일괄 리네임 (W1-W4 머지 후, sed/replace_all) | 전체 |

### M5: HUD 통합 상세

현재 (ultragoal 별도):
```
◆ hud ultragoal:goal-planning goals=0/0 current=goal-planning status=goal-planning receipt=fresh
```

변경 후 (goal + PABCD phase 통합):
```
◆ hud goal:P goals=1/3 current=G001 phase=P status=planning receipt=fresh
◆ hud goal:B goals=1/3 current=G001 phase=B status=building receipt=wip
◆ hud goal:C goals=1/3 current=G001 phase=C status=checking receipt=wip
◆ hud goal:D goals=2/3 current=G002 phase=D status=done receipt=complete
```

- `ultragoal:*` 네임스페이스 → `goal:*`로 단일화
- PABCD phase가 HUD에 직접 노출 — 현재 어떤 단계인지 한눈에 파악
- goals=N/M 카운터 + current story ID 유지
- orchestrate 상태와 goal 상태가 하나의 HUD 라인으로 통합

영향 파일:
- HUD 렌더러 (상태바에 ultragoal 표시하는 코드)
- goal-runtime.ts (HUD 상태 발행)
- ultragoal-runtime.ts (HUD 이벤트 포맷)

### M7: Multi-cycle PABCD + 서브에이전트 병렬 검증

goal 하나에 PABCD가 **한 사이클로 끝나지 않음**. 복잡한 goal은:

```
G001: "인증 시스템 전면 리팩터"
  cycle 1: P→A→B(auth-module)→C(fail)→ ← C에서 실패
  cycle 2: P(hotfix)→B(fix)→C(pass)→D  ← 재진입, 수정 후 통과
```

#### Multi-cycle 설계

- PABCD는 **선형 파이프라인이 아니라 루프**
- C(Check)에서 실패 → P로 재진입 (hotfix plan) → B → C 재시도
- cycle counter: `cycle=2 phase=B` HUD에 노출
- 각 cycle은 ledger.jsonl에 독립 엔트리로 기록

```
◆ hud goal:B goals=1/3 current=G001 cycle=2 phase=B status=fixing receipt=wip
```

#### 서브에이전트 병렬 검증 (C phase)

C(Check) 단계에서 **여러 검증을 병렬 서브에이전트로 파견**:

```
C phase dispatch:
  ├─ executor(cheap:anthropic) → unit test 실행
  ├─ executor(cheap:google)    → integration test
  ├─ architect(best:anthropic) → architecture review
  └─ critic(self)              → plan compliance check
```

- 서브에이전트 모델 라우팅 (260613_subagent_model_routing) 활용
- 각 검증은 독립 — 하나라도 fail이면 cycle 재진입
- 결과 aggregate: `{ pass: 3, fail: 1 }` → fail 사유와 함께 P로 복귀
- pass 기준: **전원 pass** (majority vote 아님)

#### HUD 확장

```
◆ hud goal:C goals=1/3 current=G001 cycle=1 phase=C status=verifying[2/4] receipt=wip
◆ hud goal:C goals=1/3 current=G001 cycle=1 phase=C status=fail(architect) receipt=wip
◆ hud goal:P goals=1/3 current=G001 cycle=2 phase=P status=hotfix-plan receipt=wip
```

#### 연관 플랜

- 서브에이전트 모델 라우팅: `devlog/_plan/260613_subagent_model_routing/00_plan.md`
- TaskItem.model 필드로 per-task 모델 지정 (이미 구현 완료)

## 미결정

- ralplan-runtime.ts 완전 삭제 vs 레거시 아티팩트 읽기용 유지
- ultragoal의 ai-slop-cleaner.md를 어디로 옮길지 (goal tool prompt? 별도 파일?)
- `.jwc/plans/ralplan/` 기존 디스크 아티팩트 마이그레이션 or 읽기만 유지
- `V1_STAGES` 배열에서 제거 시 기존 gate 이벤트 호환성
- cycle 최대 횟수 제한 (무한 루프 방지) — 기본 3? 5?
- C phase 병렬 검증 실패 시 사용자 확인 게이트 필요 여부 (자동 재진입 vs 승인 후 재진입)
