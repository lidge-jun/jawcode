# 062 — 스키마: cli-jaw goal 시스템 전수 (061 어댑터의 원본 계약)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 상위: [060_moc_goal_merge.md](./060_moc_goal_merge.md). 조사: CLI 서브에이전트 (260612 13:05, cli-jaw 소스 `/Users/jun/Developer/new/700_projects/cli-jaw` 기준 경로).
> 061이 gjc ultragoal **엔진** 실사였다면 062는 cli-jaw **goal 워크플로우** 전수 — D10(표면 동형)의 "동형"이 정확히 무엇인지 필드 단위로 고정. 인터뷰 확정: 260612 01:36.

## 1. GoalState 전체 스키마 (`src/goal/types.ts:24-43`)

```typescript
interface GoalState {
  id: string;                    // UUID.slice(0,12)
  objective: string;             // ≤10,000자 (MAX_GOAL_OBJECTIVE_CHARS)
  status: 'active'|'paused'|'blocked'|'complete'|'cancelled';
  goalMode?: 'direct'|'plan';    // plan = AI가 목표를 스스로 정련하는 모드
  planHint?: string;             // plan 모드 전용, refine 시 삭제
  createdAt; updatedAt;          // ISO
  repoRoot?; worklogPath?; currentPhase?;   // PABCD 연동 필드
  budget?: { maxTurns?; maxMinutes?; maxDispatches? };
  lastCheckpoint?: GoalCheckpoint;          // checkpoints 마지막과 동일 참조
  checkpoints: GoalCheckpoint[];
  pauseReason?; pauseAudit?: {actor:'agent'|'human', evidence, timestamp};
  cancelReason?; completionNote?;
  agentPauseCount?: number;      // 2-tap 게이트 카운터
}
interface GoalCheckpoint { summary; nextAction; evidencePaths: string[]; timestamp }
```

- 저장: `JAW_HOME/goal/active.json` + `history.json`(최대 50, FIFO) — tmp+rename 원자 쓰기 (`src/goal/store.ts:17-22,185-190`)
- plan 모드 흐름: `goal plan [hint]` → objective=`GOAL_PLAN_PENDING_OBJECTIVE` 상수 → continuation이 정련 지시 → `goal refine` 시 `goalMode='direct'`+planHint 삭제 (`store.ts:77-88`). **refine 전에는 checkpoint 차단** (409, `routes/goal.ts:73-76`)

### 061 대비 신규 발견 (어댑터 스키마 보강)

| 필드 | 061 현황 | 보강 |
|------|----------|------|
| `nextAction` | checkpoint에 없음 | ultragoal checkpoint payload에 대응 없음 — jwc `goal update --next "<...>"` 플래그로 수용 후 ledger payload 확장 [기본값 제안] |
| `goalMode: plan` + `refine` | 061 매핑에 refine은 있으나 plan 모드 생략 | [확정] `jwc goal plan [hint]` 수용 — ultragoal brief pending 상수 + plan-mode 블록 포팅 (인터뷰 260612 01:36) |
| `budget{maxTurns,maxMinutes,maxDispatches}` | 미채록 | [확정] goal-run M1 제외, `budget` 필드만 forward-compat — `maxDispatches` 제외 2종 (인터뷰 260612 01:36) |
| `blocked` status | 미채록 | ultragoal status에 `blocked`/`review_blocked` 기존재 — 매핑 가능 |
| history 50 cap | 미채록 | ledger는 무한 append — jwc `goal history` 기본 limit만 맞추면 됨 (조회 10, 최대 50) |

## 2. Evidence 계약 — "동형"의 핵심

- 수집: `--evidence "a,b,c"` → 콤마 분리 배열 (`bin/commands/goal.ts:143-149`); HTTP는 string|string[] 허용 (`routes/goal.ts:70-72`)
- **완료 게이트 술어** (`store.ts:215-217`): `lastCheckpoint.evidencePaths`에 trim 후 비어있지 않은 항목 ≥1 — 공백만 있는 배열은 거부. `done --force`는 human 수동 override 전용
- **evidence 번들 3종** (continuation 프롬프트 규정, `src/goal/heartbeat.ts:76`): Documentation(devlog/structure 경로) + Implementation(변경 소스/테스트 경로 또는 no-code 사유) + Verification(신선한 명령/테스트 출력) — **개발 goal의 모든 phase 게이트·최종 완료에 의무**
- 검증 티어 (`heartbeat.ts:79-82`): LIGHT(<5파일·<100줄: sub-agent 검증) / STANDARD(기본: 직원 검증+빌드) / THOROUGH(>20파일 또는 보안·아키텍처: 전체 리뷰+전체 테스트)

**ultragoal 대비**: gjc `goal_checkpointed.evidence`는 단일 문자열 — [확정] jwc 어댑터는 cli-jaw evidence 배열을 `'; '` join하여 ledger에 기록, gjc 스키마 무변경 (인터뷰 260612 01:36). 번들 3종·검증 티어는 ultragoal에 없음 → goal-continuation 프롬프트 포팅(§4)으로만 이식.

## 3. 2-tap pause 게이트 정밀 (061 §3.2의 원본)

`routes/goal.ts:112-145` + `store.ts:135-152`:

1. **agent 1차** (`agentPauseCount<1`): 카운터→1, **409 거부** "First agent pause attempt recorded (1/2). Pause NOT executed." + 다음 continuation에 감사 체크리스트 주입
2. **agent 2차** (`--audit` 필수): pause 실행 + `pauseAudit{actor,evidence,timestamp}` 기록. audit 없으면 무조건 409
3. human pause: 게이트 없음. 단 **non-TTY에서 plain pause는 CLI가 거부** (`bin/commands/goal.ts:133-136`) — AI가 human 경로로 우회 못 함
4. 카운터 리셋: 턴 경계가 아니라 goal 수명 주기 (set/done/cancel 시 `clearGoalTimers`+초기화)

감사 체크리스트 (continuation 주입분, `heartbeat.ts:132-152`): 요구사항별 PROVEN/UNPROVEN/CONTRADICTED 판정 + dev 게이트(신선 검증·import 안전·정적분석·500줄·원자 커밋) + 문서 증거 + **독립 리뷰어 파견 의무**. 061 §3.2의 jwc 게이트 설계는 이 체크리스트 본문을 그대로 이식 [기본값].

## 4. goal-continuation 프롬프트 구조 (jwc `prompts/goals/` 포팅 명세)

`src/goal/heartbeat.ts:18-173` `buildGoalContinuation()` — 사전조건 4종(활성 goal / updatedAt<3일 `STALE_GOAL_MS` / worker 비활성 / pending replay 없음) 통과 시 생성. 섹션 구성:

| 섹션 | 조건 | 내용 요지 |
|------|------|----------|
| 헤더 | 항상 | objective·last checkpoint·next action·goal ID·project root·PABCD state |
| 핵심 규칙 | 항상 | 매 마일스톤 `goal update --evidence` / 호스트 런타임 goal 기능 사용 금지 |
| Autonomy Override | 항상 | FULL AUTHORITY(파괴적 git 제외) / 허락 질문 금지 / DRIVE TO COMPLETION |
| Evidence 번들+티어 | 항상 | §2 참조 |
| Plan-Mode 블록 | goalMode=plan | 출처 3종(대화·메모리·repo) 분석→refine→orchestrate P, "Do NOT ask. YOU decide." |
| PABCD Override | PABCD 활성 | goal이 최상위 — ⛔ STOP 무시, 전이 명령 실행 의무, 전 phase 한 턴 관통 |
| Pause 게이트 체크리스트 | pauseCount≥1 | §3 참조 |
| Stop/Pause Audit | 항상 | 완료를 UNPROVEN으로 간주, 독립 리뷰어 의무, done은 유저 명시 요청 전용 |

- 크기 예산(테스트 고정): 기본 <5,500자, PABCD-B 포함 <6,800자 (`tests/unit/goal-prompt-single-owner.test.ts:49-68`)
- **출력 감지**: AI 출력에서 `goal done/cancel/pause` regex 매치 시 서버가 실행 — done은 evidence 게이트 통과 시만 (`src/agent/lifecycle-handler.ts:834-860`). jwc는 in-process라 regex 감지 불필요 — 도구 호출로 직결.

**gjc 대응물**: `prompts/goals/goal-continuation.md`+`goal-mode-active.md`(061 §1) — 구조 비교 후 누락 섹션(번들·티어·2-tap 체크리스트·Stop Audit)을 jaw 브랜드 분기로 추가하는 것이 061 §3의 구현 본체. gjc 브랜드 diff-0 원칙(085.5 L1과 동일 메커니즘).

## 5. goal-run 모드 (061 §6-2 확정)

`src/goal-run/types.ts:1-37`, `controller.ts:39-46`: `GoalRunMode = 'dry-run'|'assist'|'bounded'|'supervised'`, 기본 budget `{maxTurns:10, maxMinutes:60, maxDispatches:5}`, `GoalRunState{status: preflight|running|paused|stopped|completed|failed, gates: GoalRunSafetyGate[]}`. 연속 시도 상한 `GOAL_CONT_MAX_ATTEMPTS=20` (`lifecycle-handler.ts`).

**jwc 판정 [확정]**: M1 제외 (dispatches 개념 부재 + jwc는 대화형 단일 세션). `budget{maxTurns,maxMinutes}` 필드만 GoalState에 forward-compat 보존 (인터뷰 260612 01:36).

## 6. 어휘 매핑 보강분 (061 §2 표에 병합할 행)

| jwc 표면 | cli-jaw 원본 | 엔진 매핑 |
|----------|-------------|-----------|
| `goal plan [hint]` | `set`+goalMode=plan | [확정] ultragoal brief pending 상수 + plan-mode 블록 (인터뷰 260612 01:36) |
| `goal update --next "<a>"` | checkpoint.nextAction | ledger payload 확장 [기본값 제안] — M1 선택 구현 |
| `goal status` (`show` 별칭) | active 1 + budget + lastCheckpoint.nextAction | active 1개 기본 뷰 + nextAction 표시 |
| `goal history [limit]` | history.json 최근순, 기본 10 최대 50 | ledger 조회 limit 정합 |
| (없음 — jwc 미수용) | `goal clear`/`reset` | [확정] 미노출 — reset은 파괴적 (인터뷰 260612 01:36) |

## 7. [확정] 인터뷰 결정 (260612 01:36)

7. **`goal plan` 모드 수용** — ultragoal brief를 pending 상수로, plan-mode 블록 포팅 포함. 근거: cli-jaw plan 워크플로와 동형 UX.
8. **evidence 단수↔복수** — cli-jaw 배열을 `'; '` join한 단일 문자열로 ledger 기록, gjc 스키마 무변경. 근거: ultragoal-runtime checkpoint 계약 유지, 최소 diff.
