# 210 — `/mcp` command + Context7 setup merge plan

## Goal

Make packaged Jawcode (`jwc`) usable for MCP management without manual private config surgery:

1. `/mcp` is a real builtin slash command in both TUI and ACP/text command surfaces.
2. `jwc setup defaults` installs/updates the bundled Context7 MCP entry.
3. Existing user MCP config is preserved except for the single managed `mcpServers.context7` entry.
4. Verification stays mocked/contract-level: no real Smithery login, no OAuth browser flow, no external MCP server connection required.

## Current code facts

- TUI owner already exists: `packages/coding-agent/src/modes/controllers/runtime-mcp-command-controller.ts`.
- ACP/text owner already exists: `packages/coding-agent/src/slash-commands/helpers/mcp.ts`.
- Builtin dispatch owner is `packages/coding-agent/src/slash-commands/builtin-registry.ts`.
- ACP exposure is derived from builtin specs with `handle`: `packages/coding-agent/src/slash-commands/acp-builtins.ts`.
- Setup defaults originally installed workflow skill files only: `packages/coding-agent/src/cli/setup-cli.ts` → `installDefaultJwcDefinitions()`. This patch extends that path with Context7 MCP defaults.
- Bundled default MCP config already exists at `packages/coding-agent/src/defaults/jwc/mcp-defaults.json`.

## Scope

### 1. Default Context7 MCP merge

Modify `packages/coding-agent/src/defaults/jwc-defaults.ts`:

- import bundled `mcp-defaults.json`;
- add `installDefaultMcpConfig(options)`;
- target `<agentDir>/mcp.json` by default, or `<targetRoot>/mcp.json` in tests;
- in `--check`, report `missing`, `matching`, or `different`;
- in install mode, always update only `mcpServers.context7`;
- preserve every other top-level MCP config field and every non-context7 server entry.

Modify `packages/coding-agent/src/cli/setup-cli.ts`:

- call `installDefaultMcpConfig()` from `setup defaults`;
- include the MCP result in JSON output;
- make `setup defaults --check` fail when context7 is missing/different;
- print a human-readable MCP target/status line.

### 2. `/mcp` builtin command registration

Modify `packages/coding-agent/src/slash-commands/builtin-registry.ts`:

- register `name: "mcp"`;
- advertise all existing subcommands from the TUI controller;
- route ACP/text to `handleMcpAcp`;
- route TUI to `new MCPCommandController(runtime.ctx).handle(command.text)`;
- keep TUI-only OAuth/Smithery/browser subcommands handled by the existing TUI controller;
- keep ACP/text TUI-only subcommands guarded by `handleMcpAcp`.

### 3. Tests

Modify `packages/coding-agent/test/acp-builtins.test.ts`:

- delete the old quarantine expectation that `/mcp` falls through;
- assert `/mcp` is advertised in ACP;
- assert `/mcp help`, `/mcp list`, `/mcp reload`, `/mcp notifications`, `/mcp reauth`, `/mcp unauth`, `/mcp smithery-login`, `/mcp smithery-logout`, `/mcp reconnect`, `/mcp test`, `/mcp add`, `/mcp enable`, `/mcp disable`, `/mcp remove`, `/mcp resources`, `/mcp prompts`, and unknown subcommands are consumed with mocked/no-live behavior.

Add `packages/coding-agent/test/default-mcp-config.test.ts`:

- assert bundled Context7 default shape;
- assert install writes `<targetRoot>/mcp.json`;
- assert check mode reports missing/different/matching;
- assert install overwrites only `mcpServers.context7` while preserving other servers and top-level fields.

Modify `scripts/verify-g002-gates.ts`:

- invert the old MCP quarantine assertion for the builtin command surface;
- keep package exports private and public MCP docs blocked;
- require `/mcp` builtin registration and ACP handler reference now that `/mcp` is an intentional managed command surface.

## Verification

Focused:

```bash
bun test packages/coding-agent/test/acp-builtins.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts
```

becomes:

```bash
bun test packages/coding-agent/test/acp-builtins.test.ts packages/coding-agent/test/default-mcp-config.test.ts
```

Type/check:

```bash
bun --cwd=packages/coding-agent run check:types
```

Registry sanity:

```bash
bun test packages/coding-agent/test/help-command.test.ts packages/coding-agent/test/utility-extensibility-quarantine.test.ts
```

G002 gate:

```bash
bun scripts/verify-g002-gates.ts
```

## Non-goals

- No live Smithery/OAuth browser flow test.
- No external MCP server network connection.
- No new MCP protocol implementation.
- No rewrite of existing runtime MCP controller/helper logic.
