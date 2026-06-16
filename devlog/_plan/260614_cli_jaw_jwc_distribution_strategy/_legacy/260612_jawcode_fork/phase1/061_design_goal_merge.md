# 061 — 설계: jwc goal 어댑터 (060 구체화, ultragoal 실사 기반)

> 상위: [060_moc_goal_merge.md](./060_moc_goal_merge.md). 실사: Backend 직원 (260612 11:40, read-only). 인터뷰 확정: 260612 01:36.
> 방향 [확정]: 엔진 = gjc ultragoal + goal 도구 유지, 표면 = `jwc goal set/refine/plan/status/update/done/cancel/pause/resume/history` (cli-jaw 동형, D10).

## 1. 엔진 사실 (코드 실사)

### 2계층 goal 모델

| 계층 | 저장소 | 조작면 |
|------|--------|--------|
| 세션 goal mode | 세션 transcript (`mode_change`) | `goal` 도구 — **op 5종: get/create/complete/resume/drop** (`goals/tools/goal-tool.ts:18-25`; MOC의 3종 표기는 과소 — 정정) |
| Ultragoal durable | `.gjc/ultragoal/{brief.md, goals.json, ledger.jsonl}` (`ultragoal-runtime.ts:140-147`) | `gjc ultragoal …` CLI + skill |

### goals.json 스키마 (`ultragoal-runtime.ts:22-44`)

`UltragoalPlan{version, brief, gjcGoalMode: aggregate|per-story, gjcObjective, goals[], createdAt, updatedAt}` /
`UltragoalGoal{id: G00n, title, objective, status: pending|active|complete|failed|blocked|review_blocked|superseded, evidence?, steering?, completionVerification?}`

### ledger 이벤트 전수 (코드 기준)

| event | 위치 | 핵심 페이로드 |
|-------|------|---------------|
| `plan_created` | `:580` | goalIds |
| `goal_started` | `:633` | goalId |
| `goal_checkpointed` | `:1206-1215` | status, **evidence**, qualityGateJson?, completionVerification? |
| `steering_accepted` | `:1297-1303` | kind, evidence, rationale |
| `review_blockers_recorded` | `:1340` | blockerGoalId |
| `reconcile_failed` | `:1672` | (type 필드) error |

⚠️ `aggregate_objective_migrated`는 SKILL.md(:20)에만 있고 **코드 미구현** — [확정] M1 구현 제외 (인터뷰 260612 01:36).

### 프롬프트 주입

- `goal-mode-active.md`: 사용자 턴 직전, `goals/runtime.ts:407-410` → `agent-session.ts:4510-4520`
- `goal-continuation.md`: (A) idle 800ms 자동 `interactive-mode.ts:692-723` (B) agent 정지 시 reminder `agent-session.ts:6695-6714`
- ultragoal→goal mode 브릿지: `commands/ultragoal.ts:27-38` → `goal-mode-request.ts:82-106, 139-171`

## 2. 어휘 매핑 (확정)

| jwc 표면 | 엔진 매핑 |
|----------|-----------|
| `goal set <obj>` | `createUltragoalPlan({brief})` + `goal({op:"create"})` + pending request — plan 없으면 1스토리(G001) 생성 |
| `goal plan [hint]` | brief를 pending 상수로 설정 + `goalMode=plan` — continuation plan-mode 블록 포팅 (062 §4) |
| `goal refine <obj>` | `goals.json` `gjcObjective`/active story objective 갱신 + 세션 replaceGoal — plan 모드에서 direct 전환 |
| `goal status` (`show` 별칭) | `getUltragoalStatus` + `goal({op:"get"})` 합성 — active 1개 기본 뷰 |
| `goal update <summary> --evidence <…>` | `checkpointUltragoalGoal({status:"active", evidence})` — 중간 checkpoint는 **active 유지** (progress 상태 없음) |
| `goal done [note]` | checkpoint complete(+quality-gate) → `goal({op:"complete"})` — guard `ultragoal-guard.ts:281-290` |
| `goal cancel` (`drop` 별칭) | `checkpoint --status superseded` 또는 `goal({op:"drop"})` |
| `goal pause [--agent --audit <요약>]` | `GoalRuntime.pauseGoal()`(`goals/runtime.ts:348-363`) + **신규 2-pass 게이트** (§3.2) |
| `goal resume` | `goal({op:"resume"})` 1:1 |
| `goal history [limit]` | ledger.jsonl 조회 — 기본 limit 10, 최대 50 |

### 별칭 매핑 — slash ↔ CLI ↔ 엔진

| TUI `/goal` slash | `jwc goal` CLI | 엔진 goal 도구 op | ledger 이벤트 |
|-------------------|----------------|-------------------|---------------|
| `set` | `set` | `create` | `plan_created` (+ `goal_started` on first story) |
| `show` | `status` (별칭 `show`) | `get` | (조회 전용) |
| — | `plan` | `create` (pending brief) | `plan_created` |
| — | `refine` | (세션 goal replace + goals.json 갱신) | — |
| — | `update` | (checkpoint 호출 전제) | `goal_checkpointed` |
| — | `done` | `complete` (guard 통과 후) | `goal_checkpointed`(status=complete) |
| `drop` | `cancel` (별칭 `drop`) | `drop` | `goal_checkpointed`(status=superseded) 또는 세션 drop |
| `pause` | `pause` | (런타임 pause, op 없음) | `goal_pause_audited` (agent 2차) |
| `resume` | `resume` | `resume` | — |
| — | `history` | — | ledger read |

> 단일 엔진: `gjc-runtime/goal-runtime.ts`가 CLI·TUI 양쪽에서 호출. slash 별칭은 `interactive-mode.ts` `parseGoalSubcommand`/`#dispatchGoalSubcommand`에서 정규화 후 위임.

## 3. jaw 강점 3개 — 이식 지점

### 3.1 ① checkpoint evidence 의무 — **엔진에 이미 있음**, 어댑터에서 누락 차단만

- `ultragoal-runtime.ts:1143-1144`이 빈 evidence를 throw — cli-jaw보다 이미 엄격
- 어댑터(`goal-runtime.ts` 신규)는 `--evidence` 미지정 시 즉시 exit 1 (엔진 도달 전 명확한 usage 에러)
- evidence 복수 경로: cli-jaw 배열을 `'; '` join하여 ledger `evidence` 단일 문자열로 기록 — gjc 스키마 무변경 (062 §2)

### 3.2 ② AI 자발 정지 독립 감사 — **신규** (cli-jaw `routes/goal.ts:112-128`/`store.ts:192-204` 동형 2-pass)

| 레이어 | 변경 |
|--------|------|
| `gjc-runtime/goal-runtime.ts` (신규) | `pause --agent` 1차: `agentPauseCount` 증가 + audit checklist 주입, pause **미실행**. 2차(`--audit <요약>` 포함): pause 실행 |
| `goals/state.ts` | `GoalModeState`에 `agentPauseCount?`, `pauseAudit?: {actor, evidence, timestamp}` |
| ledger | 신규 이벤트 `goal_pause_audited{actor, evidence, reason}` |
| TUI `interactive-mode.ts:1742-1748` | agent-initiated pause 경로에 게이트 연결 (human pause는 비대상) |

### 3.3 ③ done = 완료 감사 후만 — **이중 게이트 기존재**, 어댑터가 순서 강제

```
jwc goal done
  ├─ (1) 마지막 goal_checkpointed evidence 존재 검사 (jaw parity)
  ├─ (2) checkpoint --status complete + quality-gate-json (orchestrate c 산출물 자동 연결 — §6-6)
  └─ (3) goal({op:"complete"}) — guard 통과 후만. --force는 human 전용 (agent는 guard가 항상 차단, goal-tool.test.ts:229-254)
```

## 4. 050 패턴 재사용 / 차이

- 재사용: `jawOnlyCommands` 게이트(`cli.ts:61-64`)에 `goal` 추가 · thin Command→runtime 위임(`commands/goal.ts`→`gjc-runtime/goal-runtime.ts`, `{stdout,stderr,status}` 계약) · 브랜드 분기 표면 테스트
- 차이: ultragoal은 **canonical workflow skill** — 050처럼 native 신설이 아니라 **기존 엔진 위 어댑터**. SKILL.md·goal 도구·guard·reconcile(`ultragoal-runtime.ts:1648-1676`)은 그대로 정본. jaw CLI는 syntax 정본을 대체하지 않음

## 5. 신규 파일

```
packages/coding-agent/src/commands/goal.ts            # jaw 전용, orchestrate.ts 미러
packages/coding-agent/src/gjc-runtime/goal-runtime.ts   # 동사→ultragoal+세션 goal 어댑터 + 2-pass pause 게이트
packages/coding-agent/test/gjc-runtime/goal-runtime.test.ts
```

완료 기준↔테스트: set→update(evidence)→done 사이클 / evidence 없는 update 거부 / `pause --agent` 무감사 거부(1차 카운트·2차 실행) / ledger에 `goal_checkpointed`·`goal_pause_audited` assert / `bun run check:ts` green.

## 6. [확정] 인터뷰 결정 (260612 01:36)

1. **`/goal` slash ↔ jaw CLI 통합** — 단일 엔진 공유, `show`→`status`·`drop`→`cancel` 별칭으로 TUI/CLI 어휘 양쪽 호환. 근거: 중복 엔진 방지 + D10 표면 일원화.
2. **`goal plan` 수용, `goal run`/goal-run M1 제외** — plan 모드 + pending brief 상수 + plan-mode 블록 포팅. budget 필드만 forward-compat. 근거: jwc는 dispatch 개념 부재.
3. **`done --force` human-only** — 기존 ultragoal guard·goal-tool 테스트 무변경 유지. 근거: agent 우회 차단은 검증된 기존 가드에 위임.
4. **중간 checkpoint status = `active` 유지** — `progress` 신규 상태 없음. 근거: ultragoal status enum과 정합, 불필요한 스키마 확장 회피.
5. **`aggregate_objective_migrated` 구현 제외** — SKILL.md 문서만 유지. 근거: 레거시 마이그레이션 우선순위 낮음.
6. **quality-gate-json** — `jwc orchestrate c` 산출물 자동 연결 기본, `--quality-gate-json` 플래그는 override. 근거: PABCD 워크플로와 자연 연결.

[기본값 확정, 결정 불요]: 멀티골 유지 + status는 active 1개 뷰 / jwc goal ↔ cli-jaw 인스턴스 goal 비공유(D6) / clear·reset 미노출.

## 7. 구현 모듈 (M) — 구현 결과 (260612 15:3x, 커밋 0207d326): M1-M3·M5-M7 ✅ / M4 ⬜(병렬 TUI 작업 종료 후)

구현 노트: done의 quality-gate 자동 연결 규약 = `.gjc/state/pabcd-quality-gate.json` 존재 시 자동, --quality-gate-json override. pause 게이트 영속 = `.gjc/state/goal-pause-gate.json` (세션 GoalModeState 필드는 M4에서 연결).

### M1. `gjc-runtime/goal-runtime.ts` (신규, ≤400줄)

- **대상**: `packages/coding-agent/src/gjc-runtime/goal-runtime.ts`
- **diff 방향**: 동사 파서 + ultragoal-runtime/goal-mode-request/GoalRuntime 위임. evidence `'; '` join. plan pending 상수. done 시 orchestrate c 산출물→quality-gate 자동 탐색. `{stdout,stderr,status}` 계약 (`orchestrate-runtime.ts` 미러).
- **의존**: ultragoal-runtime, goal-mode-request, goals/runtime, ultragoal-guard

### M2. `commands/goal.ts` + `cli.ts` 등록

- **대상**: `packages/coding-agent/src/commands/goal.ts` (신규), `packages/coding-agent/src/cli.ts:61-64`
- **diff 방향**: orchestrate.ts thin wrapper. `jawOnlyCommands`에 `{ name: "goal", load: … }` 추가. gjc 브랜드 미등록.
- **의존**: M1

### M3. `goals/state.ts` — 2-tap pause 상태 필드

- **대상**: `packages/coding-agent/src/goals/state.ts`
- **diff 방향**: `GoalModeState`에 `agentPauseCount?`, `pauseAudit?` 추가. `normalizeGoalModeState` 통과 보장.
- **의존**: 없음 (M1·M5 선행 병렬 가능)

### M4. TUI slash 별칭 + 단일 엔진 위임

- **대상**: `packages/coding-agent/src/modes/interactive-mode.ts:204-215, 1681-1698`, `packages/coding-agent/src/slash-commands/builtin-registry.ts:287-307`
- **diff 방향**: `GoalSubcommand`에 `status`/`cancel` 별칭(`show`/`drop` 정규화). 신규 동사는 M1 경유. `#pauseGoalAction`에 agent 2-pass 게이트 연결.
- **의존**: M1, M3

### M5. goal-continuation jaw 섹션 포팅

- **대상**: `packages/coding-agent/src/prompts/goals/goal-continuation.md`, `goal-mode-active.md` (085.5 하드 수정 원칙 [02:04 개정] — md 본문에 jwc 어휘 직접 기입, 브랜드 분기 불요)
- **diff 방향**: evidence 번들 3종·검증 티어·plan-mode 블록·2-tap 체크리스트·Stop Audit 섹션 추가 (062 §4 표 기준).
- **의존**: M3 (pause 카운터 주입)

### M6. ledger `goal_pause_audited` 이벤트

- **대상**: `packages/coding-agent/src/gjc-runtime/ultragoal-runtime.ts` (appendLedger 호출부) 또는 M1 내부 ledger writer
- **diff 방향**: agent 2차 pause 시 `goal_pause_audited{actor,evidence,reason}` append.
- **의존**: M1, M3

### M7. 테스트 — `test/gjc-runtime/goal-runtime.test.ts` (신규)

| 케이스 | 기대 |
|--------|------|
| `goal set` → `update --evidence` → `done` | ledger `goal_checkpointed` + 세션 goal complete |
| `update` without `--evidence` | exit 1, 엔진 미도달 |
| `pause --agent` 1차 | 카운터=1, pause 미실행, continuation 체크리스트 |
| `pause --agent --audit` 2차 | pause 실행 + `goal_pause_audited` |
| `show`/`drop` slash 별칭 | `status`/`cancel`과 동일 결과 |
| `goal plan` → `refine` | pending brief → direct objective |
| evidence 배열 3경로 | ledger 단일 문자열 `'; '` join |
| gjc 브랜드 | `jwc goal` 미등록 (기존 `gjc ultragoal` only) |

게이트: `bun run check:ts` + 기존 `goal-tool.test.ts:229-254` 무회귀.

## 8. 구현 순서·의존

1. M3 상태 필드 (독립)
2. M1 goal-runtime 핵심 + M6 ledger 이벤트
3. M2 CLI 등록
4. M4 TUI 별칭·게이트
5. M5 프롬프트 포팅
6. M7 테스트 + `check:ts` 게이트
