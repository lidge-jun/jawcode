# B-stage C-gate Unblock Report — Legacy workflow name inversion

Verdict: C-gate mechanical blockers cleared in current worktree.

## Source of truth checked first

Read `18_c_check_report.md` and resumed from its B-route blockers:

1. Rust scope guard rejected vendored Rust sources under `devlog/_upstream_omp/`.
2. Coding-agent typecheck failed in harness/RPC state lanes.
3. `test/rpc-get-state-payload.test.ts` expected stale `get_state.include` shape.

## Fresh mechanical evidence

- `bun run check:ts` → passed.
  - Biome passed.
  - Node 20 baseline guard passed.
  - JSON schema check passed.
  - UI redesign + rebrand strict gates passed.
  - All workspace TypeScript checks passed.
- `bun run check:rs` → passed.
  - Rust scope check passed.
  - `crates/pi-natives` compiled successfully.
- `bun run check` → passed with parallel TS + Rust gates green.

## Focused regression evidence for files touched while clearing type/format blockers

- `bun test packages/coding-agent/test/default-mcp-config.test.ts packages/coding-agent/test/session-manager/build-context.test.ts packages/coding-agent/test/modes/utils/render-initial-messages-dedupe.test.ts` → 30 pass, 0 fail.

## Note

A broader ad hoc run including `packages/coding-agent/test/sdk-mcp-discovery.test.ts` remains red in the current worktree. That failure is in the generic/MCP tool-discovery behavior lane and is separate from the C-gate blockers listed in `18_c_check_report.md`; `bun run check` does not exercise that test file.
