# 211 — Computer Use/CUA MCP default restore plan

## Problem

The Context7 MCP setup patch made the default MCP installer manage only
`mcpServers.context7`. That preserved arbitrary existing entries when they were
already present, but it did not restore the previously planned Computer Use
surface. On the user's machine, `/Users/jun/.jwc/agent/mcp.json` now contains
only `context7`, so both `computer-use` and `cua-driver` disappear from `/mcp`
and from runtime MCP discovery.

## Confirmed evidence

- `packages/cu-mcp-server/dist/index.js` exists and is packaged in the repo.
- `packages/cu-mcp-server/bin/cu-native` exists for the local native backend.
- `/Users/jun/.local/bin/cua-driver` exists and reports `cua-driver 0.5.3`.
- `structure/21_extensibility.md` still documents cu-mcp plus cua-driver.
- `packages/coding-agent/src/defaults/jwc/mcp-defaults.json` contains only `context7`.
- `packages/coding-agent/src/defaults/jwc-defaults.ts` hard-codes
  `defaultContext7` / `serverName: "context7"`.
- `packages/coding-agent/src/cli/setup-cli.ts` prints/checks "MCP context7"
  as a single-server default, so the consumer must be updated with the result
  shape.
- `packages/coding-agent/test/default-mcp-config.test.ts` asserts only Context7.
- Tool overexposure is already mitigated by the MCP discovery/BM25 layer in
  `packages/coding-agent/src/tool-discovery/tool-index.ts`.

## Design

Restore Computer Use as **managed default MCP entries**, not as always-selected
tools.

Managed entries:

1. `context7`
   - static default from `mcp-defaults.json`
   - command: `npx`
   - args: `["-y", "@upstash/context7-mcp@latest"]`
2. `computer-use` (macOS only)
   - command: `node`
   - args: computed absolute path to `packages/cu-mcp-server/dist/index.js`
   - env:
     - `CU_MCP_MODE=consolidated`
     - `CU_NATIVE_PATH=<computed absolute path to packages/cu-mcp-server/bin/cu-native>`
   - rationale: one consolidated `computer_use` action tool instead of the legacy
     29-tool surface.
3. `cua-driver` (macOS only)
   - command: `cua-driver`
   - args: `["mcp"]`
   - rationale: background/AX/SkyLight backend, optional by PATH. If not
     installed, only that server fails; other MCP servers continue.

Installer policy:

- Install/check all managed default entries.
- Always update only managed entries.
- Preserve all unmanaged user/project entries and top-level fields.
- In check mode, return `missing`, `different`, or `matching` for the managed set.
  Aggregation order is `missing` > `different` > `matching`: any missing
  managed server reports `missing`; otherwise any changed managed server reports
  `different`; only an exact match for every managed server reports `matching`.
- Do not auto-activate every MCP tool. Runtime selection remains governed by the
  existing MCP discovery/BM25 layer and session selection state.
- On non-darwin platforms, only cross-platform defaults are managed. Computer
  Use/CUA entries are not installed by default because the packaged server and
  native backend are macOS-only. Existing unmanaged user entries must still be
  preserved.

## Diff-level plan

### MODIFY `packages/coding-agent/src/defaults/jwc-defaults.ts`

- Change `DefaultMcpConfigInstallResult.serverName` from `"context7"` to
  `serverNames: string[]`.
- Add helpers:
  - `getManagedDefaultMcpServers(): Record<string, MCPServerConfig>`
  - `getCuMcpServerConfig(): MCPServerConfig`
  - `getCuMcpServerEntryPath(): string`
  - `getCuNativePath(): string`
  - `getManagedDefaultMcpStatus(existing, defaults): DefaultJwcInstallStatus`
- Keep Context7 sourced from `mcp-defaults.json`.
- Compute `computer-use` paths via the existing package directory contract:
  `path.resolve(getPackageDir(), "../cu-mcp-server/...")`. This respects
  `GJC_PACKAGE_DIR` / `PI_PACKAGE_DIR` overrides and works for the current
  workspace layout.
- Add a platform gate so `computer-use` and `cua-driver` managed entries are
  returned only when the target platform is darwin. Keep Context7 as the
  cross-platform managed default.
- Merge managed defaults into `existing.mcpServers` while preserving unmanaged
  entries and top-level fields.

### MODIFY `packages/coding-agent/src/cli/setup-cli.ts`

- Replace single-server "MCP context7" output with "MCP defaults".
- Include `mcpResult.serverNames.join(", ")` in human-readable output.
- Preserve JSON output shape, but now nested `mcp` contains `serverNames`
  instead of `serverName`.

### MODIFY `packages/coding-agent/test/default-mcp-config.test.ts`

- Update result shape expectations from `serverName` to `serverNames`.
- Assert fresh install writes `context7`, `computer-use`, and `cua-driver`.
- Assert `computer-use` uses consolidated mode and `CU_NATIVE_PATH`.
- Assert check mode reports:
  - `missing` when any managed default is absent
  - `different` when any managed default differs
  - `matching` when all managed defaults match
- Assert unmanaged MCP entries remain preserved.
- Assert install updates only managed entries and leaves legacy/unmanaged entries
  untouched.
- Assert macOS target installs `context7`, `computer-use`, and `cua-driver`.
- Assert non-mac target installs/checks only cross-platform defaults while
  preserving any existing unmanaged Computer Use/CUA entries.

### MODIFY `packages/coding-agent/src/defaults/jwc/mcp-defaults.json`

- Keep static Context7 default as-is.
- Do not encode dynamic local filesystem paths in JSON.

### MODIFY `structure/21_extensibility.md`

- Update Computer Use registration row so it no longer claims only manual
  `~/.jwc/agent/mcp.json` registration.
- State that JWC default setup restores both `computer-use` and `cua-driver`,
  while discovery/BM25 keeps tools hidden/searchable instead of forcing all tools
  into the prompt.

### MODIFY `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/180_validation_matrix.md`

- Add validation rows for:
- default MCP installer preserving unmanaged entries while restoring managed
    Context7 + macOS-only Computer Use/CUA entries
  - cu-mcp consolidated mode path/env contract
  - CUA driver optional PATH contract
  - MCP discovery/BM25 overexposure guard

## Verification

Minimum focused commands:

```bash
bun test packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/agent-session-mcp-discovery.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-builtins.test.ts
git diff --check
```

Optional live smoke:

```bash
bun packages/coding-agent/src/cli.ts setup defaults
bun packages/coding-agent/src/cli.ts /mcp list
```

Do not require `cua-driver mcp` to stay connected in unit tests; it is an
external macOS daemon path and should remain optional/non-fatal. Non-mac tests
must prove the Computer Use/CUA entries are skipped by default.
