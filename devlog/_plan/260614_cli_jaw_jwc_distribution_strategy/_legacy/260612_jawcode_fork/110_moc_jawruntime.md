# 110 MOC — JawRuntime 상주 서비스

> 📐 상세 설계: [111_design_runtime_attach.md](./111_design_runtime_attach.md) — M2 100–130 통합 설계
> (spawnAgent 어댑터 시맨틱, JawRuntime 풀/steer=session.prompt(steer), 이벤트 매핑 원칙, M1 산출물 시너지: APP_NAME 기본값 "jwc"로 030 디스커버리 그대로 동작).

> 상태: ⬜. 결정 근거: D1/D8 [확정] — cli-jaw 서버 프로세스 안 상주, spawn 소멸. 구 02/03 시임 분석 승계.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 플립 완료 헤드 기준으로 코드 앵커 전수 갱신. 하단 §코드 사실·§아키텍처·§스코프·§완료 기준 모두 재검증.
> 표면 트랙: [112_moc_gui.md](./112_moc_gui.md) — 본 밴드 산출물(상주 런타임 + Web UI)의 GUI 패키징
> (기존 `electron/` 셸 완성 본선 + PWA 즉효 + Claude Desktop 보조). [제안] 단계, 착수 시점은 112 열린 질문 1.

---

## 코드 사실 (플립 후 갱신 — 260613 기준)

**jwc 측 (packages/coding-agent)**

- 임베딩 표면(단일 진입점): `packages/jwc/src/sdk.ts` — `export * from "@gajae-code/coding-agent/sdk"` 1줄 재수출. cli-jaw는 반드시 이 경로만 본다.
- 세션 생성 계약: `packages/coding-agent/src/sdk.ts:796` `createAgentSession(options): Promise<CreateAgentSessionResult>` → `{ session: AgentSession, ... }`
  - `AgentSession.prompt(text, opts?)` — `opts.streamingBehavior: "steer" | "followUp"` 기존재 확인 (`sdk.ts:441`)
  - `AgentSession.subscribe(listener)` → 취소 함수 반환 (`session/agent-session.ts:3083`)
- `discoverSkills`: `sdk.ts:444` **스텁 (빈 배열 반환 확인)** — `{ skills: [], warnings: [] }` 고정 반환
- `discoverAuthStorage(agentDir)`: `sdk.ts:409` — 브로커 모드 포함, 실사 유효
- `Bun.sleep` 잔존: `sdk.ts:1064` — 100 포팅 밴드 셰임 필수
- 앱 이름/경로: `packages/utils/src/dirs.ts:20-26`
  - `ENGINE_NAME = "gjc"` (경로·로그 파일명 픽스; **플립 미대상 — 의도 보류**)
  - `APP_NAME = process.env.JWC_BRAND_NAME || process.env.GJC_BRAND_NAME || "jwc"` — 환경변수 없이 기본값 `"jwc"`
  - `CONFIG_DIR_NAME = ".jwc"` — agentDir 기본값 `~/.jwc/agent`
- orchestrate-state 파일 정본: `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:241`
  - `pabcdStatePath(cwd, sessionId)` → `.jwc/state/pabcd-state.json` (sessionId 없을 때) 또는 `.jwc/state/sessions/<encoded>/pabcd-state.json`

**harness-control-plane (jwc 측, 상태 설계 참조)**

- `rpc-adapter.ts:112` `JawcodeRpc implements HarnessRpc` — 심볼 플립 완료 확인 (GajaeCodeRpc → JawcodeRpc)
  - 기본 명령: `["jwc", "--mode", "rpc"]` (`rpc-adapter.ts:128`) — **플립 완료**
  - 오버라이드: `process.env.GJC_HARNESS_RPC_COMMAND` — **env 이름 미플립 (의도 보류)**
- `storage.ts:194` `SessionPaths.gjcSessionDir` = `sessions/<id>/gjc-session/` — **내부 경로명 미플립 (의도 보류)**
- `storage.ts:60,111,167` env 게이트: `GJC_HARNESS_ROOT_REGISTRY_DIR`, `GJC_HARNESS_SOCKET_DIR`, `GJC_HARNESS_STATE_ROOT` — **미플립 (의도 보류)**
- `storage.ts:63,113` tmp 디렉터리: `os.tmpdir()/gjch${uid}/` — ENGINE_NAME "gjc" 파생 고정 (**의도 보류**)
- `storage.ts:169` 하네스 상태 루트 기본값: `<cwd>/.jwc/state/harness` — **jwc 경로 확인**
- `harness.ts:430` tmux 세션명: `gajae_code_harness_${sessionId}` — **미플립 (의도 보류)**
- `session-state-sidecar.ts:6-9` 이중 env 보호:
  - `GJC_COORDINATOR_SESSION_STATE_FILE` / `JWC_COORDINATOR_SESSION_STATE_FILE` (legacy 읽기 수용)
  - `GJC_COORDINATOR_SESSION_ID` / `JWC_COORDINATOR_SESSION_ID`

**cli-jaw 측**

- `spawnAgent` 진입 계약: `src/agent/spawn.ts:703` — `spawnAgent(prompt, opts): SpawnResult = { child: ChildProcess|null, promise }`
- `mainManaged`/`gateEligibleMain` 플래그: `spawn.ts:707-708`
- `child:null` 경로 기존재: `spawn.ts:715, 739, 754` (3개소) — in-process 호환 증명 유효
- `isAgentBusy()`: `spawn.ts:314` — `!!activeProcess || queueCtrl.isRetryPending() || mainSpawnStarting || steerInProgress` ← ChildProcess 기반. jwc in-process 경로는 `activeProcess`가 null이므로 **별도 busy 플래그 필요** (111 §b열린질문 3)
- `discriminate()`: `src/types/cli-events.ts:148-154` — `'claude'|'claude-e'|'codex'|'cursor'|'gemini'|'grok'|'opencode'|'copilot'` 8개. **`'jwc'` 케이스 없음** → 어댑터 삽입 지점 확인
- `resolveMainCli()`: `src/core/main-session.ts:36` — `requestedCli || settings["cli"] || session?.active_cli || 'claude'`
- `bus.ts:49` `broadcast(type, data, audience)` — SSE → Web UI, `audience='public'|'internal'` 확인
- PABCD DB 정본: `src/core/db.ts:83` `orc_state` 테이블 (jaw.db 내)
  - cli-jaw 정본 = `orc_state` DB, jwc 정본 = `.jwc/state/pabcd-state.json` → **두 정본 불일치 → 130 연결 시 동기화 계약 필요** (111 §e열린질문 1)

---

## 아키텍처 (플립 후 갱신)

```
cli-jaw 서버 (단일 프로세스)
└─ JawRuntime 싱글톤  [신규: src/agent/jwc-runtime.ts]
   ├─ AgentSession 풀 — createAgentSession() 인스턴스 상주
   │   · import from 'jwc' (packages/jwc/src/sdk.ts 단일 진입점)
   │   · agentDir = ~/.jwc/agent (CONFIG_DIR_NAME=".jwc" 고정)
   │   · discoverSkills 스텁 주의 — 030 네이티브 디스커버리(loadSkills) 직접 호출 필요
   ├─ prompt(text)   → session.prompt(text)                           spawn 소멸
   ├─ steer(text)    → session.prompt(text, { streamingBehavior:"steer" })    kill-respawn 소멸
   ├─ followUp(text) → session.prompt(text, { streamingBehavior:"followUp" })
   ├─ subscribe()    → AgentSessionEvent 스트림 → bus.broadcast() 매핑
   └─ dispose/recreate — 예외 격리 (try/catch + 세션 재생성)

spawnAgent 어댑터 삽입 지점:
  cli-jaw src/agent/spawn.ts:774 — resolveMainCli() 반환값 'jwc' 분기
  → JawRuntime.prompt() 위임, child:null + promise 반환
  → discriminate() 레이어 전체 우회 (AgentSessionEvent 직접 수신)
```

---

## 스코프

1. **`src/agent/jwc-runtime.ts` (cli-jaw 측 신규)**: JawRuntime 서비스 + AgentSession 풀
   - `createAgentSession()` via `'jwc'` 패키지 단일 임포트
   - `agentDir` 주입: `~/.jwc/agent` (getAgentDir() 경로; dirs.ts:220)
   - 활성 세션 1개 원칙 (D 확정 "단 하나의 jwc")
   - busy 플래그 독립 관리 (`isJwcRuntimeBusy()` 신규 — isAgentBusy()의 ChildProcess 의존 우회)

2. **spawnAgent 어댑터** (cli-jaw `src/agent/spawn.ts` 수정):
   - `resolveMainCli()` 반환값 `'jwc'` 분기 추가 (`spawn.ts:774` 근처)
   - 기존 큐/게이트/타임아웃/직원 디스패치 시맨틱 보존 (`mainManaged`/`gateEligibleMain` 플래그)
   - `discriminate()` 레이어 건너뜀 — `AgentSessionEvent` 직접 구독
   - **tool guidance 주입 금지** [확정 260613]: jwc가 tool description + hidden skill(browse, search, web-ai)로 자체 처리. cli-jaw는 PABCD/boss/identity/memory만 세션에 주입. A1 tool 섹션(browser §108-211, search routing) 비활성.

3. **AgentSessionEvent → bus.broadcast() 매핑 표** (110 P 작성):
   - `message_update` (thinking_delta/tool_execution_* 포함) → `agent_stream`
   - `tool_execution_start/end` → `tool_log` 직렬화 (120과 합의)
   - `agent_end` → 기존 에러 이벤트 타입
   - 원칙: **cli-jaw 기존 이벤트 타입 우선** (Web UI 무수정 목표)

4. **에러/충돌 격리**: 런타임 예외가 서버를 죽이지 않도록 (`try/catch` + 세션 재생성 경계)

---

## [기본값] 결정 (플립 후 확인)

- 임포트: `import { createAgentSession } from 'jwc'` 단일 경로 (`packages/jwc/src/sdk.ts` 재수출)
- 내부 직접 import 금지: `@gajae-code/coding-agent/...` 직접 접근 불가
- 프로세스 모델: 서버 수명 = 런타임 수명, 세션은 idle 시에도 메모리 상주 (명시 dispose 전까지)
- `APP_NAME` 기본값 이미 `"jwc"` — 환경변수 주입 불필요 (D2 단순화 확인)

---

## 완료 기준 + 검증 명령

| 기준 | 검증 방법 |
|------|---------|
| 서버 기동 → Web UI에서 spawn 없이 대화+도구 실행 (**M2 done ①**) | 수동: UI에서 프롬프트 전송 후 응답 확인 |
| `ps` 자식 프로세스 0 (도구 실행 제외) | `ps aux \| grep jwc \| grep -v grep` |
| 타입 오류 없음 | `cd packages/jwc && tsc --noEmit` |
| 런타임 예외 주입 테스트: 서버 생존 + 세션 자동 복구 | 단위 테스트: `session.dispose()` 강제 후 재프롬프트 |
| in-process busy 플래그 정합 | `isJwcRuntimeBusy()` 단위 테스트 |

---

## 열린 질문 [확정 대기]

1. **isJwcRuntimeBusy() 훅 위치**: `isAgentBusy()`(spawn.ts:314)는 ChildProcess 기반 — jwc in-process 경로는 `activeProcess=null`이므로 busy 감지 미동작. `spawn.ts:314` 내 or-조건 추가 vs. gateway.ts 별도 플래그 중 어느 구조?
2. **도구 실행 샌드박스/권한 게이트**: jwc `AgentSession`의 bash 허용 범위를 cli-jaw `permissions` 설정과 어떻게 합칠지 (gwc tools 권한 모델 실사 필요)
3. **멀티 인스턴스 `.cli-jaw-34xx` 격리**: 인스턴스별 서버 프로세스 = 인스턴스별 JawRuntime — 자연 격리 방침 유효성 검토

## 선행 완료 (109 밴드)

| 문서 | 내용 | 상태 |
|---|---|---|
| [109.1_receipt_tool_guidance_porting.md](./109.1_receipt_tool_guidance_porting.md) | browse/search/web-ai 네이티브 포팅 | ✅ |
| [109.2_receipt_integration_audit.md](./109.2_receipt_integration_audit.md) | 병렬 감사 (블로커 검증 + 갭 + DAG) | ✅ |
| [109.3_receipt_sdk_export.md](./109.3_receipt_sdk_export.md) | sdk.ts PABCD state export (Slice C 언블록) | ✅ |

> 109 밴드가 110 이후 구현의 전제. tool guidance는 jwc 네이티브 완료, sdk 표면 확장 완료, 감사로 리스크 사전 식별 완료.

## 세부 실행 문서 (260613 구체화 — 소넷 병렬 실사 기반)

| 문서 | 내용 |
|---|---|
| [110.3_plan_jawruntime_impl.md](./110.3_plan_jawruntime_impl.md) | JawRuntime API·spawn.ts:1047 삽입·busy 통합·에러 격리 (098 110.1~110.5 매핑) |
| [110.4_map_agent_event_bus.md](./110.4_map_agent_event_bus.md) | AgentSessionEvent → bus 1:1 고정 표 + traceRun 어댑터 |
- [110.2_audit_global_cwd.md](./110.2_audit_global_cwd.md) — 전역 cwd 가정 감사 (B2, 부류 A/B/C 분류 — CLI 진입점 보존)
