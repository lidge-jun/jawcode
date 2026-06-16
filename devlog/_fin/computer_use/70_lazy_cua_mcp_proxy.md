# 70 — Lazy MCP Proxy: cua-driver on-demand 연결

> 상태: 🟡 설계 결정 기록 / 구현 대기 (260614)
> 입력: `cua-driver`가 jwc macOS managed default MCP로 기본 로딩되어 computer-use를 쓰지 않는 세션에서도
> `cua-driver mcp`/`cua-driver serve`가 떠서 리소스를 과다 점유한다. 도구는 에이전트에게 노출하되 서버는 실제
> computer-use 호출 시점에만 연결하는 구조가 필요하다.

## 한 줄 결론

`cua-driver`를 일반 MCP managed default로 선연결하지 말고, jwc built-in discoverable **단일 `computer_use` proxy tool**로
노출한다. proxy는 첫 실행 때만 `cua-driver mcp`에 lazy connect하고, 이후 같은 세션 동안 연결을 재사용한다.

```txt
session startup:
  expose jwc-owned computer_use tool schema
  do not spawn cua-driver

computer_use execute:
  ensure cua-driver MCP connection
  listTools/cache backend catalog if needed
  dispatch requested action to the matching cua-driver MCP tool
  keep connection until session dispose
```

## 현재 문제 구조

| 단계 | 현재 동작 | 문제 |
|---|---|---|
| default install | `getManagedDefaultMcpServers("darwin")`가 `cua-driver`를 managed default로 추가 | user scope `~/.jwc/agent/mcp.json`에 기본 등록됨 |
| CLI startup | `main.ts`가 `discoverAndLoadMCPTools(getProjectDir(), ...)`를 호출 | 모든 enabled MCP 서버를 선연결함 |
| MCP manager | `connectServers()`가 250ms grace 이후에도 slow startup을 abort하지 않음 | 무거운 `cua-driver` 프로세스가 computer-use 미사용 세션에도 유지됨 |
| tool exposure | MCP tool schema는 `listTools()` 뒤에만 생성됨 | 서버를 안 띄우면 현재 방식으로는 agent-visible tool을 만들 수 없음 |

## 설계 결정

### 채택: jwc-owned Lazy MCP Proxy Tool

- jwc가 `computer_use`라는 built-in discoverable tool schema를 소유한다.
- 이 tool은 MCP 서버가 아니라 jwc runtime tool이다.
- 실행 전까지 `cua-driver` 프로세스를 시작하지 않는다.
- 실행 시 내부 helper가 `MCPManager.connectServers({ "cua-driver": ... })` 또는 전용 lazy manager로 연결한다.
- 연결 완료 후 `listTools()` 결과를 보고 action을 해당 backend MCP tool로 delegate한다.
- 연결과 tool catalog는 세션 생명주기 동안 재사용하고 `session.dispose()`/`disconnectAll()`에서 정리한다.

### 비채택: `/mcp enable cua-driver`만 사용하는 방식

세션 중 `/mcp enable`로 서버를 켜도 이미 모델에게 전달된 tool set에는 없을 수 있다. `session.refreshMCPTools()`로
다음 turn부터 반영할 수는 있지만, 에이전트가 필요를 판단하고 같은 흐름에서 즉시 켜고 쓰는 UX가 매끄럽지 않다.
computer-use는 “필요하면 agent가 바로 호출”해야 하므로 proxy tool이 필요하다.

### 비채택: Cached Deferred MCP tools 단독 사용

`DeferredMCPTool`은 현재 “이미 연결 시도가 시작되었고, 캐시된 schema가 있을 때” 빠르게 tool을 노출하는 장치다.
서버 프로세스를 아예 시작하지 않는 lazy-start와는 다르다. 확장 가능성은 있지만 첫 세션/캐시 없음 상태에서 schema를
노출하려면 결국 bundled static manifest가 필요하고, 36개 tool token tax도 남는다.

## Proxy surface 권장안

단일 tool 이름: `computer_use`

초기 schema는 cua-driver 36개 MCP tool을 그대로 복제하지 않는다. action discriminator 중심으로 최소 표면을 둔다.

| 필드 | 의미 |
|---|---|
| `action` | `start_session`, `observe`, `click`, `type_text`, `press_key`, `scroll`, `screenshot`, `window_state`, `list_apps`, `end_session` 등 |
| `session` | cua-driver session id. 없으면 jwc가 현재 agent/session 기반 기본값 생성 가능 |
| `target` | app/window/element target. `element_index` 우선, 좌표는 fallback |
| `text`/`key`/`delta` | action별 payload |
| `options` | wait/timeout/background dispatch 등 backend-specific escape hatch |

원칙:
- element/AX 기반 action을 우선한다.
- 좌표 기반 action은 fallback으로 유지한다.
- 중요한 cua-driver 신규 capability는 `options` 또는 action 추가로 승격한다.
- raw backend MCP tool escape hatch는 처음부터 열지 않는다. 필요 시 `action: "raw"`를 별도 explicit opt-in으로 추가한다.

## 구현 슬라이스

| # | 변경 | 파일 후보 | 검증 |
|---|---|---|---|
| 1 | macOS managed default에서 `cua-driver` 제거, 기존 exact managed entry cleanup | `packages/coding-agent/src/defaults/jwc-defaults.ts`, `default-mcp-config.test.ts` | 기본 install이 `cua-driver`를 쓰지 않음 |
| 2 | `computer_use` built-in discoverable tool 추가 | `packages/coding-agent/src/tools/computer-use.ts`, `tools/index.ts`, docs/tools | `search_tool_bm25`로 discover/activate 가능 |
| 3 | lazy backend connector 추가 | `packages/coding-agent/src/runtime-mcp/*` 또는 `tools/computer-use-backend.ts` | startup에서 `connectToServer("cua-driver")` 미호출 |
| 4 | 첫 tool 실행 시 connect/listTools/delegate | proxy/backend helper | 첫 `computer_use` 호출에서만 `cua-driver mcp` spawn |
| 5 | session cleanup 연결 | `agent-session.ts`/postmortem path | dispose 시 lazy connection 종료 |
| 6 | 문서 최신화 | `structure/21_extensibility.md`, `docs/tools/search_tool_bm25.md` 필요 시 | 현재 구조와 문서 일치 |

## 테스트 요구사항

- startup test: `cua-driver`가 config에 있거나 built-in backend로 알려져 있어도 session startup에서 `connectToServer`가 호출되지 않는다.
- exposure test: `computer_use`는 discoverable tool corpus에 포함되고, active set에는 기본 essential이 아니면 들어가지 않는다.
- activation test: `search_tool_bm25("computer use")` 후 같은 세션에서 `computer_use` 호출 가능하다.
- lazy connect test: 첫 `computer_use` 실행이 `cua-driver` backend connect를 1회 수행하고 두 번째 호출은 재사용한다.
- cleanup test: session dispose가 lazy MCP connection을 닫고 background reconnect를 남기지 않는다.
- fallback test: `cua-driver` 미설치/권한 없음은 일반 tool error로 반환하고 jwc startup은 실패하지 않는다.

## 리스크

- cua-driver MCP schema 변경을 proxy가 따라가야 한다. 해결: backend catalog를 첫 connect 때 검증하고 없는 action은 명확한 error로 매핑한다.
- 36개 tool을 1개 schema로 압축하면 일부 고급 기능이 빠질 수 있다. 해결: 자주 쓰는 AX/window/session action을 first-class로 두고, 필요한 경우 explicit raw escape hatch를 후속 추가한다.
- 기존 사용자가 수동으로 `cua-driver` MCP를 등록한 경우와 충돌할 수 있다. 해결: exact managed default만 cleanup하고, 커스텀 `cua-driver` config는 advanced mode로 보존한다.

## 결정 기록

- `cua-driver`는 기본 MCP 선연결 대상이 아니다.
- agent-visible surface는 jwc-owned `computer_use` proxy가 담당한다.
- backend process lifecycle은 tool 실행 시점의 lazy connector가 담당한다.
- 일반 MCP discovery는 그대로 유지하되, 무거운 desktop-control backend는 별도 lazy path로 분리한다.
