# ultragoal 참조 전수 분석

> 서브에이전트 병렬 검증 결과 (260613)

## 카테고리 분류

| 카테고리 | 수 | 설명 |
|---|---|---|
| **KEEP** | ~185 | 엔진 내부, 타입명, 와이어 프로토콜, 데이터 계약, 런타임 |
| **REWRITE** | ~20 | 에이전트/사용자 대면 텍스트에서 "ultragoal" 명사 변경 |
| **RENAME** | 0 | 순수 식별자 리네임 불필요 — 엔진 내부는 ultragoal 유지 |

## 데이터 계약 (절대 무마이그레이션 변경 금지)

| # | 파일 | 라인 | 계약 |
|---|---|---|---|
| 1 | `goal-mode-request.ts` | 21 | `DEFAULT_ULTRAGOAL_OBJECTIVE` — `.jwc/ultragoal/goals.json`에 저장 |
| 2 | `goal-mode-request.ts` | 27 | `source: "ultragoal"` — 퍼시스트된 JSON 필드 |
| 3 | `ultragoal-runtime.ts` | 1688 | `payload.skill = "ultragoal"` — `.jwc/state/` 워크플로우 상태 |
| 4 | `rpc-types.ts` | 406 | `RpcWorkflowStage = "ultragoal"` — 와이어 프로토콜 |
| 5 | `skill-state.ts` | 544 | `BLOCK_ULTRAGOAL_COMPLETION:` — 머신 파싱 토큰 |
| 6 | `skill-state.ts` | 597 | `gjc_ultragoal_verification_*` — stop-reason 토큰 |

→ 엔진 내부 식별자는 `ultragoal` 유지. 사용자/에이전트 대면 표면만 `goal`로 변경.

## 프롬프트 REWRITE 대상

### system-prompt.md

| 라인 | 현재 | 변경 |
|---|---|---|
| 31-33 | `<skill name="ultragoal" ...>` | 제거 (동적 `{{#list skills}}`로 대체) |
| 82 | `Durable goal ledger → use ultragoal` | `→ use goal` |

### agents/executor.md

| 라인 | 현재 | 변경 |
|---|---|---|
| 34 | `<ultragoal_red_team_mode>` | `<goal_red_team_mode>` |
| 35 | `"Ultragoal completion QA/red-team"` | `"Goal completion QA/red-team"` |
| 45 | `</ultragoal_red_team_mode>` | `</goal_red_team_mode>` |

### agents/planner.md

| 라인 | 현재 | 변경 |
|---|---|---|
| 42 | `executor, architect, critic, team, or ultragoal` | `... or goal` |

### ultragoal-runtime.ts (사용자 대면 텍스트)

| 라인 | 현재 | 변경 |
|---|---|---|
| 512 | `"Complete ultragoal brief"` | `"Complete goal brief"` |
| 1431 | `"Ultragoal workflow commands"` | `"Goal workflow commands"` |
| 1538-1555 | `"All ultragoal goals are complete."` 등 | `"All goals are complete."` 등 |

### skill-state.ts (컨텍스트 메시지)

| 라인 | 현재 | 변경 |
|---|---|---|
| 557 | `"Ultragoal is active (phase: …)"` | `"Goal is active (phase: …)"` |
| 604 | `"hand off to ralplan/team/ultragoal"` | `"hand off to team/goal"` |

### commands/ultragoal.ts

| 라인 | 현재 | 변경 |
|---|---|---|
| 14 | `"Run native JWC goal-ledger (ultragoal) workflow"` | `"Run native JWC goal-ledger workflow"` |

## KEEP (변경 불필요)

- `ultragoal-runtime.ts` 전체 엔진 (~200+ 참조)
- `ultragoal-guard.ts` 전체
- `goal-mode-request.ts` 인터페이스/함수명
- `workflow-manifest.ts` 상태 머신
- `status-line*.ts` 컨텍스트 필드명
- `workflow-gate-broker.ts` V1_STAGES (프로토콜 호환)
- `approval-gate.ts` stage 값
- `skill-state/*.ts` 런타임 로직
- `jaw-interview/SKILL.md` 참조 (라이브 스킬명)
- `team/SKILL.md` 참조
