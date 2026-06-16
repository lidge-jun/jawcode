# 15 — P1.3/P1.4 A-audit revision round 1

Plan revised after Stage-A planner/architect FAIL reports.

Changes applied to `09_p1_3_p1_4_execution_plan.md`:

- Added `buildSessionOptions?: typeof buildSessionOptions` to `RunRootCommandDependencies` so tests can inject preset `sessionOptions.mcpManager` before CLI discovery.
- Strengthened `cleanupCliOwnedMcpManager()` pseudocode to catch/log disconnect errors without masking the original failure and to clear `MCPManager.instance()` only when it still points to the manager.
- Required moving invalid `--api-key` / missing-model validation before MCP discovery so pre-session fatal exits do not bypass cleanup.
- Pinned the ACP skip to the current main.ts MCP discovery block and required `mode !== "acp"` there.
- Clarified `runPrintMode()` already disposes; root duplicate `session.dispose()` after print must be removed.
- Clarified `runBridgeMode()` does not dispose or return on the long-lived path; startup throws are cleaned by root finally.
- Added explicit non-goal: no new `CreateAgentSessionOptions` ownership flag in this slice.
- Strengthened MCP tests for no-model, startup-profile error, print no-double-dispose, bridge startup throw, external manager injection, and ACP discovery spy.
