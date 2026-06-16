# 85 — C-stage check report: Lazy cua-driver MCP Proxy

## Mechanical gates

- `bun run check` — PASS. Workspace TS/Biome/schema/UI/rebrand/Rust checks completed successfully.
- `bun test packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/tools/computer-use.test.ts packages/coding-agent/test/tool-discovery/initial-tools.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts` — PASS, 26 pass / 0 fail / 73 assertions.
- `bun run check:types` in `packages/coding-agent` — PASS, no type errors.
- Targeted Biome check for changed TS/test files — PASS.

## Non-gating observations

- `bun test packages/coding-agent/test/sdk-mcp-discovery.test.ts` is currently red on pre-existing discovery-mode expectations unrelated to this patch (for example `find` is active where that suite expects it hidden, and MCP selection arrays are empty). No changes from this patch remain in that test file.
- `jwc setup defaults --check` is red in this developer environment because local user defaults need broader remediation (`Missing: 3; different: 2`) and the exact legacy `cua-driver` entry now correctly makes MCP defaults report `different` until cleanup is written.

## Acceptance review

- Managed defaults now install `context7` only; exact legacy managed `cua-driver` is detected and removed in write mode while custom `cua-driver` configs are preserved.
- `computer_use` is a built-in discoverable tool, not essential/active by default.
- `LazyCuaDriverBackend` has no startup side effects; it connects only from `call()` using direct MCP client primitives and reuses the connection promise.
- Session cleanup is registered through `ToolSession.registerSessionCleanup` and drained during `AgentSession.dispose()`.
- Docs/devlog/changelog/tests were updated for the lazy proxy and manual MCP coexistence decision.

## Verdict

PASS — proceed to D.
