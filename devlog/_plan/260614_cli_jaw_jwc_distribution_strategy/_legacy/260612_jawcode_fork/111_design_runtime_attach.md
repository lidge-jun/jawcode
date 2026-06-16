# 111 — 설계: cli-jaw에 jwc 런타임 부착 (M2 100–130 통합 설계)

> M2 착수 전 정본 설계 (260612 05:20, 사용자 지시). 각 밴드 P에서 diff 레벨로 구체화.
> 구조: D1(2-제품) — cli-jaw 서버가 `jwc/sdk`를 import해 상주. spawn/resume 계층 소멸이 목적.
> **260612 실측 보강**: §착수 전 실측 보강 추가됨 — attach 표면 인벤토리, cli-jaw 어댑터 솔기, 성능 논거 계층 표, M1→M2 드리프트 목록.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)**: 엔진 측 앵커 갱신 — `GajaeCodeRpc`→`JawcodeRpc`
> (`harness-control-plane/rpc-adapter.ts:112`, 기본 명령 `["jwc","--mode","rpc"]`) · pabcd 정본
> `src/jwc-runtime/orchestrate-state.ts`(구 gjc-runtime) · 임베디드 스킬 `embedded:jwc/` ·
> receipt owner `jwc-*`(legacy read-both). 열린 질문 2(자가 전이 단락)의 명령 표기는 이제
> `jwc orchestrate <stage>`로 일관 — 플립이 어휘 충돌 제거. 엔진 어휘 "gjc"는 아래에서 jwc로 통일.

## 0. 선행 조건 체인

100(Node 포팅: Bun.* 셰임 + 트랜스파일 + bun:sqlite→better-sqlite3) → 110(상주 서비스) → 120(세션) → 130(주입) 순.
M1 산출물이 주는 공짜: **030 디스커버리가 이미 brand-aware** — 서버가 `GJC_BRAND_NAME=jwc`만 설정하면
`~/.cli-jaw/skills` 네이티브 로드·제외 2종이 그대로 동작 (130 스킬 주입의 2안이 사실상 완성됨).
020 아이덴티티도 동일: cli-jaw가 settings 주입 대신 config 필드로 전달 가능.

## 1. 진입 계약 — spawnAgent 어댑터 (cli-jaw 측)

- 계약: `src/agent/spawn.ts:677 spawnAgent(prompt, opts): SpawnResult = { child: ChildProcess|null, promise }`
  — **`child:null` 경로 기존재** (settings gate)로 in-process 호환 증명 (02 리서치)
- 어댑터: `opts`/settings의 cli 값 `jwc` → JawRuntime 위임, `child:null` + promise 반환
- 주의 (실코드 확인): L678–684의 `mainManaged`/`gateEligibleMain`/employee 분기 — 어댑터는 origin(web/telegram/…),
  employeeSessionId, internal 플래그 시맨틱을 보존해야 큐/게이트/직원 디스패치가 그대로 탐

## 2. JawRuntime 싱글톤 (NEW `src/agent/jwc-runtime.ts`, cli-jaw 측)

```
JawRuntime
├─ 세션 풀: Map<sessionKey, AgentSession>  — 인스턴스당 활성 1 (D 확정 "단 하나의 jwc")
│   · createAgentSession() via `jwc/sdk` 단일 임포트 (010 호환 표면; discoverSkills 스텁 주의 — 030 MOC 경고)
├─ prompt(text)  → session.prompt(text)                     — spawn 소멸
├─ steer(text)   → session.prompt(text, { streamingBehavior: "steer" })   — kill-respawn 소멸 (PromptOptions 기존재 확인)
├─ followUp(text)→ session.prompt(text, { streamingBehavior: "followUp" })
└─ dispose/recreate — 예외 격리 (런타임 크래시가 서버를 죽이지 않게 경계 try/catch + 세션 재생성)
```

## 3. 이벤트 매핑 — jwc AgentSessionEvent → cli-jaw bus

- 수신: `createAgentSession` 이벤트 스트림 (메시지 델타/도구 시작·종료/thinking/컴팩션/에러)
- 송신: `src/core/bus.ts:49 broadcast(type, data, audience)` — SSE로 Web UI 도달 (public 게이트 주의)
- 110 P에서 매핑 표 작성: assistant 델타→`agent_stream`, 도구 로그→tool_log 직렬화(120과 합의), 에러→기존 에러 이벤트 타입
- 원칙: **cli-jaw 기존 이벤트 타입에 맞춘다** (Web UI 무수정 목표) — 새 타입은 도구 블록 가시화 등 부족분만

## 4. 세션 영속화 (120) — jaw.db 정본

- 쓰기: **완료 시 1회 기록** (스트리밍 중간 저장 금지 — AGY 진행문 저장 버그 교훈, 120 MOC 계약)
- resume: 서버 재시작 → jaw.db messages 로드 → 세션 재구성. jwc 쪽 주입 경로는 110 P에서 실사
  (후보: sessionManager 복원 / createAgentSession 메시지 시드 옵션 / agent db 캐시 동기화)
- jwc agent db는 내부 캐시로 유지, 충돌 시 jaw.db 승 (D6)
- resume-classifier/session-persistence/spawn/resume.ts는 cli='jwc' 경로에서 전체 우회

## 5. 주입 3종 (130) — M2 done 지점

| 항목 | 1차 경로 | 비고 |
|------|---------|------|
| 스킬 | **서버가 GJC_BRAND_NAME=jwc 설정 → 030 네이티브 디스커버리 그대로** | cli-jaw 프롬프트 빌더 산출물 주입(구 1안)은 불필요해짐 — 중복 주의만 검증 |
| 아이덴티티/프롬프트 | A2 사용자 설정 → identity.* config 매핑 (020 산출물) + cli-jaw A1 시스템 프롬프트와 합성 규칙 1개 | 020·130 MOC 충돌 주의 항목 |
| PABCD | cli-jaw orchestrate 상태머신을 정본으로, 051 이식분과 텍스트 리소스 공유 (사본 드리프트 방지) | 단계 도구 게이팅은 jwc role 패턴 (`src/jwc-runtime/restricted-role-agent-bash.ts`) |
| 인증 | `discoverAuthStorage(agentDir)` 공유 (sdk.ts:409) + 090 시딩 브리지를 서버 기동 경로에서 호출 | |

## 6. 라이프사이클·롤아웃

- 서버 수명 = 런타임 수명. busy/queue: `isAgentBusy()`/queueCtrl 계약 준수 (어댑터가 promise 수명으로 표현)
- 단계적 전환: settings cli='jwc' 옵트인 → 검증 후 150에서 기본 승격, spawn 경로 롤백 스위치 1릴리스 유지
- 멀티 인스턴스(.cli-jaw-34xx): 인스턴스별 서버 프로세스 = 인스턴스별 JawRuntime — 자연 격리

## 7. 리스크 레지스터 (M2)

1. **Node 포팅 표면적** — stream.test.ts 1,662줄 등 업스트림 테스트가 베이스라인 (100 완료 기준)
2. **이벤트 순서/중복** — 스트리밍 델타와 완료 기록의 정합 (120 테스트로 고정)
3. **이중 컴팩션** — jwc 자체 컴팩션 vs cli-jaw compact 핸드오프 (기본: jwc 위임, 120 MOC)
4. **discoverSkills 스텁** — sdk 표면 의존 금지, loadSkills 경로 재수출 (030 경고 승계)
5. **natives(napi-rs)** — Node 로드 검증 (100)

---

## 착수 전 실측 보강 (260612)

> 실측 기준: jawcode HEAD (commit 0b603b05/d34097b8 Phase β 이후), cli-jaw HEAD (오늘 기준). 읽기 전용 실사.

### (a) Attach 표면 인벤토리

| 표면 | 진입점 (파일:줄) | 전송 방식 | 도구 이벤트 피델리티 | 사고(thinking) 피델리티 | 생명주기 |
|------|---------------|-----------|-------------------|----------------------|---------|
| **ACP stdio** (`jwc acp`) | `commands/acp.ts` → `modes/acp/acp-mode.ts` | 표준 입출력 NDJSON 스트림 (`@agentclientprotocol/sdk`) | **1등급** — `tool_execution_start/update/end` 구조화 (acp-event-mapper.ts:167-221) | **1등급** — `thinking_delta/end` AssistantMessageEvent를 SessionNotification으로 매핑 (acp-event-mapper.ts:281) | ACP 클라이언트가 세션 생성·종료를 소유; jwc 프로세스는 계속 상주 |
| **harness RPC** (`jwc --mode rpc`) | `JawcodeRpc` (harness-control-plane/rpc-adapter.ts:112 — 260613 플립) | 서브프로세스 spawn + stdio NDJSON | **2등급** — event_type=agent_start 등 제어 프레임; 도구 내용은 cli-jaw harness 자체 파싱 필요 | **2등급** — thinking 이벤트를 직접 소비하지 않음 (cli-jaw 쪽 observer 없음) | 세션당 **spawn 1회** (상주 아님); 프로세스는 에이전트 완료 시 종료 |
| **bridge 모드** (`jwc --mode bridge`) | `runBridgeMode` (modes/bridge/bridge-mode.ts:511) → HTTP + SSE | HTTP endpoint + SSE 스트림 | **1등급** — AgentSessionEvent 전체 직렬화 (event-envelope.ts) | **1등급** — thinking_level_changed 포함, message_update 내 thinking_delta 전달 | cli-jaw가 HTTP 서버에 접속; jwc 프로세스 상주 |
| **in-process SDK** (`createAgentSession`) | `sdk.ts:796 createAgentSession()` → `session.subscribe()` | 동일 프로세스 직접 함수 호출 | **0등급(최상)** — AgentSessionEvent 원본 참조, 직렬화 0 | **0등급(최상)** — thinking_delta/end 원본 이벤트, 암호화 여부까지 완전 전달 | cli-jaw 서버 프로세스 = jwc 런타임 수명; 별도 프로세스 없음 |

**결론: in-process SDK가 "상주 네이티브"에 유일하게 부합한다.** ACP·bridge는 프로세스 간 직렬화 왕복이 필요하고 harness RPC는 상주가 아니다. §1 설계("cli-jaw 서버가 `jwc/sdk`를 import해 상주")는 in-process SDK 경로를 가리키며 **실측과 일치한다.**

> 주의: `discoverSkills`는 sdk.ts:444에서 **스텁(빈 배열 반환)**으로 확인됨. 110 §기본값 "jwc/sdk 단일 임포트 — discoverSkills 스텁 주의" 경고 유효.

### (b) cli-jaw 어댑터 솔기 (파일:줄 앵커)

| 항목 | 파일:줄 | 현재 동작 |
|------|--------|---------|
| `spawnAgent` 진입 계약 | `src/agent/spawn.ts:696` | `spawnAgent(prompt, opts): SpawnResult = { child: ChildProcess|null, promise }` — 111 §1 앵커 **확인** |
| `child:null` 경로 기존재 | `spawn.ts:708, 732, 747` | settings gate(뮤테이션 대기), 이미 실행 중 중복 guard 총 3개 소에서 `{ child: null, promise }` 반환 — **in-process 호환 경로 증명 확인** |
| `mainManaged/gateEligibleMain` 플래그 | `spawn.ts:700-701` | `mainManaged = !forceNew && !empSid && !opts.internal`, `gateEligibleMain = mainManaged && !agentId && !_isFallback && ...` — 어댑터가 이 시맨틱을 보존해야 큐/게이트/직원 디스패치 정합 |
| `cli` 값 라우팅 | `spawn.ts:767`, `events/index.ts:150` | `resolveMainCli()` 반환값으로 분기, `discriminate()`는 `'claude'\|'claude-e'\|'codex'\|'cursor'\|'gemini'\|'grok'\|'opencode'\|'copilot'` 처리 — **`'jwc'` 케이스 없음** → 어댑터 삽입 지점 |
| NDJSON 파싱 레이어 | `spawn.ts:2033-2086`, `events/index.ts` | `dispatchNdjsonLine()` → `discriminate()` → `extractFromEvent()` 전체 파싱 스택 — jwc 경로에서 **전부 우회** (in-process 이벤트 직접 수신) |
| 도구/thinking 파싱 | `events/index.ts:157-204` | claude stream_event → `thinking_delta`/`input_json_delta` 버퍼 축적 → `content_block_stop`에서 `toolLog.push` — 텍스트 스크레이핑. in-process 대체 시 `AgentSessionEvent.tool_execution_*` + `AssistantMessageEvent.thinking_*`로 교체 |
| `broadcast()` 타깃 | `src/core/bus.ts` (111 §3 기존 앵커) | SSE로 Web UI 전달, `audience` 파라미터로 public/internal 게이트 |
| `isAgentBusy()/queueCtrl` | `src/agent/gateway.ts` | 110 §기본값 "cli 값 jwc 추가만으로 편입" 확인 필요 — **실사 미완** (gateway.ts 미열람) |
| PABCD 상태 | `src/orchestrator/state-machine.ts:3`, `src/core/db.ts:83` | cli-jaw는 `orc_state` DB 테이블(jaw.db 내) 정본 — **jwc는 `.jwc/state/pabcd-state.json` 파일 정본** (`src/jwc-runtime/orchestrate-state.ts:241` — 260613 플립 경로). **두 정본이 다른 저장소** → 130 연결 시 동기화 규칙 필요 |

### (c) 성능 논거 계층 표

| 레이어 | 현재(spawn-parse) 오버헤드 | in-process 후 오버헤드 | 판정 |
|--------|--------------------------|----------------------|------|
| 프로세스 spawn | **매 세션 fork/exec** (claude/codex 바이너리) — 200~500 ms cold start | **0** (서버 기동 시 1회만) | ✅ 소멸 |
| TTY/pipe + NDJSON 파싱 | `dispatchNdjsonLine` + `discriminate` + `extractFromEvent` 전체 스택 — 모든 청크마다 | **0** (subscribe 콜백, 직접 이벤트 객체 참조) | ✅ 소멸 |
| 시스템 프롬프트 재조립 | 신규 spawn마다 `buildSystemPrompt()` 호출 (contextFiles/workspaceTree 재스캔) | **캐시 가능** — AgentSession 상주, 프롬프트 블록 첫 prompt() 후 유지 | ✅ 소멸 (prompt-cache-friendly) |
| thinking/도구 메타데이터 손실 | thinking: 텍스트 버퍼로 재조립; tool: JSON 재파싱 — 암호화 thinking은 스크레이핑 불가 | **0** — `AgentSessionEvent` 원본 구조체, `ThinkingContent` 타입 보장 | ✅ 소멸 |
| resume/steer 경로 | kill-respawn(`steerAgent`) + session-ID 역추적(`resume-classifier.ts`) — 깨지기 쉬움 | `session.prompt(text, { streamingBehavior: "steer"/"followUp" })` — 살아있는 루프에 직접 push | ✅ 소멸 |
| IPC 직렬화 | 없음 | **in-process: 없음.** (ACP/bridge 선택 시 NDJSON/HTTP 직렬화 추가됨) | ✅ in-process는 추가 없음 |
| 생명주기 관리 | ChildProcess 종료 감지, 오류 guard | **추가됨** — JawRuntime dispose/recreate, 예외 격리 try/catch, 세션 재생성 로직 | ⚠️ 신규 복잡도 (111 §7 리스크 4와 합류) |
| 메모리 상주 비용 | spawn 종료 시 메모리 반환 | **상주** — AgentSession + 모델 연결 + MCP manager 메모리 상주 | ⚠️ 신규 비용 (단일 세션이므로 규모 예측 가능) |

### (d) M1→M2 드리프트 목록

| # | M1이 변경한 사항 | 111 영향 섹션 | 판정 |
|---|---------------|-------------|------|
| **D1** | Phase β (commit 0b603b05): `.gjc/` 전수 → `.jwc/` 스윕 (1,530건/227파일). `CONFIG_DIR_NAME = ".jwc"` 고정 | §4 세션 영속화 — `agentDir` 경로가 이제 `~/.jwc/agent` (dirs.ts:26 확인). cli-jaw에서 `createAgentSession({ agentDir })` 호출 시 이 경로 주입 필요 | **단순화** — 경로 추측 불필요 |
| **D2** | `APP_NAME` 기본값: `process.env.JWC_BRAND_NAME \|\| process.env.GJC_BRAND_NAME \|\| "jwc"` (dirs.ts:23). GJC_BRAND_NAME=jwc 환경변수 없이도 jwc가 기본 | §0 선행 조건 "GJC_BRAND_NAME=jwc만 설정하면" — **변경 필요 없음**, 기본값이 이미 jwc | **단순화** |
| **D3** | M1 99.02.00 — 시스템 프롬프트에 `<native-workflow name="orchestrate">` 추가 예정(설계 확정, 구현 미완). `pabcd-state.json` 파일 정본 위치: `.jwc/state/pabcd-state.json` | §5 주입 3종 PABCD 항 "cli-jaw orchestrate 상태머신을 정본" — **부분 드리프트**: jwc는 파일 정본(`.jwc/state/pabcd-state.json`), cli-jaw는 DB 정본(`orc_state` 테이블). 두 정본 동기화 규칙이 §5에 없음 | **복잡화** — 130 밴드에서 동기화 계약 명시 필요 |
| **D4** | M1 099 밴드: `discoverAuthStorage(agentDir)` → `agentDir = ~/.jwc/agent` 경로로 정착. 브로커 모드도 sdk.ts:409에 추가 | §5 인증 항 "discoverAuthStorage(agentDir) 공유" — **앵커 유효**, 브로커 모드 고려 추가 가능 | **소폭 보강 필요** |
| **D5** | M1 99.02 orchestrate 표면 추가: 시스템 프롬프트에 `jwc orchestrate`가 자가 전이 명령으로 등재될 예정 — M2 임베딩 시 cli-jaw 서버 프로세스 내에서 `jwc orchestrate` shell 호출이 발생 가능 | §5 PABCD 항 미언급 — **신규 위험**: M2 임베디드 환경에서 `jwc orchestrate` shell 호출이 jwc CLI 바이너리를 별도 spawn할 수 있음 (상주 런타임과 충돌). 자가 전이 경로를 in-process API로 단락(short-circuit)해야 함 | **복잡화** — 130 밴드 오픈 아이템 |
| **D6** | 99-밴드 구조체 추가: `modes/acp/`, `modes/bridge/`, `harness-control-plane/` 전부 실재 확인. 110 MOC "구 02/03 승계" 시임 분석 기반 — 당시 브리지/ACP 모드 존재 미확인이었을 수 있음 | §2 JawRuntime — in-process SDK 권고는 여전히 유효하지만, ACP/bridge 경로가 구조적으로 존재한다는 사실이 **롤백 스위치** 옵션을 강화함 (150 밴드 점진 승격 시 bridge 모드로 1릴리스 유지 가능) | **완화 옵션 추가** |

### (e) 사용자 확인이 필요한 열린 질문 — **전부 결정 (260613)**

> **핵심 결정: 두 모드 분리.** **Code 모드**(112.3 ACP)는 세션별 격리 — `~/.cli-jaw/jwc-agent`
> 격리 config 유지. **jaw 모드**(110 상주 통합)는 호스트(cli-jaw)가 상태를 소유하므로, jwc를
> **host-aware("hosted/jaw 모드")** 로 수정해 자기 상태를 호스트에 양보한다. 아래 1·2·5·신규
> 항목은 이 단일 "jwc hosted 모드 플래그"로 묶어 구현(130 주입 3종 + 110 agentDir).
>
> | # | 질문 | 결정 | 구현 소속 |
> |---|---|---|---|
> | **0 (신규)** | jaw 모드 agentDir (e2e 발견: `~/.cli-jaw/jwc-agent` 빈 폴더라 인증 실패) | **A — `~/.jwc/agent` 재사용**. 기존 로그인/스킬/메모리 승계. Code 모드만 격리 유지 | 110 (jwc-runtime `jwcAgentDir()` 기본값) |
> | **1** | PABCD 정본 충돌 | **A — cli-jaw `orc_state` DB 단일 정본**. jaw 모드일 때 jwc의 `.jwc/state/pabcd-state.json` 정본 경로 **단락**(호스트 DB에 양보) | 130 (+ jwc orchestrate-state 수정) |
> | **2** | orchestrate 자가 전이 단락 | **A — orchestrate 전용 in-process 도구 등록**(shell `jwc orchestrate` 우회, 명시적) | 130 (+ 110 도구 등록) |
> | **5** | discoverSkills 스텁 | ~~A — `sdk.ts`에서 `loadSkills` 재수출~~ → **✅ 해소 (260613 검증)**: fork가 `createAgentSession` 내부에서 `loadSkills` 직접 호출로 대체 완료. `discoverSkills` 스텁은 미호출 상태이며 quarantine test(`utility-extensibility-quarantine.test.ts:76`)가 강제. 130.2 §0 실측과 일치, 별도 수정 불필요 | ~~130~~ (완료) |
> | 3 | gateway busy 게이트 | ✅ 이미 해결 — `spawn.ts:319` or-체인 합류, 110 e2e에서 busy 정착 확인 | (완료) |
> | 4 | `Bun.sleep` 잔존 | ✅ 이미 해결 — 100 셰임 적용 완료 | (완료) |
>
> ⚠️ **구현 주의**: 0·1·2·5 타깃 파일(`cli-jaw/jwc-runtime.ts`, jwc `sdk.ts`·`orchestrate-state.ts`)이
> 모두 concurrent 세션 미커밋 작업과 겹침 — 착수 전 조율 필요.

원문(아카이브):

1. **PABCD 정본 충돌**: cli-jaw는 `jaw.db orc_state`(DB), jwc는 `.jwc/state/pabcd-state.json`(파일). M2 임베딩 후 어느 쪽이 정본? 130 밴드에서 단방향 동기화(cli-jaw DB → jwc 파일 쓰기?) 또는 단일 정본 결정이 필요.

2. **orchestrate 자가 전이 단락**: 99.02 설계대로 시스템 프롬프트에 "YOU advance IPABCD phases by running `jwc orchestrate <stage>` via shell" 문장이 들어가면, M2 임베디드 환경에서 에이전트가 `jwc orchestrate p`를 shell 호출 → 새 jwc 프로세스 spawn. 이를 막을 in-process 후크(예: `BashTool` 인터셉트 또는 `orchestrate` 전용 도구 등록)가 110/130 스코프에 포함되는가?

3. **gateway.ts isAgentBusy() 편입**: 110 §코드 사실에서 "cli 값 `jwc` 추가만으로 편입"이라고 했지만 `gateway.ts` 실사 미완. 실제 busy 게이트가 cli 값 기반인지 아니면 `activeProcess !== null` 패턴인지 확인 필요 (in-process path는 ChildProcess가 없으므로 별도 busy 플래그 관리 필요).

4. **Node 포팅 표면의 `Bun.sleep` 잔존**: sdk.ts:1064에 `Bun.sleep(STARTUP_SCAN_DEADLINE_MS)`가 현재도 잔존. 100 포팅 밴드 셰임 목록에 `Bun.sleep → setTimeout/Promise` 추가 필요.

5. **discoverSkills 스텁 처리 확정**: sdk.ts:444 `discoverSkills`는 `{ skills: [], warnings: [] }` 반환 스텁. 030 디스커버리 3계층(글로벌 → 프로젝트 → `~/.cli-jaw/skills`)을 M2에서 활성화하려면 `loadSkills` 직접 호출 경로가 필요. 030 MOC 경고 승계를 넘어 구체적 API 노출 경로(sdk 재수출 vs 내부 직접 import) 결정 필요.
