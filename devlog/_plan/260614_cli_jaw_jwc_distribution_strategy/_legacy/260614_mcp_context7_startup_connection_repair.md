# 210 — MCP Context7 startup connection repair

## Problem

`jwc` installed the default Context7 MCP entry correctly, but `/mcp list` could show:

```text
context7 ○ not connected [stdio]
```

Root cause was not the Context7 package or user config. Local reproduction showed:

- `~/.jwc/agent/mcp.json` loaded `context7` from the user-level MCP config.
- Direct `connectToServer("context7", { command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] })` succeeded.
- Context7 exposed `resolve-library-id` and `query-docs`.
- The runtime manager aborted startup connections after a 250ms grace window when no cached tools existed.

That policy is too aggressive for `npx`-backed stdio MCP servers. A valid first startup can take several seconds, so aborting after 250ms converted a slow startup into a false disconnected state.

## Patch

### Runtime manager

File:

```path
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/runtime-mcp/manager.ts
```

Change:

- Keep slow uncached startup connections in-flight after the startup grace window.
- Report the server as `connecting` instead of aborting and deleting pending state.
- Let the existing background `toolsPromise` handler finish connection, load tools, replace server tools, and call `onToolsChanged`.

### TUI session refresh

File:

```path
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/main.ts
```

Change:

- After session creation, subscribe to `mcpManager.setOnToolsChanged`.
- Refresh the session MCP tool registry when a background MCP connection finishes.

### ACP session refresh

File:

```path
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/modes/acp/acp-agent.ts
```

Change:

- Attach the same `setOnToolsChanged` refresh callback for ACP-managed MCP servers.
- Log refresh failures instead of swallowing them.

## Expected behavior

Immediately after `jwc` startup:

```text
context7 ◌ connecting [stdio]
```

After the `npx` stdio server finishes initialization:

```text
context7 ● connected [stdio]
```

Loaded tools become available in the session registry without requiring a restart:

- `mcp__context_resolve_library_id`
- `mcp__context_query_docs`

## Verification

Targeted tests:

```bash
bun test packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/acp-builtins.test.ts
```

Result:

```text
58 pass
0 fail
```

Live Context7 startup reproduction:

```bash
bun -e 'import { discoverAndLoadMCPTools } from "./packages/coding-agent/src/runtime-mcp/loader.ts"; const result = await discoverAndLoadMCPTools(process.cwd(), { enableProjectConfig: true, cacheStorage: null }); console.log(result.manager.getConnectionStatus("context7")); for (let i = 0; i < 80 && result.manager.getTools().length === 0; i++) await Bun.sleep(250); console.log(result.manager.getConnectionStatus("context7"), result.manager.getTools().map(t=>t.name)); await result.manager.disconnectAll();'
```

Observed:

```text
initialStatus: connecting
finalStatus: connected
finalTools: mcp__context_query_docs, mcp__context_resolve_library_id
```

Typecheck note:

```bash
bun --cwd=packages/coding-agent run check:types
```

Current result is blocked by unrelated dirty file errors in:

```path
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/modes/components/_cli-jaw-entry.ts
```

The reported missing exports are unrelated to the MCP startup patch.
