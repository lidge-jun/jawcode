# 171 - mac MCP/CUA release guard

## Goal

Make the macOS-only Computer Use/CUA MCP packaging surface part of the release proof instead of a side-plan.

## Patch

- Renamed the publishable helper package from the legacy scoped CU package name to `jawcode-cu-mcp-server`.
- Updated the G002 package/bin gate so `cu-mcp-server` is still the binary name, but the package name is Jawcode-branded.
- Added the mac MCP/CUA default tests to `bun run validate:jwc-release`.

The managed default remains:

- `context7` on every platform.
- `computer-use` on macOS only, pointing at `packages/cu-mcp-server/dist/index.js`.
- `cua-driver` on macOS only, using `cua-driver mcp` from `PATH`.

The MCP tool surface remains discovery/session-selected. These defaults write MCP server entries; they do not force all MCP tools into every prompt.

## Verification

Commands run:

```sh
npm view jawcode-cu-mcp-server name --json
bun install --lockfile-only
bun scripts/verify-g002-gates.ts
bun test packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/agent-session-mcp-discovery.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-builtins.test.ts
bun run validate:jwc-release
git diff --check
```

Evidence:

```text
npm view jawcode-cu-mcp-server -> E404 Not Found, name currently unoccupied
G002 gate verification passed.
79 pass
0 fail
[validate:jwc-release] mac mcp/cua defaults
[validate:jwc-release] OK
```
