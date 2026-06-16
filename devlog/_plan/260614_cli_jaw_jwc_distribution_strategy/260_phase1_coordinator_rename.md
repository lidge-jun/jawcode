# 260 — Phase 1: gjc_coordinator → jwc_coordinator

> PABCD Cycle 1 of 4 — dev branch
> Classification: C3 (cross-module, public MCP contract change)

## Goal

Rename all `gjc_coordinator` MCP tool names and `GJC_COORDINATOR_*` env vars
to `jwc_coordinator` / `JWC_COORDINATOR_*` with GJC fallback for env vars.

## Source files (MODIFY)

| File | Change |
|------|--------|
| `packages/coding-agent/src/coordinator/contract.ts` | Tool names `gjc_coordinator_*` → `jwc_coordinator_*` |
| `packages/coding-agent/src/coordinator-mcp/server.ts` | Tool name routing + session env constant imports |
| `packages/coding-agent/src/coordinator-mcp/policy.ts` | Env reads: `JWC_COORDINATOR_*` primary, `GJC_COORDINATOR_*` fallback |
| `packages/coding-agent/src/coordinator-mcp/safety.ts` | Any GJC_COORDINATOR refs |
| `packages/coding-agent/src/setup/hermes-setup.ts` | DEFAULT_SERVER_KEY, env writes, template TOOL_PREFIX |
| `packages/coding-agent/src/jwc-runtime/session-state-sidecar.ts` | Exported constants `GJC_COORDINATOR_SESSION_*` → `JWC_COORDINATOR_SESSION_*` |

## Test files (MODIFY)

| File | Change |
|------|--------|
| `packages/coding-agent/test/coordinator-mcp-server.test.ts` | Tool name strings |
| `packages/coding-agent/test/coordinator-mcp.test.ts` | Tool name strings |
| `packages/coding-agent/test/coordinator-mcp-policy.test.ts` | Env var names |
| `packages/coding-agent/test/setup-cli.test.ts` | Server key + env var names |
| `packages/coding-agent/test/session-state-sidecar.test.ts` | Env constant imports |

## Generated file (SKIP — regenerates from docs)

- `packages/coding-agent/src/internal-urls/docs-index.generated.ts` — will update when docs are cleaned in Phase 3

## Env var compat pattern

```typescript
// policy.ts: read JWC_ first, fall back to GJC_
env.JWC_COORDINATOR_MCP_WORKDIR_ROOTS ?? env.GJC_COORDINATOR_MCP_WORKDIR_ROOTS
```

## Verification

```bash
bun test packages/coding-agent/test/coordinator-mcp-server.test.ts
bun test packages/coding-agent/test/coordinator-mcp.test.ts
bun test packages/coding-agent/test/coordinator-mcp-policy.test.ts
bun test packages/coding-agent/test/setup-cli.test.ts
bun test packages/coding-agent/test/session-state-sidecar.test.ts
```
