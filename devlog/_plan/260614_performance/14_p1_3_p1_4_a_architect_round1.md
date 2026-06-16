FAIL

[HIGH] packages/coding-agent/src/main.ts:914 — CLI MCP discovery runs for every mode before the mode === "acp" branch at :957; apply mode !== "acp" at this exact discovery block.

[HIGH] packages/coding-agent/src/main.ts:1008 — Non-interactive no-model startup calls process.exit(1) with no session.dispose(); inventory every post-createSession fatal exit between :971 and mode dispatch, including applyStartupModelProfilesOrExit at :981.

[HIGH] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 P1.4 — The sketched finally can collide with modes that already dispose: runPrintMode, interactive shutdown, and runRpcMode. Missing sessionDisposedOrRunnerOwnsDispose on any branch causes double-disconnect.

[MEDIUM] packages/coding-agent/src/modes/bridge/bridge-mode.ts:511 — runBridgeMode never disposes the session; specify bridge leaves disposal to root finally or add bridge dispose.

[MEDIUM] packages/coding-agent/src/main.ts:1043 — Interactive PI_TIMING === "x" uses process.exit(0) without session.dispose(); patch to dispose before exit.

[MEDIUM] packages/coding-agent/src/runtime-mcp/loader.ts:61 — discoverAndLoadMCPTools always returns an MCPManager; assign cliOwnedMcpManager whenever loader returns and cleanup when createSession throws after discovery.

[LOW] packages/coding-agent/src/main.ts:714 — Add discoverAndLoadMCPTools? to RunRootCommandDependencies without dropping settings?: Settings.

[LOW] packages/tui/src/components/box.ts:100 — P1.3 guard aligns with Container at tui.ts:235; contract is sound.

[MEDIUM] packages/coding-agent/test/acp-lazy-startup.test.ts:217 — Use this runRootCommand deps injection pattern for new MCP cleanup tests.

Most likely first break: root finally + session.dispose() without sessionDisposedOrRunnerOwnsDispose after print/interactive/rpc causes double disconnectAll().
