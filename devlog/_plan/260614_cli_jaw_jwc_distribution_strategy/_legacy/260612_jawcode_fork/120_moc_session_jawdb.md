# 120 MOC — 세션 영속화 (resume/steer 재발명)

> 📐 상세 설계: [111_design_runtime_attach.md](./111_design_runtime_attach.md) §4 — steer/followUp = `session.prompt(streamingBehavior)` (kill-respawn 소멸 확정 근거).

> 상태: ⬜. 결정 근거: D6 [확정] — 임베디드 런타임 세션 정본 = jwc SessionManager JSONL 파일. 구 02 §세션 승계.

> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)**. 코드 앵커 전수 재실사. "jaw.db 정본" 표현은 cli-jaw
> `jaw.db orc_state` 혼동 위험이 있어 이 문서 내에서 **jwc 세션 파일 + SessionManager** 로 구분 표기.

---

## 왜 이게 필요한가 — 현재 문제

cli-jaw는 현재 jwc(jawcode) 세션 히스토리를 직접 관리하지 못한다. 두 가지 골칫거리가 있다.

1. **resume** — `src/agent/resume-classifier.ts`, `session-persistence.ts`, `spawn/resume.ts`로 이어지는 벤더 CLI 세션 ID 역추적 체인. AGY 리베이스 이후 stale continuation·trace 누출 버그가 반복되었고, in-process 전환 이후엔 이 레이어 전체가 불필요해진다.
2. **steer** — `steerAgent()` (cli-jaw `spawn.ts:489`)는 kill-respawn 패턴: `killActiveAgent('steer')` → `waitForProcessEnd` → 새 spawn. 살아있는 에이전트 루프에 메시지를 직접 밀어넣는 API가 없어서 구조적으로 컨텍스트가 단절된다.

목표는 두 경로를 **in-process SDK로 교체**해 단절을 없애는 것이다.

---

## 목표 모델 (in-process 전환 후)

| 동작 | 현행 (spawn-parse) | 목표 (in-process) |
|------|-------------------|-------------------|
| **resume** | 벤더 session-ID 역추적 (`resume-classifier.ts`) | jwc SessionManager 파일 로드 → `createAgentSession` 메시지 복원 |
| **steer** | `steerAgent()` kill-respawn 왕복 | `session.prompt(text, { streamingBehavior: "steer" })` — 살아있는 루프에 push |
| **followUp** | 없음 (큐잉 없음) | `session.prompt(text, { streamingBehavior: "followUp" })` |

---

## 핵심 코드 앵커 (260613 실측)

### jwc SessionManager (세션 영속화 본체)

| 항목 | 위치 | 내용 |
|------|------|------|
| `SessionManager.create` | `packages/coding-agent/src/session/session-manager.ts:3584` | 새 세션 생성, 기본 디렉터리 `~/.jwc/agent/sessions/<encoded-cwd>/` |
| `SessionManager.continueRecent` | `session-manager.ts:3648` | 터미널 breadcrumb → 가장 최근 JSONL 세션 자동 재개 |
| `SessionManager.getDefaultSessionDir` | `session-manager.ts:3571` | `computeDefaultSessionDir(cwd, storage, getSessionsDir(agentDir))` |
| `getSessionsDir(agentDir?)` | `packages/utils/src/dirs.ts:399` | `~/.jwc/agent/sessions` |
| `getAgentDir()` | `dirs.ts:220` | `~/.jwc/agent` |
| `CONFIG_DIR_NAME` | `dirs.ts:26` | `".jwc"` (하드코딩 고정) |
| `getAgentDbPath` | `dirs.ts:384` | `~/.jwc/agent/agent.db` (설정·인증 SQLite) |
| `getHistoryDbPath` | `dirs.ts:389` | `~/.jwc/agent/history.db` (프롬프트 히스토리 SQLite) |

> **중요**: 구 계획에 등장하는 "jaw.db 정본" 표현은 cli-jaw의 `jaw.db orc_state` 테이블(`cli-jaw/src/core/db.ts:83`)과 혼동된다. jawcode 측 세션 정본은 **JSONL 파일** (`*.jsonl`, SessionManager 관리) 이며, SQLite는 `agent.db`(인증/설정)과 `history.db`(프롬프트 FTS)뿐이다. 이하 "세션 파일 정본"으로 통일.

### 세션 복원 경로 (`createAgentSession`)

```
sdk.ts:877  sessionManager = SessionManager.create(cwd, SessionManager.getDefaultSessionDir(cwd, agentDir))
sdk.ts:913  existingSession = deobfuscateSessionContext(sessionManager.buildSessionContext(), obfuscator)
sdk.ts:916  existingBranch = sessionManager.getBranch()  → hasExistingSession
sdk.ts:1904 if (hasExistingSession) { agent.replaceMessages(existingSession.messages) }
```

resume 복원은 **SessionManager가 파일을 찾아 메시지를 불러오는 것**으로 완결된다. cli-jaw `resume-classifier.ts`는 이 경로에서 완전히 우회 가능하다.

### steer/followUp API

```typescript
// agent-session.ts:4588  AgentSession.prompt(text, options)
// agent-session.ts:440   PromptOptions.streamingBehavior?: "steer" | "followUp"
// agent-session.ts:1215  steer: msg => session.agent.steer({ ... })
// agent-session.ts:1187  injectStreaming: message => this.agent.followUp(message)
```

steer는 살아있는 루프에 메시지를 inject하는 구조이며, `isStreaming === true`일 때 `streamingBehavior` 미지정 시 `AgentBusyError`를 던진다. JawRuntime에서 steer 호출 전 상태 확인이 필요하다.

### 컴팩션 경계

jwc 자체 컴팩션은 `AgentSession` 내 auto-compaction 루프(`agent-session.ts` `#compactionAbortController`)에서 자율 실행된다. cli-jaw의 `/compact` 핸들러(`cli-jaw/src/cli/compact.ts`)는 별도 bootstrap 모델 호출 방식이다. 두 경로는 **구조적으로 다른 레이어**이므로 충돌 지점은 "jwc 세션이 컴팩션을 수행하는 동안 cli-jaw가 `/compact`를 호출하는 타이밍"이다. M2에서는 jwc 자체 컴팩션 우선, cli-jaw compact 핸들러는 jwc 세션에 위임하는 방식으로 조정.

---

## 스코프 (실행 순서)

### Phase 1 — 세션 파일 정본 계약 확립 (110 P와 병행)

1. `JawRuntime` 싱글톤이 `SessionManager.create` 또는 `SessionManager.continueRecent` 중 어느 진입을 쓸지 결정
   - **기본값**: `continueRecent` — 서버 재시작 후 마지막 세션 자동 재개
   - `--fresh` 옵션: `SessionManager.create` 강제 신규
2. `agentDir` 주입 계약 확립:
   - cli-jaw JawRuntime → `createAgentSession({ agentDir: getAgentDir() })` — 경로 `~/.jwc/agent`
   - 111 §D1: `agentDir = ~/.jwc/agent` 이미 기본값이므로 명시 주입은 선택이지만 **명시 권장** (다중 인스턴스 `.cli-jaw-34xx` 격리)

**Phase 1 AC**

```bash
# 서버 재시작 후 세션 연속성
bun run dev &  # cli-jaw 서버 기동
curl -X POST localhost:{PORT}/api/chat -d '{"message":"hello"}' # 대화 1
pkill -f "bun.*cli-jaw" && bun run dev &  # 재시작
curl -X POST localhost:{PORT}/api/chat -d '{"message":"이전 내용 기억해?"}' # 연속성 확인
# 기대: 이전 메시지 컨텍스트 포함 응답
```

### Phase 2 — resume: 세션 복원 경로 (`cli='jwc'` 시 classifier 우회)

1. `spawn.ts:774` `cli = resolveMainCli(...)` 가 `'jwc'`를 반환하는 경로에서 NDJSON 파싱 스택 전체(`dispatchNdjsonLine → discriminate → extractFromEvent`)를 스킵
   - `discriminate()` (`cli-events.ts:150`)는 현재 `'jwc'` 케이스 없음 → `null` 반환 → 무해하게 무시 가능
   - `resume-classifier.ts`, `session-persistence.ts`, `spawn/resume.ts`는 `cli='jwc'` 분기에서 **진입 자체를 막는 guard 삽입** 위치: Phase 1에서 확인한 `spawnAgent` 분기점
2. 대신 JawRuntime이 `SessionManager.continueRecent`로 메시지 복원 → `createAgentSession` 내부에서 `agent.replaceMessages` 호출
3. **메시지 단위 커밋 정책**: 스트리밍 중간은 메모리만 유지, `agent_turn_end` 이벤트 수신 후 1회 파일 기록 (AGY 진행문 저장 버그 교훈)

**Phase 2 AC**

```bash
# 이전 대화 raw/tracker 누출 0건 검증
bun test packages/coding-agent/test/session-manager-*.test.ts
# jwc 경로 e2e: session 파일 생성 + 재시작 후 내용 연속성
```

### Phase 3 — steer: 살아있는 루프에 주입

1. cli-jaw `/steer` 엔드포인트(`handlers-runtime.ts:234`)가 JawRuntime을 경유하도록 라우팅
2. JawRuntime `steer(text)` → `session.prompt(text, { streamingBehavior: "steer" })`
   - isStreaming 상태 확인 필수: 스트리밍 중이 아니면 일반 `prompt()`로 폴백
3. steerAgent kill-respawn 경로는 `cli='jwc'`일 때 **분기 차단** (cli-jaw `spawn.ts:489` 진입 전)

**Phase 3 AC**

```bash
# 실행 중 steer 주입 → kill 없이 반영 e2e
curl -X POST localhost:{PORT}/api/steer -d '{"message":"방향 전환: 한국어로만"}'
# 기대: 현재 스트리밍 중 방향 변경, 새 프로세스 spawn 없음
# isAgentBusy()가 계속 true 유지 (kill 없음) 검증
```

### Phase 4 — 컴팩션 핸드오프 중복 방지

1. JawRuntime이 `auto_compaction_start/end` 이벤트를 cli-jaw `broadcast()`로 중계
2. cli-jaw `/compact` 핸들러는 jwc 세션이 없거나 busy 아닐 때만 자체 bootstrap 방식 실행
3. 기본값: jwc 자체 컴팩션 우선, cli-jaw compact는 위임 호출

---

## 영속 계약 시뮤 (persist-contract shims) — gjc→jwc 플립 반영

jwc 세션 파일·상태 파일에는 260613 플립 이전에 `gjc-*` 소유자 문자열이 기록된 데이터가 잔존한다. 다음 shim이 이를 커버한다:

| 파일 | 정규화 위치 | 내용 |
|------|-----------|------|
| `skill-active-state.json` / `*-state.json` 의 `owner` 필드 | `state-schema.ts` `ownerEnum` (z.preprocess) | `gjc-*` → `jwc-*` 치환 (read 경로) |
| `workflow-state-contract.ts:LEGACY_WORKFLOW_STATE_OWNER_ALIASES` | `normalizeWorkflowStateOwner()` | `jwc-state-cli / jwc-runtime / jwc-hook` 정규화 |
| `ultragoal goals.json` — `gjcGoalMode`, `gjcObjective` 필드 | `ultragoal-runtime.ts:normalizePlan()` (L395-398) | `jwcGoalMode ?? gjcGoalMode`, `jwcObjective ?? gjcObjective` read-both |
| 영속 receipt의 `owner` write-side | `state-migrations.ts:receiptWithRequiredFields` | `legacy gjc-era owners → jwc-*` (260613 flip 주석 있음) |
| `state-migrations.ts:normalizeLegacyState` | L80 | 알 수 없는 owner 값은 CLI owner(`jwc-state-cli`)로 reset |

이 shim들은 **세션 영속화 범위와 직접 관련 있다**: 서버 재시작 후 구버전 `.jwc/state/**` 파일을 읽을 때 구 `gjc-*` 소유자가 정규화된다. JawRuntime `resume` 경로에서 이 파일들을 읽는 타이밍(SessionManager 로드 vs 스킬 상태 로드)을 맞춰야 한다.

---

## 리스크 테이블

| # | 위험 | 내용 | 완화 |
|---|------|------|------|
| R1 | **SessionManager 파일 vs `history.db` 중복** | `~/.jwc/agent/history.db`는 프롬프트 FTS, JSONL 파일은 풀 메시지 그래프. resume는 JSONL만 쓰므로 중복 아니지만 누락 오해 발생 가능 | 코드 주석 + 이 문서로 명확히 구분 |
| R2 | **`steer` 타이밍 경쟁** | `isStreaming === false`인데 steer 호출 시 `AgentBusyError` 대신 일반 `prompt()`로 폴백해야 함 | JawRuntime steer wrapper에 상태 분기 추가 |
| R3 | **컴팩션 이중 실행** | jwc auto-compaction 중 cli-jaw `/compact` 동시 호출 | busy 게이트로 cli-jaw compact 진입 차단 |
| R4 | **다중 인스턴스 경로 혼용** | `.cli-jaw-34xx`처럼 port별 인스턴스가 같은 `~/.jwc/agent` 경로 공유 시 세션 충돌 | `agentDir` 명시 주입 + 인스턴스별 disjoint agentDir 정책 (111 §6) |
| R5 | **persist-contract shim 누락** | resume 후 구 `gjc-*` owner 받아서 write가 실패 | state-schema.ts ownerEnum 정규화 + state-migrations.ts 검증 — shim 표 참조 |
| R6 | **`Bun.sleep` 잔존 (100 포팅 의존)** | `sdk.ts:1064 Bun.sleep(STARTUP_SCAN_DEADLINE_MS)` — Node 환경 cli-jaw에서 실행 시 크래시 | 100 밴드 셰임 목록에 추가; 120 착수 전 100 완료 필요 |
| R7 | **`isAgentBusy()` 경로 격차** | cli-jaw `isAgentBusy()` = `!!activeProcess || queueCtrl.isRetryPending() || mainSpawnStarting || steerInProgress` — in-process 경로는 `activeProcess === null` | JawRuntime용 busy 플래그 별도 관리; gateway.ts가 이를 인식하도록 수정 (111 §착수 전 열린 질문 3 승계) |

---

## 완료 기준 (AC)

| # | 검증 | 명령 / 시나리오 |
|---|------|----------------|
| AC1 | 서버 재시작 후 이어서 대화 (내용 연속성) | Phase 1 AC 시나리오 통과 |
| AC2 | steer 주입 → kill 없이 반영 | Phase 3 AC 시나리오; `isAgentBusy()` 계속 `true` 확인 |
| AC3 | raw/tracker 누출 0건 | AGY 회귀 케이스 테스트 승계 (`bun test packages/coding-agent/test/session*`) |
| AC4 | 구 gjc-era 세션 파일 → 정상 resume | 플립 이전 `.jwc/state/*.json` 파일로 서버 기동 + 스킬 상태 정상 로드 |
| AC5 | 컴팩션 이중 실행 없음 | jwc auto-compaction 중 `/compact` 호출 → busy 응답, 새 컴팩션 미기동 |

---

## 열린 질문 [확정 대기]

1. **SessionManager 진입 전략**: `continueRecent` 기본값으로 확정? 아니면 cli-jaw 서버가 세션 ID를 명시 전달하는 방식? (멀티 채팅 탭 시나리오 영향)
2. **메시지 커밋 타이밍 세부**: `agent_turn_end` 기준인지, 도구 결과 포함 여부, 중간 thinking block 저장 정책
3. **히스토리 길이 한계와 로드 페이징**: `SessionManager.continueRecent`는 전체 JSONL을 메모리에 올림 — 긴 세션 페이징 정책 미결
4. **`jaw.db orc_state`와의 명칭 혼동 방지**: cli-jaw `jaw.db`는 PABCD boss 상태 정본이고, jwc 세션 파일은 별도. 팀 문서 전수 수정 필요 여부
5. **`Bun.sleep` 및 `bun:sqlite` 셰임 완료 시점**: 100 포팅 밴드가 완료되어야 120 착수 가능 — 100 타임라인 확인

## 세부 실행 문서 (260613 구체화)

- [120.1_plan_session_persistence_adapter.md](./120.1_plan_session_persistence_adapter.md) — **이중 정본 분리**(엔진 JSONL / UI jaw.db), SessionManager 주입(안 A), resume guard·steer 라우팅 (098 120.1~120.5 매핑)
