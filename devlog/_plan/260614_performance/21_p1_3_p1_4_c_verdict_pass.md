# P1.3/P1.4 C-stage verdict

PASS

Mechanical gates:

- `bun run check` — pass.
- `bun test packages/tui/test/box-committed-skip.test.ts packages/coding-agent/test/main-cli-mcp-cleanup.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-mcp-isolation.test.ts` — pass (19 tests, 52 assertions).

Adversarial review:

- `agent://13-P13P14CAdversarial` returned PASS.
- Acceptance mapping confirmed P1.3 direct committed-child skip and unchanged invalidate propagation.
- Acceptance mapping confirmed P1.4 normal MCP discovery skip for ACP/external managers, CLI-owned pre-session cleanup, and created-session ownership across startup-profile, no-model, `PI_TIMING=x`, print, and bridge paths.

Residual risks are low and non-blocking:

- Cleanup-failure warning is code-reviewed but not logger-spy asserted.
- RPC runner-owned disposal is code-reviewed; direct injected RPC no-double-dispose regression coverage was not added because current runner contract owns disposal after return.
- Existing `commit-lane.test.ts` remains environment-sensitive and orthogonal to the new Box contract; new Box-specific tests cover this patch.
