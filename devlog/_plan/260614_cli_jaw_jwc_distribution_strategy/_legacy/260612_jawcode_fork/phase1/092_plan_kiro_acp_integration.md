# 092 — plan: Kiro ACP 통합 (091 대체 경로)

> 상태: [검증완료] ✅ — 프로토콜 크래킹 완료, 동작 확인 (2026-06-12)
> 소속: 090 밴드 (인증 시딩).
> **091 HTTP API 모킹 대비 우위**: ToS 리스크 대폭 경감, 유지보수 부담 최소, 스트리밍/멀티턴/도구 네이티브 지원.

## 요약

kiro-cli-chat(v2.5.0)의 **ACP(Agent Client Protocol)** stdio JSON-RPC 인터페이스를 통해
Kiro를 jwc 프로바이더로 통합. IDE 위장(UA/핑거프린트) 없이 공식 바이너리의 프로그래밍 인터페이스를 사용.

**핵심 장점 vs 091 HTTP API 모킹:**
- ❌ User-Agent/핑거프린트 위장 불필요
- ❌ EventStream 바이너리 파싱 불필요 (ACP가 텍스트 스트리밍으로 추상화)
- ❌ conversationState 페이로드 변환 불필요 (ACP가 세션 히스토리 관리)
- ✅ 공식 바이너리 사용 → ToS "서드파티 하네스" 해석 여지 축소
- ✅ 인증은 kiro-cli 자체가 처리 (이미 로그인 상태면 즉시 사용)
- ✅ 모든 모델 접근 (auto, claude-sonnet-4.5/4, haiku-4.5, deepseek-3.2, glm-5, minimax, qwen3)

## ① ACP 프로토콜 사양 (검증 완료)

### 부트스트랩
```
/Applications/Kiro CLI.app/Contents/MacOS/kiro-cli-chat acp
```
- stdio JSON-RPC 2.0 (한 줄 = 한 메시지, `\n` 구분)
- SACP v11.0.0 기반, 프로토콜 버전 0.10.4 (서버는 `protocolVersion: 1`로 응답)

### Client → Server 메서드

#### 1. `initialize`
```json
{
  "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": { "readTextFile": true, "writeTextFile": true }
    },
    "clientInfo": { "name": "jwc", "title": "Jawcode", "version": "0.1.0" }
  }
}
```
**응답:**
```json
{
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": { "image": true, "audio": false, "embeddedContext": false },
      "mcpCapabilities": { "http": true, "sse": false },
      "sessionCapabilities": {}
    },
    "authMethods": [],
    "agentInfo": { "name": "Kiro CLI Agent", "title": "Kiro CLI Agent", "version": "2.5.0" }
  }
}
```

#### 2. `session/new` ⚠️ `mcpServers` 필수
```json
{
  "jsonrpc": "2.0", "id": 2, "method": "session/new",
  "params": { "cwd": "/path/to/workspace", "mcpServers": [] }
}
```
**응답:**
```json
{
  "result": {
    "sessionId": "uuid-here",
    "modes": {
      "currentModeId": "kiro_default",
      "availableModes": [
        { "id": "kiro_default", "name": "kiro_default", "description": "The default agent for Kiro CLI" },
        { "id": "kiro_planner", "name": "kiro_planner", "description": "..." },
        { "id": "kiro_guide", "name": "kiro_guide", "description": "..." }
      ]
    },
    "models": {
      "currentModelId": "auto",
      "availableModels": [
        { "modelId": "auto" }, { "modelId": "claude-sonnet-4.5" },
        { "modelId": "claude-sonnet-4" }, { "modelId": "claude-haiku-4.5" },
        { "modelId": "deepseek-3.2" }, { "modelId": "minimax-m2.5" },
        { "modelId": "minimax-m2.1" }, { "modelId": "glm-5" },
        { "modelId": "qwen3-coder-next" }
      ]
    }
  }
}
```

#### 3. `session/prompt`
```json
{
  "jsonrpc": "2.0", "id": 3, "method": "session/prompt",
  "params": {
    "sessionId": "<from session/new>",
    "prompt": [{ "type": "text", "text": "User message here" }]
  }
}
```
**응답** (스트리밍 완료 후):
```json
{ "result": { "stopReason": "end_turn" } }
```

#### 4. `session/set_model`
```json
{
  "jsonrpc": "2.0", "id": 4, "method": "session/set_model",
  "params": { "sessionId": "<id>", "modelId": "claude-sonnet-4" }
}
```
**응답:** `{ "result": {} }`

### Server → Client 알림 (Notifications)

| method | 용도 | 주요 필드 |
|---|---|---|
| `session/update` | **스트리밍 텍스트/사고** | `params.update.sessionUpdate`: `"agent_message_chunk"` or `"agent_thought_chunk"`, `params.update.content.text` |
| `_kiro.dev/subagent/list_update` | 서브에이전트 상태 | `params.subagents[]` |
| `_kiro.dev/commands/available` | 사용 가능 명령/도구 목록 | `params.tools[]`, `params.commands[]` |
| `_kiro.dev/metadata` | 컨텍스트 사용량 | `params.contextUsagePercentage` |

### Server → Client 요청 (Tool Calls)

| method | 설명 | Client 응답 |
|---|---|---|
| `fs/read_text_file` | 에이전트가 파일 읽기 요청 | `{ "result": { "content": "file text" } }` |
| `fs/write_text_file` | 에이전트가 파일 쓰기 요청 | `{ "result": null }` |
| `session/request_permission` | 위험 동작 승인 요청 | `{ "result": { "outcome": { "outcome": "allow_once"|"cancelled" } } }` |

### 추가 검증된 메서드 (binary strings 추출)

- `session/cancel` — 진행 중인 프롬프트 취소
- `session/load` — 기존 세션 복원 (`loadSession: true` capability)
- `session/set_mode` — 에이전트 모드 변경 (default/planner/guide)
- `session/terminate` — 세션 종료

## ② 구현 설계

### 아키텍처
```
jwc ─── KiroACPProvider ─── [spawn] ─── kiro-cli-chat acp (stdio)
         │                                    │
         ├── initialize()                     │
         ├── createSession(cwd)               │
         ├── prompt(sessionId, text) ───────►  session/prompt
         │         ◄─── session/update ────── │ (streaming chunks)
         │         ◄─── fs/read_text_file ─── │ (tool call)
         │   ────► { result: { content } } ──►│
         └── setModel(sessionId, modelId)     │
```

### 핵심 컴포넌트

1. **`KiroACPTransport`** — subprocess 관리 + JSON-RPC 양방향 통신
   - stdin/stdout 라인 기반 I/O
   - 요청 ID 매핑 (Promise per request)
   - 알림 핸들러 (이벤트 이미터)
   - 프로세스 라이프사이클 (spawn/terminate/restart)

2. **`KiroACPSession`** — 세션 상태 관리
   - sessionId 보존
   - 모델/모드 전환
   - tool call 핸들러 바인딩

3. **`KiroProvider`** — jwc Provider 인터페이스 구현
   - `streamSimple()` → session/prompt + session/update 이벤트 → ReadableStream
   - `listModels()` → session/new 응답의 availableModels
   - 세션 풀링 (재사용 vs 신규 생성)

### 도구 콜 처리 전략

Kiro ACP의 에이전트는 자체 도구(read, write, shell 등)를 가지고 있음.
jwc에서 Kiro를 **순수 LLM 프로바이더**로 쓸 때:
- **Option A**: `session/request_permission` 모두 거부 → 도구 사용 차단, 순수 텍스트 응답만
- **Option B**: fs/read, fs/write를 jwc의 파일 시스템으로 위임 → Kiro 에이전트가 jwc 워크스페이스 접근
- **권장**: Option A (Phase 1), Option B (Phase 2 — cli-jaw 런타임 임베딩 시)

## ③ 리스크 평가 (091 대비 변경)

| 항목 | 091 HTTP API | 092 ACP | 비고 |
|---|---|---|---|
| ToS 위반 강도 | 높음 (IDE 위장) | **중간** (공식 바이너리 사용) | ACP는 문서화된 프로토콜 |
| 탐지 가능성 | 높음 (UA 검사) | **낮음** (로컬 바이너리) | 네트워크 트래픽은 정상 kiro-cli 패턴 |
| 유지보수 부담 | 높음 (버전 업데이트 추적) | **낮음** (바이너리 자동 업데이트) | kiro-cli 업데이트 = 자동 반영 |
| 의존성 | 없음 (순수 HTTP) | kiro-cli 설치 필수 | macOS `/Applications/Kiro CLI.app` |
| 성능 | 직접 HTTP (빠름) | subprocess spawn 오버헤드 | 세션 재사용으로 완화 가능 |
| 기능 커버리지 | 수동 구현 필요 | **풀 기능** (모델, 모드, 도구, 서브에이전트) | ACP가 모든 것 추상화 |

## ④ 게이트 / 결정 필요 항목

1. ~~ToS 리스크 수용 결정~~ → ACP 사용은 "공식 CLI의 프로그래밍 인터페이스" 해석 가능.
   단, Kiro ToS가 "제3자 도구에서의 사용 금지"를 광의로 적용할 경우 여전히 리스크 존재.
   **판단: 개인 실험 한정이면 ACP 경로 착수 가능.**

2. **kiro-cli 경로 하드코딩 vs 탐색** — macOS 앱 번들 경로 vs PATH 탐색 vs 설정 파일.

3. **세션 수명 전략** — 프롬프트마다 신규 vs 대화 단위 재사용 vs 장기 상주.
   (copilot_acp_client.py는 요청마다 spawn/destroy — 단순하지만 느림)

## ⑤ 레퍼런스

- 검증 스크립트: `/tmp/acp_test.py`, `/tmp/acp_multi.py`
- hermes-agent ACP 내부 문서: `~/Developer/codex/hermes-agent/website/docs/developer-guide/acp-internals.md`
- hermes copilot ACP 클라이언트: `~/Developer/codex/hermes-agent/agent/copilot_acp_client.py`
- Kiro CLI 바이너리: `/Applications/Kiro CLI.app/Contents/MacOS/kiro-cli-chat`
- gemini-cli ACP 테스트: `~/Developer/codex/gemini-cli/integration-tests/acp-*.test.ts`
