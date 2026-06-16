# Session / Storage

> 현재 jwc storage는 `~/.jwc/agent` 중심이다. D6에 따라 TUI와 cli-jaw Web 세션은 공유하지 않고, 공유 대상은 스킬과 OAuth다.

## 경로 소스

| 함수/상수 | 경로 | 의미 | 근거 |
|---|---|---|---|
| `CONFIG_DIR_NAME` | `.jwc` | config root 기본 이름. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:22` |
| `getConfigDirName()` | `JWC_CONFIG_DIR` 또는 `GJC_CONFIG_DIR` 또는 `PI_CONFIG_DIR` 또는 `.jwc` | env override 가능. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:92` |
| `getAgentDir()` | `~/.jwc/agent` | agent config dir. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:216` |
| `getProjectAgentDir(cwd)` | `<cwd>/.jwc` | project-local runtime/config root. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:221` |
| `getAgentDbPath(agentDir?)` | `~/.jwc/agent/agent.db` | settings/auth/model usage SQLite. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:380` |
| `getHistoryDbPath(agentDir?)` | `~/.jwc/agent/history.db` | prompt history SQLite. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:385` |
| `getSessionsDir(agentDir?)` | `~/.jwc/agent/sessions` | session files root. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:395` |
| `getMemoriesDir(agentDir?)` | `~/.jwc/agent/memories` state dir | memory artifacts root. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:430` |


## Workflow state reads (orchestrate · goal)

| 상태 | 경로 | 세션 스코프 읽기 | 프롬프트/TUI 소비 | 근거 |
|------|------|------------------|-------------------|------|
| IPABCD envelope | `<cwd>/.jwc/state/sessions/<encoded-session-id>/pabcd-state.json` (legacy: cwd 루트 unscoped 파일 — 신규 세션 주입에는 **미사용**) | `readPabcdState(cwd, sessionId?)` · live agent/TUI: `readPabcdStateWithFallback(cwd, sessionId)` — `sessionId` 있으면 scoped만 | 매 턴 `pabcd-stage-context` (`agent-session.ts`); status line `readPabcdSegmentState` | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:239`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:340`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/modes/components/status-line/workflow-readers.ts:10` |
| Goal plan/ledger | `<cwd>/.jwc/goal/goals.json`, `ledger.jsonl` | CLI·가드: `readGoalPlan` / `readGoalLedger` (`goal-engine.ts`); hooks: `readGoalVerificationState` | goal-mode 레일 + pabcd 헤더 objective 요약; `jwc orchestrate` 전이 시 `readGoalPlan`으로 체크포인트 (`orchestrate-runtime.ts`) | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/goal-engine.ts:429`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/goal-guard.ts:213`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:407` |

`jwc orchestrate` CLI는 `JWC_SESSION_ID`로 쓰기/읽기 세션을 자동 스코프한다 (`system-prompt.md:50`). 에이전트 매 턴 읽기는 `SessionManager.getSessionId()`와 동일 계약이다 (`agent-session.ts:4703`).
## `agent-storage.ts` (`agent.db`)

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| DB engine | `bun:sqlite` `Database` 사용. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:1` |
| schema version | `SCHEMA_VERSION = 5`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:25` |
| 저장 범위 | settings, model usage, auth credentials 통합 SQLite storage. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:32` |
| auth delegation | `SqliteAuthCredentialStore`가 같은 DB를 사용한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:64` |
| pragmas | WAL, synchronous=NORMAL, busy_timeout=5000. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:80` |
| tables | `model_usage`, `schema_version`, `settings`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:86`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:91`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/agent-storage.ts:100` |

## `auth-storage.ts`

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| 구현 위치 | credential storage types와 `AuthStorage`는 `@gajae-code/ai`에서 재수출된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/auth-storage.ts:1`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/auth-storage.ts:17` |
| SDK discovery | broker config가 있으면 `RemoteAuthCredentialStore`, 아니면 local SQLite `AuthStorage.create(dbPath)`를 사용한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:409`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:415`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:425` |
| D7 연결 | 기존 로컬 로그인 토큰을 jwc AuthStorage에 시딩하는 결정. | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:16` |

## `history-storage.ts` (`history.db`)

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| DB engine | `bun:sqlite` 사용. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:1` |
| table | `history(id, prompt, created_at, cwd)`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:90` |
| FTS | `history_fts` FTS5 virtual table, `content='history'`, `content_rowid='id'`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:98` |
| insert trigger | `history_ai` trigger가 insert 시 FTS row를 추가한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:100` |
| search query | FTS table join 후 `created_at DESC, id DESC` 정렬. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:120` |
| migration | legacy `unixepoch()` schema면 history/FTS를 재작성하고 rebuild. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:232`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:239`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/session/history-storage.ts:257` |

## Memories Runtime

| 항목 | 현재 구조 | 근거 |
|---|---|---|
| memory root | `getMemoryRoot(agentDir, cwd) = getMemoriesDir(agentDir) + encoded cwd`. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:1111` |
| enable flag | `memory.backend === "local"` 또는 `memories.enabled === true`일 때 enabled. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:1089` |
| stage1 defaults | concurrency 8, lease 120s, retry delay 120s. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:57`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:64` |
| phase2 defaults | lease 180s, retry delay 180s, heartbeat 30s. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:67` |
| startup order | `runMemoryStartup()`은 `runPhase1()` → `runPhase2()` → `refreshBaseSystemPrompt()` 순서. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:202` |
| phase1 | session threads 수집, stage1 jobs claim, model call, `stage1_outputs` 저장. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:214`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:229`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:250`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:311` |
| phase2 | cwd별 global job claim, stage1 outputs sync, consolidation model, artifacts apply. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:346`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:361`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:373`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:430` |
| **local-query / memory-fts** | `memories/local-query.ts` — LIKE+kind/recency 검색(`searchLocalMemories`), manual save(`saveLocalMemoryManual`), `buildLocalTaskSnapshot`; `memories/memory-fts.ts` — FTS5/LIKE 하이브리드 + synonym expansion. 99.01 완료 (260613). | `memories/local-query.ts`, `memories/memory-fts.ts` |
| **manual save** | `thread_id = "manual:<file>"`, `source_kind="manual"` — stage1 자동 추론 우회, phase2 cwd 조인으로 합류. 계약: [session_storage.md](./22_session_storage.md) §쓰기 경로. | `memories/local-query.ts` `saveLocalMemoryManual` |

> 메모리 서브시스템 전체 쓰기/읽기/CLI 표면 정본: [session_storage.md](./22_session_storage.md).

## Memory DB Schema

| Table | 컬럼/역할 | 근거 |
|---|---|---|
| `threads` | thread id, updated_at, rollout_path, cwd, source_kind. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:54` |
| `stage1_outputs` | thread별 raw_memory, rollout_summary, rollout_slug. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:62` |
| `jobs` | kind/job_key/status/worker/lease/retry/watermark. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:71` |
| global job key | phase2는 `global:${cwd}`로 cwd별 격리된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:39` |
| stage1 success | output이 있으면 `stage1_outputs` upsert 후 global watermark enqueue. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:327`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:339` |
| phase2 filter | consolidation input은 `t.cwd = ?`로 현재 cwd에 제한된다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:489`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/storage.ts:495` |

## cli-jaw 연동 판단

| 결정 | 현재 코드 상태 | M2 판단 |
|---|---|---|
| TUI/Web 세션 비공유 | jwc has own sessions/history under `~/.jwc/agent`; D6은 cli-jaw Web 세션 정본을 jaw.db로 둔다. | session adapter는 search federation만 후순위로 붙인다. 근거: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:15`, `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:18` |
| OAuth 공유 | `AuthStorage` 주입이 SDK에 있다. | local token seeding bridge는 `discoverAuthStorage()` 또는 host-created `AuthStorage`로 들어간다. 근거: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:225`, `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/sdk.ts:409` |
| memory 통합 | current memory root는 `~/.jwc/agent/memories/<encoded-cwd>`. | 070 밴드에서 jwc memory 폴더 규약을 확정한다. 근거: `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/memories/index.ts:1111`, `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:19` |


---

# (merged) Memory Pipeline


---

## Memory Pipeline

> jwc 메모리 서브시스템의 쓰기/읽기 경로와, 99.01 밴드(`jwc memory` 동사 표면)가 얹힐 접합점.
> cli-jaw 원본 메모리의 대조 요약 포함. 실측: 260612 병렬 조사 (devlog [99.01.00](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.01.00_moc_memory.md) 밴드 근거).

### 쓰기 경로 (자동 — startup 트리거 단일)

```text
세션 부팅 (sdk.ts:2078 resolveMemoryBackend(settings).start)
  -> startMemoryStartupTask (memories/index.ts:120)         [게이트: enabled && taskDepth==0]
     -> Phase 1: runPhase1 (index.ts:214)
        collectThreads(세션 *.jsonl 스캔) -> upsertThreads -> claimStage1Jobs(원자 클레임)
        -> 모델 호출(stage1 추출) -> stage1_outputs upsert + enqueueGlobalWatermark
        [대상: idle ≥12h, ≤30d, source_kind cli|app, 현재 스레드 제외]
     -> Phase 2: runPhase2 (index.ts:346)                    [per-cwd "global:<cwd>" 잡, watermark dirty 시]
        listStage1OutputsForGlobal -> consolidation 모델 호출
        -> MEMORY.md / memory_summary.md / skills/ 산출 (artifacts)
     -> session.refreshBaseSystemPrompt() (index.ts:211)
```

- **트리거는 startup뿐** — 타이머/세션 종료 훅/토큰 임계 없음. `/memory enqueue`가 `forceDirtyWhenNotAdvanced`로 강제 dirty.
- 저장소: `agent.db` (settings와 동일 DB) — `threads` / `stage1_outputs` / `jobs` 3테이블. 아티팩트는
  `<agentDir>/memories/state/--<cwd-encoded>--/` (`dirs.ts:434 getMemoriesDir`).
- manual save 계약(99.01 D3): `thread_id = "manual:<file>"` 행 + `threads.source_kind="manual"` —
  `claimStage1Jobs`가 cli|app만 클레임하므로 stage1 추론을 자연 우회, phase2에는 cwd 조인으로 합류.

### 읽기 경로 (주입)

```text
sdk.ts:1570 buildDeveloperInstructions
  -> buildMemoryToolDeveloperInstructions (memories/index.ts:150)
     -> memory_summary.md 읽기 -> truncateByApproxTokens(5000) -> read-path 템플릿 렌더
  -> appendSystemPrompt (sdk.ts:1603, base system prompt 마지막 세그먼트)
```

- 리프레시 시점: 세션 부팅 풀 리빌드 + `refreshBaseSystemPrompt()` 호출처(startup 완료 후, `/memory clear`, `/memory enqueue`).
- **검색/조회**: `memories/local-query.ts` + `memory-fts.ts` (FTS5/LIKE, synonym expansion) — `jwc memory *`, per-turn Task Snapshot (`buildLocalTaskSnapshot`). 밴드 **99.01** 마감·테스트·cli-jaw BM25/RRF 후속.

### 99.01 접합점 (신규 코드 vs 재사용)

| 동사 | 신규 코드 | 재사용 배관 |
|------|----------|------------|
| `memory search` | `memories/local-query.ts` `searchLocalMemories` — LIKE + kind 가중 + recency | `openMemoryDb`, `getMemoryRoot`, `listStage1OutputsForGlobal` |
| `memory read` | ref 어휘 디스패치 (summary/memory/raw/stage1:/rollout:) | 동일 |
| `memory save` | manual stage1_outputs 직접 SQL (`markStage1SucceededWithOutput`은 잡 토큰 필요라 부적합) | `upsertThreads`, `enqueueGlobalWatermark`, `refreshBaseSystemPrompt` |
| `memory context` | 현 주입 페이로드 + rollout 역참조 | `buildMemoryToolDeveloperInstructions` |
| `chat search` | 세션 jsonl 본문 grep (기존엔 헤더 1줄만 읽음) | `getSessionsDir`, `collectThreads` 포맷 |
| 라우터/CLI | `gjc-runtime/memory-runtime.ts` + `commands/memory.ts`·`chat.ts` (state.ts 패턴) | `cli.ts` jawOnlyCommands 등록 |

### cli-jaw 원본 대조 (parity reference)

| 축 | cli-jaw | jwc 1차 결정 |
|----|---------|--------------|
| 저장 | `JAW_HOME/memory/structured/` markdown + frontmatter(kind/source/trust) | upstream SQLite 엔진 그대로 (md 호환 레이어 없음 — 070 확정 1) |
| 색인 | `index.sqlite` FTS5 2종 — `chunks_fts`(unicode61) + `chunks_trigram`(trigram, CJK 전담) + `memory_synonyms` | 1차 SQL LIKE (FTS5/RRF/CJK trigram 후속 — 070 확정 4) |
| 랭킹 | BM25 + trigram RRF 융합(k=60) + kind 우선치(profile -4.0 … episode 0) + recency 반감기(episode 7d/semantic 30d/shared 90d) + 정확일치 보너스 | kind 우선치 + recency 2요소만 |
| 주입 | 매 턴 `buildMemoryInjection` — Profile(800c) + Soul(1000c) + Task Snapshot(검색 4건/2800c, kind 다양화 캡) | summary 1파일 (Task Snapshot은 99.01 M6) |
| 쓰기 파이프라인 | flush(서브에이전트가 episodes/live에 기록, 10메시지마다) + reflect(24h 스로틀 regex 분류) | 비이식 (upstream stage1/phase2 유지 — 070 확정 7) |
| chat search | `jaw.db` messages LIKE (FTS 없음, 활성 세션 한정) | 세션 jsonl grep — 세션 횡단이라 오히려 넓음 |

**degradation 핵심 (1차 LIKE 채택 시 잃는 것)**: CJK trigram 매칭, BM25 관련도, 동의어 확장
(`pabcd ↔ plan/audit/build/check/done` 시드 포함), RRF 융합. 후속 FTS5 도입 시 trigram tokenizer는
SQLite 3.38+ 필요. recency 부스트는 파일명 `YYYY-MM-DD` 규약 의존 — jwc는 generated_at 컬럼으로 대체 가능.

### 관련 문서

- 설계/스키마: `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.01.01_design_memory_merge.md`, `99.01.02_schema_cli_jaw_memory.md`
- 주입 레일 전반: [prompt_flow.md](./20_prompt_flow.md) §매 턴 주입 레일


---

# (merged) Todo Pipeline


---

## Todo pipeline (`todo_write` · 세션 · TUI)

> `todo_write` 도구 → `AgentSession.#todoPhases` → composer 클러스터 `todoContainer` 렌더.  
> 활성 개선: [99.30.01](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.30.01_plan_todo_done_collapse.md) (전부 `completed` 시 패널 접힘 + stop 리마인더 `done` ops).

### 소유 경계

| 층 | 99 밴드 / 문서 | 비고 |
|----|----------------|------|
| 도구 스키마·ops | 내장 `TodoWriteTool` | executor 서브에이전트에서 `todo_write` 제거 가능 |
| 세션 상태·stop 리마인더 | `agent-session.ts` | `#checkTodoCompletion` — **미완료만** auto-continue |
| TUI 패널 (기능) | `interactive-mode.ts` `#renderTodoList` | **99.30** — 접힘·요약 행 |
| TUI 레이아웃 (083.7) | `ViewportFill` + composer 클러스터 | **99.09/083.7** — 바닥 고정; todo 높이는 스페이서가 흡수 |
| 프롬프트 삽입 | `prompt_flow.md` 레일 #9 (본 문서) | `eager-todo`·plan-mode·도구 md |
| 대조 스냅샷 | `struct_har/jwc_patched/080_tui/` | TUI 밴드 앵커 |

**99.20(UI/UX)** 와 구분: 99.30은 **상태·리마인더·접힘 규칙**; 99.20은 신규 인터랙션 문법·ask 등.

---

### 데이터 모델

| 타입 | 필드 | 근거 |
|------|------|------|
| `TodoStatus` | `pending` \| `in_progress` \| `completed` \| `abandoned` | `packages/coding-agent/src/tools/todo-write.ts` |
| `TodoItem` | `content` (식별자), `status`, optional `notes[]` | 동일 |
| `TodoPhase` | `name`, `tasks[]` | 동일 |

식별: **task = `content` 문자열** (자동 id 없음). `todo-write.md` 도구 설명이 정본.

---

### 상태 소스 (진실의 우선순위)

```text
todo_write 성공 → AgentSession.setTodoPhases(details.phases)
       ↓
getTodoPhases()  ← interactive-mode #loadTodoList
       ↓
#renderTodoList → todoContainer (Text)

/todo 슬래시·user edit → setTodoPhases + appendCustomEntry(USER_TODO_EDIT_CUSTOM_TYPE)
       ↓
getLatestTodoPhasesFromEntries(branch)  ← 재개 시 completed/abandoned 보존
```

| API | 역할 | 근거 |
|-----|------|------|
| `getTodoPhases()` / `setTodoPhases()` | 인메모리 캐시 | `agent-session.ts` ~5473 |
| `getLatestTodoPhasesFromEntries` | 세션 JSONL 브랜치에서 최신 phases | `todo-write.ts` |
| RPC `set_todos` | bridge 클라이언트 동기화 | `command-dispatch.ts` |
| `bridge-client setTodos` | 원격 세션 | `packages/bridge-client/src/commands.ts` |

`DEVELOPMENT.md`의 `todos.json` 언급은 레거시 표기 — 현행은 **세션 엔트리 + 인메모리** (`todo-command-controller.ts` 주석).

---

### `todo_write` 실행 경로

1. `TodoWriteTool.execute` — `applyParams` → `setTodoPhases`  
2. `agent_end` / tool_result: `toolName === "todo_write"` && `details.phases` → `setTodoPhases`  
3. 실패 시 `sendCustomMessage` system-reminder (재시도 유도) — `agent-session.ts` ~2014  

렌더: `todoWriteToolRenderer` (채팅 내 도구 행), 별도 `todoContainer` (composer 위 HUD).

---

### Stop · 리마인더 (`#checkTodoCompletion`)

| 조건 | 동작 |
|------|------|
| `todo.enabled` && `todo.reminders` | 리마인더 활성 |
| 마지막 assistant **toolCall 없음** (final stop) | 체크 실행 |
| `pending` \| `in_progress` 잔존 | `developer` 메시지 + `todo_reminder` 이벤트 + `#scheduleAgentContinue` |
| incomplete 0 (전부 `completed`/`abandoned`) | 리마인더 **없음**, `#todoReminderCount` 리셋 |

설정: `todo.reminders.max` (기본 3). 이벤트: `TodoReminderComponent` → `chatContainer` (스크롤 영역 알림).

**갭 (99.30.01 M1)**: 리마인더에 `{"op":"done","task":"…"}` 예시 없음. UI 길게 펼침은 **M2 ✅ 완료**(`a7543582`).

---

### Eager init (`todo.eager`)

| 설정 | 기본 | 효과 |
|------|------|------|
| `todo.eager` | `false` | 사용자 프롬프트마다 `toolChoice: todo_write` + `eager-todo.md` prelude |
| `todo.enabled` | `true` | 도구·리마인더 마스터 스위치 |

`#createEagerTodoPrelude`: 기존 phases 있으면 스킵 (`getTodoPhases().length > 0`). 테스트: `agent-session-eager-todo.test.ts`.

---

### TUI (`interactive-mode.ts`)

| 멤버 | 역할 |
|------|------|
| `todoContainer` | `statusContainer` 아래 composer 클러스터 (083.7 D1) |
| `todoExpanded` | 사용자 토글; 기본 `false` |
| `#renderTodoList` | collapsed = 활성 페이즈 최대 5 task + 헤더 (**완전 접힘 아님**) |
| `#getActivePhase` | pending/in_progress 페이즈 → 없으면 **마지막 페이즈** |
| `toggleTodoExpansion` | 키바인드 → `todoExpanded` flip |

**99.30.01 M2 ✅ 완료 (`a7543582`)**: 세션 상태가 **전부 `completed`**(또는 terminal `abandoned`만)일 때 **hermes식 1줄 영수증 접힘** — [99.30.01 M2 플랜](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.30.01_plan_todo_done_collapse.md).

참조 UI: `~/Developer/codex/hermes-agent/ui-tui/src/components/todoPanel.tsx` (`▸ Todo (done/total)`, `!effectiveCollapsed`일 때만 본문).

---

### 프롬프트 레일 (`prompt_flow.md` 교차)

| # | 트리거 | 내용 |
|---|--------|------|
| 9 | `todo.eager` + 신규 phases 없음 | `eager-todo.md` prelude + named tool choice |
| — | plan mode | `plan-mode-approved.md` — step마다 `todo_write` |
| — | tool md | `prompts/tools/todo-write.md` |
| — | stop incomplete | `#checkTodoCompletion` `<system-reminder>` (in-band) |

99.03 시스템 re-facing과 **독립** — todo 규칙은 도구 md + 99.30 M1에서 보강.

---

### 테스트 앵커

| 파일 | 검증 |
|------|------|
| `test/tools/todo-write.test.ts` | ops 적용 |
| `test/agent-session-auto-compaction-queue.test.ts` | `todo_reminder` + continue |
| `test/agent-session-eager-todo.test.ts` | eager prelude |
| `test/agent-session-new-session-todos.test.ts` | newSession/branch 시 phases 클리어 |

---

### struct_har · fork-delta

| 문서 | 내용 |
|------|------|
| `struct_har/jwc_patched/080_tui/02_code_facts.md` | todo 관련 path 행 |
| `structure/40_fork-delta.md` §TUI | `interactive-mode.ts` HARD-EDIT (083.7); 99.30은 동일 파일 추가 편집 예정 |
| `080_moc_tui.md` | TUI 밴드; todo UX는 99.30으로 추적 |

구현 후: `fork-delta.md` 한 줄 + `struct-har-regenerate` 080 앵커에 `todo-write.ts` 선택 반영.

---

### 동기화 (INDEX 규칙)

| 변경 | 갱신 |
|------|------|
| `#checkTodoCompletion` / 리마인더 문구 | 본 문서 §Stop, `prompt_flow.md` #9, `99.30.01` |
| `#renderTodoList` / 접힘 설정 | 본 문서 §TUI, `struct_har/080_tui`, `fork-delta` |
| `settings-schema` `todo.*` | 본 문서 §설정, `extensibility.md` (도구 표면) |
