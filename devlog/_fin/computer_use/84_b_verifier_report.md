DONE
[info] packages/coding-agent/src/defaults/jwc-defaults.ts — managed default cleanup removes only exact legacy `cua-driver` and `getManagedDefaultMcpServers()` returns context7 only.
[info] packages/coding-agent/src/tools/computer-use.ts — `computer_use` is a discoverable built-in proxy and registers session-scoped cleanup.
[info] packages/coding-agent/src/tools/computer-use-backend.ts — backend lazy-connects through direct `connectToServer`/`listTools`/`callTool`, not startup `MCPManager.connectServers()`.
[info] packages/coding-agent/src/session/agent-session.ts + packages/coding-agent/src/sdk.ts — per-session tool cleanup map is passed and drained during dispose.
[info] packages/coding-agent/test/default-mcp-config.test.ts + packages/coding-agent/test/tools/computer-use.test.ts + packages/coding-agent/test/fixtures/cua-driver-tools.json — focused coverage exists for managed defaults, proxy mapping, validation, and cleanup registration.
Verifier reference: .jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-architect.md
