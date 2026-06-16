# 30 — jawcode MCP 격리 해제 + startup 레이스 + 스키마 정규화

> 두 방법론 공통 선결 인프라. 커밋 `0b493665`.

## 격리(quarantine)의 정체

jawcode(gajae-code 포크)는 공개 GJC 표면에서 **MCP 런타임 디스커버리를 의도적으로 비활성화**했다:

- `sdk.ts:278` `@deprecated MCP runtime discovery is quarantined and ignored`
- `sdk.ts:1273` `MCP runtime discovery is quarantined for the GJC surface … never discover project/user MCP configs here`
- `createAgentSession`은 **명시적으로 넘긴 `options.mcpManager`만** 사용하고, 직접 디스커버리하지 않음.
- `main.ts`는 그 옵션을 **세팅하지 않았음** → interactive·print 모두 MCP 도구 0개.
- 유일 우회로는 ACP 모드(`acp-agent.ts`가 자체 `new MCPManager` + `connectServers`).

설정 발견 자체는 동작함: `loadAllMCPConfigs(cwd)` → `loadCapability("mcps")` → `discovery/builtin.ts`가
`{cwd}/.jwc/{mcp.json,.mcp.json}` + `~/.jwc/agent/{mcp.json,.mcp.json}` 스캔. 즉 등록은 읽히는데
세션에 안 물림.

## 배선 (main.ts)

`runRootCommand`에서 sessionOptions 구성 직후:

```ts
import { discoverAndLoadMCPTools, type MCPManager } from "./runtime-mcp";
// …
if (!sessionOptions.mcpManager) {
  try {
    const mcpResult = await discoverAndLoadMCPTools(getProjectDir(), { authStorage, enableProjectConfig: true });
    sessionOptions.mcpManager = mcpResult.manager;
    const mcpTools = mcpResult.tools.map(loaded => loaded.tool); // LoadedCustomTool → CustomTool
    if (mcpTools.length > 0) sessionOptions.customTools = [...(sessionOptions.customTools ?? []), ...mcpTools];
  } catch (error) {
    logger.warn("MCP discovery failed; continuing without MCP tools", { error });
  }
}
```

핵심 2가지:

1. **cwd는 `getProjectDir()`** — print 경로에서 `sessionManager`가 `undefined`라
   `sessionManager.getCwd()`는 못 씀(초기 시도가 가드에 막혀 통째 스킵됐던 버그).
2. **`mcpManager`만으론 부족** — `createTools()`는 MCP 매니저를 참조조차 안 함. setInstance는
   싱글톤만 등록할 뿐 세션 도구목록엔 안 들어감. 그래서 `mcpResult.tools`를 `LoadedCustomTool.tool`로
   언랩해 `options.customTools`로 명시 전달해야 모델이 본다. (probe에서 `t.name`이 undefined였던 건
   래퍼의 `.tool.name`을 안 읽어서였음.)

best-effort: 실패/타임아웃 서버는 swallow하고 startup 진행.

## startup 레이스 — `STARTUP_TIMEOUT_MS = 250`

`runtime-mcp/manager.ts:60`. `discoverAndConnect`는 모든 서버를 병렬 연결하고
`Promise.race([allSettled, delay(250)])`(`:457`). 250ms 내 미완 서버는 tool-cache 확인 후
캐시 없으면 `connectionAbort.abort()`(`:480`). tool-cache는 agent.db(`tool-cache.ts`)에 서버별
도구 정의 저장 — 다음 startup을 빠르게.

- 가벼운 node 스크립트(방법론 A): 250ms 통과 → 정상.
- 서명된 .app(방법론 B): 250ms 초과 + 캐시 없음 → abort → 영구 실패([20](./20_methodology_b_codex_sky_app.md)).

## 스키마 정규화 — `$ref`/`prefixItems`

provider 함수 파라미터 스키마는 **`$ref` 미지원**(OpenAI·xAI 모두 400). MCP 도구 스키마는
`tool-bridge.ts`의 `normalizeSchemaForMCP`(`@gajae-code/ai/utils/schema`)로 정규화되지만 **`$ref`
인라인(dereference)은 안 함** — `$ref`가 그대로 provider에 전달돼 400.

방법론 A는 cu-mcp 소스에서 `$ref` 미발생하게 고쳐 우회([10](./10_methodology_a_cu_mcp_reimpl.md) §선결수정 1).
**일반 해법 후보**: `normalizeSchemaForMCP`에 로컬 `$ref` dereference 패스 추가(루트 기준 JSON 포인터
인라인, 순환 가드). 단 방법론 A의 `$ref`는 타깃(`coordinate/items/0`)이 실재하지 않는 **깨진 ref**라
dereference로도 못 고침 — 소스 수정이 정답이었음. 진짜 `$defs` 기반 서버를 위해선 jawcode deref가
유효.

## 근거

| 영역 | 위치 |
|---|---|
| 격리 선언 | `packages/coding-agent/src/sdk.ts:278,1273` |
| 배선 | `packages/coding-agent/src/main.ts` `runRootCommand` (커밋 `0b493665`) |
| 설정 스캔 | `discovery/builtin.ts:204-211` · `utils/src/dirs.ts:477` getMCPConfigPath |
| startup 레이스 | `runtime-mcp/manager.ts:60,457,480` |
| 스키마 정규화 | `runtime-mcp/tool-bridge.ts:234` · `packages/ai/src/utils/schema/normalize.ts` |
