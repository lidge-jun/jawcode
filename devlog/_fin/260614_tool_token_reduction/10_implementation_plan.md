# 10 — 구현 계획: 도구 토큰 감축

> C3 작업: 설정 스키마, 도구 레지스트리, MCP 기본값, 검색 도구, 테스트, 문서 횡단 변경

## Phase 1: 설정 및 도구 레지스트리 변경

### MODIFY `packages/coding-agent/src/config/settings-schema.ts`

**변경 1**: `tools.discoveryMode` 기본값 `"off"` → `"all"`

```diff
 "tools.discoveryMode": {
     type: "enum",
     values: ["off", "all"] as const,
-    default: "off",
+    default: "all",
     ui: {
         tab: "tools",
         label: "Tool Discovery",
         description: "Hide non-essential built-in tools behind a search tool to save tokens.",
     },
 },
```

위치: `settings-schema.ts:2360`

### MODIFY `packages/coding-agent/src/tools/index.ts`

**변경 2**: `DEFAULT_ESSENTIAL_TOOL_NAMES` 3개 → 14개 (`search_tool_bm25`는 자동 생성이므로 별도)

```diff
-/** Default essential tool names when tools.essentialOverride is empty. */
-export const DEFAULT_ESSENTIAL_TOOL_NAMES: readonly string[] = ["read", "bash", "edit"] as const;
+/** Default essential tool names when tools.essentialOverride is empty.
+ * PI-optimized: enough for any model to do coding without discovery. */
+export const DEFAULT_ESSENTIAL_TOOL_NAMES: readonly string[] = [
+    "read",
+    "bash",
+    "edit",
+    "write",
+    "find",
+    "search",
+    "ast_grep",
+    "ast_edit",
+    "web_search",
+    "browser",
+    "ask",
+    "subagent",
+    "task",
+    "skill",
+] as const;
```

위치: `tools/index.ts:289-290`

참고: `search_tool_bm25`는 `createIf()` 조건으로 `discoveryMode !== "off"`일 때 자동 생성되므로
essential 목록에 넣을 필요 없음. `goal`은 conditional essential로 별도 경로 유지.

## Phase 2: MCP 기본값 변경

### MODIFY `packages/coding-agent/src/defaults/jwc-defaults.ts`

**변경 3**: managed MCP에서 `computer-use` 제거, `cua-driver`만 유지

```diff
 export function getManagedDefaultMcpServers(
     platform: NodeJS.Platform = process.platform,
 ): Record<string, MCPServerConfig> {
     const defaults = mcpDefaults as MCPConfigFile;
     const defaultContext7 = defaults.mcpServers?.context7;
     if (!defaultContext7) throw new Error("Bundled MCP defaults are missing the context7 server entry.");

     const managedServers: Record<string, MCPServerConfig> = {
         context7: defaultContext7,
     };

     if (platform === "darwin") {
-        managedServers["computer-use"] = getCuMcpServerConfig();
         managedServers["cua-driver"] = {
             command: "cua-driver",
             args: ["mcp"],
         };
     }

     return managedServers;
 }
```

위치: `jwc-defaults.ts:223-243`

**변경 4**: `getCuMcpServerConfig()`, `getCuMcpServerEntryPath()`, `getCuNativePath()` 함수 삭제

```diff
-function getCuMcpServerConfig(): MCPServerConfig {
-    return {
-        command: "node",
-        args: [getCuMcpServerEntryPath()],
-        env: {
-            CU_MCP_MODE: "consolidated",
-            CU_NATIVE_PATH: getCuNativePath(),
-        },
-    };
-}
-
-function getCuMcpServerEntryPath(): string {
-    return path.resolve(getPackageDir(), "../cu-mcp-server/dist/index.js");
-}
-
-function getCuNativePath(): string {
-    return path.resolve(getPackageDir(), "../cu-mcp-server/bin/cu-native");
-}
```

위치: `jwc-defaults.ts:245-262`

참고: `cu-mcp-server` 패키지 자체는 삭제하지 않음. 사용자가 수동으로 `mcp.json`에 추가해서 사용할 수 있음.
`getPackageDir` import는 CU 함수에서만 사용하므로 함께 제거.

## Phase 3: search_tool_bm25 도구 스냅샷 추가

### MODIFY `packages/coding-agent/src/prompts/tools/search-tool-bm25.md`

**변경 5**: 도구 이름+설명 스냅샷 섹션 추가

```diff
 Search hidden tool metadata to discover and activate tools.

 Activate hidden tools (MCP and built-in) when you need a capability not in your active tool set.
 {{#if hasDiscoverableMCPServers}}Discoverable MCP servers in this session: {{#list discoverableMCPServerSummaries join=", "}}{{this}}{{/list}}.{{/if}}
 {{#if discoverableMCPToolCount}}Total discoverable tools available: {{discoverableMCPToolCount}}.{{/if}}
+{{#if hasDiscoverableToolSnapshot}}
+Available tools (search by name or keyword to activate):
+{{#list discoverableToolSnapshot join="\n"}}{{this}}{{/list}}
+{{/if}}
 Input:
```

### MODIFY `packages/coding-agent/src/tool-discovery/tool-index.ts`

**변경 6**: 도구 스냅샷 포맷 함수 추가

```typescript
export function formatDiscoverableToolSnapshot(tools: DiscoverableTool[]): string[] {
    return tools.map(t => {
        const prefix = t.serverName ? `[${t.serverName}] ` : "";
        const summary = t.summary.length > 80 ? t.summary.slice(0, 77) + "..." : t.summary;
        return `- ${prefix}${t.name}: ${summary}`;
    });
}
```

위치: `tool-index.ts` — `formatDiscoverableToolServerSummary()` 뒤에 추가

### MODIFY `packages/coding-agent/src/tools/search-tool-bm25.ts`

**변경 7**: `renderSearchToolBm25Description()`에 스냅샷 변수 추가

```diff
 export function renderSearchToolBm25Description(discoverableTools: DiscoverableTool[] = []): string {
     const summary = summarizeDiscoverableTools(discoverableTools);
+    const snapshot = formatDiscoverableToolSnapshot(discoverableTools);
     return prompt.render(searchToolBm25Description, {
         discoverableMCPToolCount: summary.toolCount,
         discoverableMCPServerSummaries: summary.servers.map(formatDiscoverableToolServerSummary),
         hasDiscoverableMCPServers: summary.servers.length > 0,
+        hasDiscoverableToolSnapshot: snapshot.length > 0,
+        discoverableToolSnapshot: snapshot,
     });
 }
```

import에 `formatDiscoverableToolSnapshot` 추가.

## Phase 4: 테스트 업데이트

### MODIFY `packages/coding-agent/test/default-mcp-config.test.ts`

**변경 8**: computer-use 관련 테스트 수정

- macOS 기본 설치 테스트: `serverNames`에서 `"computer-use"` 제거, `["context7", "cua-driver"]`만 확인
- computer-use consolidated mode 테스트: 삭제 또는 "수동 등록 시" 테스트로 전환
- CU_NATIVE_PATH 환경변수 테스트: 삭제
- 비-macOS 테스트: computer-use 관련 assertion 제거
- unmanaged entries preservation 테스트: 기존 `computer-use` 엔트리가 user entry로 보존되는지 확인 유지

### MODIFY `packages/coding-agent/test/tool-discovery/initial-tools.test.ts`

**변경 9**: essential 도구 세트 테스트 업데이트

- `DEFAULT_ESSENTIAL_TOOL_NAMES` 길이 테스트: 3 → 14 (search_tool_bm25는 자동 생성이므로 별도)
- 기본 discoveryMode가 "all"인 테스트: discoverable 도구가 초기 active에서 제외되는지 확인
- `computeEssentialBuiltinNames()` 테스트: 새 기본값 14개 반환 확인
- essentialOverride 테스트: override가 새 기본값을 대체하는지 확인
- search_tool_bm25가 discoveryMode=all일 때 자동 생성되는지 기존 테스트 유지

## Phase 4.5: MCP discovery 활성화

### MODIFY `packages/coding-agent/src/sdk.ts`

**변경 추가**: `mcpDiscoveryEnabled` 하드코딩 `false` → `effectiveDiscoveryMode === "all"`로 연동

```diff
-		// Effective discovery mode only covers built-in tools; MCP tool discovery
-		// is quarantined from the GJC public surface.
 		const toolsDiscoveryModeSetting = settings.get("tools.discoveryMode");
 		const effectiveDiscoveryMode: "off" | "all" = toolsDiscoveryModeSetting === "all" ? "all" : "off";
-		const mcpDiscoveryEnabled = false;
+		const mcpDiscoveryEnabled = effectiveDiscoveryMode === "all";
```

위치: `sdk.ts:1639-1643`

근거: `mcpDiscoveryEnabled = false`가 하드코딩되어 MCP 도구(cua-driver 36개 + context7 2개)가
`discoveryMode=all`에서도 모두 eager load됨. built-in만 defer하면 ~9k 절감에 그치고,
MCP까지 defer해야 목표 14-16k 달성 가능.

## Phase 5: 문서 업데이트

### MODIFY `structure/21_extensibility.md`

**변경 10**: Computer Use 등록 섹션 업데이트

- managed default에서 `computer-use` 제거 반영
- `cua-driver`만 macOS managed default로 기술
- `computer-use`(cu-mcp-server)는 수동 등록 가능으로 표기
- `tools.discoveryMode=all` 기본값 변경 반영

## 검증 명령

```bash
# 단위 테스트
bun test packages/coding-agent/test/default-mcp-config.test.ts
bun test packages/coding-agent/test/tool-discovery/initial-tools.test.ts
bun test packages/coding-agent/test/agent-session-mcp-discovery.test.ts

# TypeScript 컴파일 (repo 규칙: bun check 사용)
bun check

# 전체 테스트
bun test packages/coding-agent/test/

# 릴리즈 검증
bun run validate:jwc-release
```

## 위험 요소

| 위험 | 영향 | 완화 |
|---|---|---|
| PI 모델이 search_tool_bm25를 못 씀 | deferred 도구 접근 불가 | essential 14개로 기본 코딩 가능, 스냅샷으로 검색 유도 |
| cua-driver PATH에 없을 때 | MCP 연결 실패 | 기존 동작: 해당 서버만 실패, 다른 MCP 정상 |
| 기존 사용자 discoveryMode 설정 | off → all 마이그레이션 | 설정 변경이므로 기존 명시적 설정은 유지됨 |
| 스냅샷 토큰 비용 | ~750 토큰 추가 | 전체 스키마(~14k) 대비 미미. PI 모델 호환성 가치가 큼 |

## 변경 파일 요약

| 파일 | 작업 | 변경 수 |
|---|---|---|
| `packages/coding-agent/src/config/settings-schema.ts` | MODIFY | 1 (기본값) |
| `packages/coding-agent/src/tools/index.ts` | MODIFY | 1 (essential 목록) |
| `packages/coding-agent/src/defaults/jwc-defaults.ts` | MODIFY | 2 (managed MCP + 함수 삭제) |
| `packages/coding-agent/src/prompts/tools/search-tool-bm25.md` | MODIFY | 1 (스냅샷 템플릿) |
| `packages/coding-agent/src/tools/search-tool-bm25.ts` | MODIFY | 1 (스냅샷 렌더링) |
| `packages/coding-agent/src/tool-discovery/tool-index.ts` | MODIFY | 1 (스냅샷 함수) |
| `packages/coding-agent/test/default-mcp-config.test.ts` | MODIFY | 다수 (CU 제거 반영) |
| `packages/coding-agent/test/tool-discovery/initial-tools.test.ts` | MODIFY | 다수 (essential 변경 반영) |
| `structure/21_extensibility.md` | MODIFY | 1 (CU 섹션) |
| **합계** | | **9 파일** |
