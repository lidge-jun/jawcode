# 09 — P1.3/P1.4 execution plan

> PABCD P-stage plan for implementing the next two performance follow-ups after P1.1/P1.2. Product/source edits are gated until P/A complete; the user already requested one full PABCD cycle.

## 1. Objective

Implement and verify:

1. **P1.3:** `Box.render()` skips direct committed children like `Container.render()` while preserving invalidate recursion and all-committed empty output.
2. **P1.4:** CLI-owned MCP managers are cleaned up on startup/session-creation failure and ACP mode skips normal CLI MCP discovery, without disconnecting externally supplied managers or double-disconnecting success paths.

## 2. Files and patch shape

### MODIFY `packages/tui/src/components/box.ts`

Purpose: close the committed-frame policy gap between `Container` and `Box`.

Planned diff:

```diff
 		const childLines: string[] = [];
 		for (const child of this.children) {
+			if (child.committed) continue;
 			const lines = child.render(contentWidth);
 			for (const line of lines) {
 				childLines.push(leftPad + line);
 			}
 		}
```

Constraints:

- Do not change Box padding, background, cache key generation, or cache result reuse.
- Do not change `Box.invalidate()`; it must still call `invalidate()` on committed children.
- All-committed Box must naturally return `[]` through the existing `childLines.length === 0` branch.
- This is contract hardening, not a large expected hot-path win, because top-level committed chat children are already skipped by `Container.render()`.

### ADD `packages/tui/test/box-committed-skip.test.ts`

Purpose: encode P1.3 behavior.

Test outline:

```ts
import { describe, expect, it, mock } from "bun:test";
import { Box } from "@gajae-code/tui/components/box";
import type { Component } from "@gajae-code/tui";

function child(lines: string[], committed = false): Component & { renderCount: () => number; invalidateCount: () => number } { ... }

describe("Box committed child rendering", () => {
	it("does not render committed direct children", () => { ... });
	it("renders live children while skipping committed siblings", () => { ... });
	it("returns empty output when every child is committed", () => { ... });
	it("still invalidates committed children", () => { ... });
});
```

Expected assertions:

- committed child render count remains zero after `box.render(width)`.
- live child render count increments and output includes live content only.
- all-committed Box render result equals `[]`.
- `box.invalidate()` increments committed child invalidate count.

### MODIFY `packages/coding-agent/src/main.ts`

Purpose: narrow MCP cleanup ownership to CLI-created managers and skip redundant ACP discovery.

Planned changes:

1. Add a test injection point to `RunRootCommandDependencies`:

```ts
interface RunRootCommandDependencies {
	createAgentSession?: typeof createAgentSession;
	discoverAuthStorage?: typeof discoverAuthStorage;
	discoverAndLoadMCPTools?: typeof discoverAndLoadMCPTools;
	buildSessionOptions?: typeof buildSessionOptions;
	runAcpMode?: typeof runAcpMode;
	settings?: Settings;
}
```

Production code uses `deps.discoverAndLoadMCPTools ?? discoverAndLoadMCPTools` and `deps.buildSessionOptions ?? buildSessionOptions`.

2. Add local cleanup state before MCP discovery:

```ts
let cliOwnedMcpManager: MCPManager | undefined;
let sessionCreated = false;
let sessionDisposedOrRunnerOwnsDispose = false;
const cleanupCliOwnedMcpManager = async (): Promise<void> => {
	if (!cliOwnedMcpManager) return;
	const manager = cliOwnedMcpManager;
	cliOwnedMcpManager = undefined;
	try {
		await manager.disconnectAll();
	} catch (error) {
		logger.warn("Failed to disconnect CLI-owned MCP manager during cleanup", { error: String(error) });
	}
	if (MCPManager.instance() === manager) {
		MCPManager.setInstance(undefined);
	}
};
```

3. Move or guard pre-session fatal exits so discovery is inside one cleanup scope:

- Wire `deps.buildSessionOptions ?? buildSessionOptions` at the current `main.ts` build-session-options call site.
- Move the invalid `--api-key` / missing model validation currently after discovery to before MCP discovery, because it only needs parsed args and selected model inputs.
- Wrap MCP discovery plus the non-ACP mode branch in a shared `try/finally` scope so any failure after discovery but before session handoff reaches cleanup.
- Use injected `buildSessionOptions` before discovery so tests can create a pre-populated `sessionOptions.mcpManager`.

4. Change discovery gate from:

```ts
if (!sessionOptions.mcpManager) {
```

to:

```ts
if (mode !== "acp" && !sessionOptions.mcpManager) {
```

at the current `main.ts` MCP discovery block.

Assign CLI ownership whenever the loader returns:

```ts
const discoverMcpTools = deps.discoverAndLoadMCPTools ?? discoverAndLoadMCPTools;
const mcpResult = await discoverMcpTools(getProjectDir(), {
	authStorage,
	enableProjectConfig: true,
});
cliOwnedMcpManager = mcpResult.manager;
sessionOptions.mcpManager = mcpResult.manager;
```

If `sessionOptions.mcpManager` was already present from injected/custom session options, `cliOwnedMcpManager` stays `undefined`; the root command must not disconnect that externally supplied manager.

5. Wrap the non-ACP session creation/run branch in explicit cleanup logic:

```ts
} else {
	let session: AgentSession | undefined;
	try {
		const result = await createSession(sessionOptions);
		session = result.session;
		sessionCreated = true;

		// post-create startup checks and mode dispatch happen here
		// Any path that exits before a mode runner owns disposal must call:
		// await session.dispose();
		// sessionDisposedOrRunnerOwnsDispose = true;

		// After entering a mode runner that already disposes the session on return
		// or shutdown, set sessionDisposedOrRunnerOwnsDispose = true after it returns.
	} finally {
		if (session && !sessionDisposedOrRunnerOwnsDispose) {
			await session.dispose();
			sessionDisposedOrRunnerOwnsDispose = true;
		}
		if (!sessionCreated) {
			await cleanupCliOwnedMcpManager();
		}
	}
}
```

6. Post-`createSession` early exits must be made cleanup-safe.

Non-interactive no-model error branch disposes before exit:

```ts
if (!isInteractive && !session.model) {
	process.stderr.write(...);
	process.stderr.write(...);
	await session.dispose();
	sessionDisposedOrRunnerOwnsDispose = true;
	stopThemeWatcher();
	await postmortem.quit(1);
	return;
}
```

The non-ACP branch must not call `applyStartupModelProfilesOrExit()` after session creation. Replace that call with a cleanup-safe `applyStartupModelProfiles()` call in the same branch:

```ts
try {
	await applyStartupModelProfiles({
		session,
		settings: settingsInstance,
		modelRegistry,
		parsedArgs,
		startupModel: sessionOptions.model,
		startupThinkingLevel: sessionOptions.thinkingLevel,
	});
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${chalk.red(`Error: ${message}`)}\n`);
	await session.dispose();
	sessionDisposedOrRunnerOwnsDispose = true;
	stopThemeWatcher();
	await postmortem.quit(1);
	return;
}
```

Keep `applyStartupModelProfilesOrExit()` available for ACP factory use unless ACP cleanup is separately refactored.

Interactive `PI_TIMING === "x"` exits before `runInteractiveMode()`, so it must also dispose before exit:

```ts
if ($env.PI_TIMING === "x") {
	await session.dispose();
	sessionDisposedOrRunnerOwnsDispose = true;
	stopThemeWatcher();
	await postmortem.quit(0);
	return;
}
```

7. Avoid double-disconnect on normal success paths:

- `runPrintMode()` already calls `session.dispose()` before returning. Remove the duplicate root `await session.dispose()` after `runPrintMode()`, then set `sessionDisposedOrRunnerOwnsDispose = true`, stop the theme watcher, and call `postmortem.quit(0)`.
- `runInteractiveMode()` disposes during shutdown; set `sessionDisposedOrRunnerOwnsDispose = true` after it returns.
- `runRpcMode()` owns session disposal on return; set `sessionDisposedOrRunnerOwnsDispose = true` after it returns.
- `runBridgeMode()` returns `Promise<never>` and does **not** dispose on the normal long-lived serve path. Do not mark it as runner-owned before awaiting it. If it throws during startup, the root `finally` must dispose the session.
- Do not call `cleanupCliOwnedMcpManager()` after a session was created and disposal ownership transferred to the session; `AgentSession.dispose()` handles `MCPManager.instance()`.

8. Do not change ACP per-record manager ownership in `packages/coding-agent/src/modes/acp/acp-agent.ts`.

9. No new `CreateAgentSessionOptions` ownership flag is added in this slice. Ownership is inferred only from the local `cliOwnedMcpManager` assigned by CLI discovery.

### ADD/MODIFY focused MCP tests

Likely target: `packages/coding-agent/test/main-cli-mcp-cleanup.test.ts` (new) or the nearest existing main/root-command lifecycle test if one already exists.

Test cases:

- `runRootCommand` non-ACP path: injected `discoverAndLoadMCPTools()` returns fake CLI-owned manager, injected `createAgentSession` throws before session creation; fake `disconnectAll()` called once and global instance cleared if set.
- Post-create startup failure: injected successful session plus no usable model branch and startup-profile error branch dispose the session exactly once, which disconnects MCP exactly once.
- Successful print path: `runPrintMode()` owns disposal; root code does not call `session.dispose()` a second time.
- Bridge startup throw path: `runBridgeMode()` throws before serving; root `finally` disposes the session once.
- External manager path: injected `buildSessionOptions()` returns preset `sessionOptions.mcpManager` before CLI discovery; discovery is skipped, `cliOwnedMcpManager` remains undefined, and root cleanup does not call `disconnectAll()` on the external manager.
- ACP path: injected `discoverAndLoadMCPTools` spy is not called by `runRootCommand`; existing `acp-mcp-isolation.test.ts` remains a regression-only companion.
- Existing `MCPManager.disconnectAll()` pending abort tests stay green.

## 3. Non-goals

- No P2 prepared-line cache or assistant streaming reuse.
- No P3 session materialization/RSS refactor.
- No tool registry/schema lazy metadata work.
- No automatic deletion of custom MCP config entries.
- No change to committed scrollback semantics, ctrl+o, ctrl+t, or TUI visual design.
- No broad MCP ownership rewrite beyond CLI-owned manager cleanup and ACP discovery skip.
- No new embedder ownership flag on `CreateAgentSessionOptions`; this slice infers ownership only through `runRootCommand`'s local `cliOwnedMcpManager`.

## 4. Verification plan

Focused commands after implementation:

```bash
bun test packages/tui/test/box-committed-skip.test.ts packages/tui/test/commit-lane.test.ts
bun test packages/coding-agent/test/main-cli-mcp-cleanup.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-mcp-isolation.test.ts
```

If main/root-command injection touches broader CLI startup types, also run:

```bash
bun --cwd=packages/coding-agent run check:types
```

Acceptance:

- Box committed direct children are not rendered.
- Live Box children still render normally.
- All-committed Box returns `[]`, not blank padding/background rows.
- Box invalidation still reaches committed children.
- CLI-owned MCP manager disconnects exactly once when session creation/startup fails after discovery.
- Successful paths do not double-disconnect the manager.
- ACP mode skips normal CLI MCP discovery and preserves ACP MCP isolation.
- Externally supplied managers are not disconnected by CLI-owned cleanup logic.
- Failed `disconnectAll()` during root cleanup is logged and does not mask the original startup/session error.

## 5. Risk controls

- Keep P1.3 as a one-line render guard plus tests.
- Keep P1.4 ownership explicit: only managers created by `runRootCommand` are eligible for root cleanup.
- Prefer dependency injection over brittle module mocks for MCP discovery in tests.
- Ensure all cleanup catches/logs disconnect errors only where existing process shutdown semantics require non-fatal cleanup; do not hide session creation errors.
