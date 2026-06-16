# 20 — 방법론 B: 실물 Codex Computer Use (Sky, AX-트리)

> 상태: 🔴 **jwc 직접 구동 불가 (codex 부모 코드서명 attestation)** — standalone은 메타(10도구)는
> 되나 실제 액션은 Codex 프로세스 트리 밖에서 거부. 250ms는 표면 블로커일 뿐, 진짜 벽은 codex 인증.
> 사용자가 원한 **정품**이 이것이며, cli-jaw는 codex 경유로만 쓴다.

## 정체

OpenAI가 **Sky(Software Applications Incorporated)**를 인수해 Codex 데스크톱 앱에 번들한 정품
computer use. codex-rs에서 `computer-use@openai-bundled` 플러그인(`McpServerConfig`, `computer_use`
피처, 기본 on). 바이너리에 `Sky` 네임스페이스 잔존(`SkyComputerUseService`/`SkyComputerUseClient`).

- 위치: `~/.codex/computer-use/Codex Computer Use.app/`
  - `Contents/MacOS/SkyComputerUseService` — 메인 서비스(15MB, arm64)
  - `Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient` — **MCP CLI 클라이언트**
- 실행: `SkyComputerUseClient mcp` (stdio JSON-RPC). codex 정식 config
  (`~/.codex/plugins/cache/openai-bundled/computer-use/<ver>/.mcp.json`):
  ```json
  { "mcpServers": { "computer-use": {
    "command": "./Codex Computer Use.app/.../SkyComputerUseClient", "args": ["mcp"], "cwd": "." } } }
  ```
- 제어 모델: `get_app_state(app)` → 스크린샷 + **Accessibility 트리 + element_index** 확보 →
  요소 단위 `click`/`set_value`/… → UI 변화 시 재호출. root 조작 아님(AX API + ScreenCaptureKit).

## 도구 (10종, AX-트리 기반)

`list_apps`·`get_app_state`·`click`·`perform_secondary_action`·`set_value`·`select_text`·
`scroll`·`drag`·`press_key`·`type_text`.

## standalone 검증 — 완벽 작동

```
printf '<initialize><initialized><tools/list>' | SkyComputerUseClient mcp
→ TOOLS 10 (list_apps, get_app_state, click, …)   # 핸드셰이크 0.17s
```

## jawcode 연결 블로커 — `STARTUP_TIMEOUT_MS = 250`

`~/.jwc/agent/mcp.json`에 절대경로+cwd로 등록해도 `discoverAndConnect`가
`MCP server connection timed out during startup: computer-use`로 실패.

근본 원인: `runtime-mcp/manager.ts:60` **`STARTUP_TIMEOUT_MS = 250`**(밀리초). 연결을 병렬로
시작해 250ms delay와 `Promise.race`(`:457`) — 250ms 안에 안 끝난 서버는 tool-cache 확인 후
**캐시 없으면 connectionAbort.abort()로 강제 종료**(`:480`).

- Sky 핸드셰이크 자체는 0.17s지만, **서명된 `.app` 바이너리 spawn**(코드서명 검증·프레임워크
  로딩·SkyComputerUseService 기동)이 250ms를 초과 → 첫 연결 실패.
- 캐시도 없음(첫 연결이 abort돼 캐시 채울 기회 없음) → **닭-달걀**: 캐시가 있어야 빠른데, abort돼서
  캐시가 영영 안 생김.
- 가벼운 node 스크립트(방법론 A)는 250ms 안에 들어와 통과 → A는 되고 B는 막힌 이유.

## parent coderequirement — 진짜 벽 (codex 인증) ✅ 검증됨

`SkyComputerUseClient.app/Contents/Resources/SkyComputerUseClient_Parent.coderequirement`:
```xml
<key>team-identifier</key><string>2DC432GLL2</string>   <!-- OpenAI OpCo, LLC -->
```

리포트(01_gpt-computer-use-macos-report.md:303) 명시: **"Codex.app 프로세스 트리 밖에서
SkyComputerUseClient를 실행하면 code signature invalid로 SIGKILL되는 구조."** 권한 모델 전체가
team-id 2DC432GLL2의 **Codex 프로세스 트리**에 앵커돼 있다(:326).

**실증(260613)**: 부모=bash로 spawn 후 —
- `initialize` → 정상 응답 (serverInfo "Computer Use" 반환)
- `tools/list` → 10도구 정상 (클라이언트 단독 메타, Service 불필요)
- **`tools/call list_apps`(실제 액션) → 무응답(hang)**. 액션은 **Service↔Client Apple Events IPC**가
  필요한데(`Automation` 권한, app-group `2DC432GLL2.com.openai.sky.CUAService`), Service가 Client의
  부모 체인(codex 트리)을 검증 → bash/jwc 부모면 거부.

→ **250ms는 연결 블로커일 뿐, 그걸 풀어도 액션 단계에서 막힌다.** 진짜 벽은 **codex 부모 코드서명
attestation**(TCC 권한 부족이 아님 — TCC는 Sky .app 바이너리에 코드서명 ID로 부여돼 부모 무관 지속).

## cli-jaw는 어떻게 "뚫었나" → 안 뚫었다, codex를 부모로 쓴다

cli-jaw는 우회하지 않는다. computer-use 작업을 **실제 codex 직원에게 dispatch** — 즉 OpenAI 서명된
**codex CLI(=Codex 프로세스 트리, team 2DC432GLL2)**를 띄우고 codex가 번들 computer-use MCP를
호스팅한다. 그래서 cli-jaw의 "codex-only" 게이트는 **정책 선택이 아니라 하드 기술 제약** —
Codex 트리 안의 프로세스만 Sky Service를 구동할 수 있다.

## jawcode(method B) 결론

jwc(bun, OpenAI 미서명, Codex 트리 밖)는 **실물 Sky를 직접 구동 불가** — 250ms를 풀어도 액션이
attestation으로 SIGKILL/거부. 가능한 길:
- **(a) codex 경유**: jwc가 computer-use 작업을 codex 서브프로세스로 dispatch(cli-jaw 방식). 복잡.
- **(b) 방법론 A**: parent 요구 없는 재구현(자체 Swift 바이너리·자체 TCC) → jwc 직접 사용 가능.
  **A가 되고 B가 안 된 근본 이유가 바로 이것.**

## 해소안 (미적용)

1. **`STARTUP_TIMEOUT_MS` 상향** (예: 250 → 3000ms) — 가장 직접적. 단 느린/죽은 서버가 있으면
   startup 지연. 서명 .app처럼 무거운 MCP를 위한 조정.
2. **tool-cache 선시드** — `SkyComputerUseClient`의 `tools/list`(10도구)를 agent.db tool-cache에
   미리 넣어, 250ms 초과해도 캐시 경로로 도구를 노출하고 연결은 백그라운드 지속.
3. **per-server `connectTimeoutMs`** 설정 필드 신설 — 서버별로 startup 윈도를 늘릴 수 있게.

## 평가

- 장점: OpenAI **정품**. AX-트리 기반이라 좌표 의존 없이 견고. cli-jaw가 codex 경유로 쓰는 바로 그것.
- 단점: jawcode 250ms startup 레이스에 막힘(코드 수정 필요). parent coderequirement가 액션 실행을
  게이팅할 잠재 리스크. .app 의존(codex 설치 필요).
