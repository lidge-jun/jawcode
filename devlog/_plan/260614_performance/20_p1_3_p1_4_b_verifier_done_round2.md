# P1.3/P1.4 B verifier — round 2

DONE

Architect verifier result: implementation satisfies the plan after C-stage fixups.

- P1.3: `Box.render` skips committed direct children while `Box.invalidate` still propagates to all children; tests cover skip/live/all-committed/invalidate behavior.
- P1.4: `runRootCommand` tracks CLI-owned MCP managers, skips normal discovery for ACP and externally supplied managers, cleans pre-session failures without masking the original error, and disposes created sessions across startup-profile, no-model, `PI_TIMING=x`, bridge throw, and print-mode ownership paths.
- Inspected tests: `packages/tui/test/box-committed-skip.test.ts` and `packages/coding-agent/test/main-cli-mcp-cleanup.test.ts`.

Blocking findings: none.
