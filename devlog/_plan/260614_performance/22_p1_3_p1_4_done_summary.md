# P1.3/P1.4 PABCD done summary

## Cycle summary

- P: Planned one implementation cycle for P1.3 Box committed-child skip and P1.4 CLI-owned MCP cleanup ownership in `09_p1_3_p1_4_execution_plan.md`; critic approved on round 3.
- A: Dual audit forced sharper ownership boundaries: direct-child Box semantics, ACP isolation, externally supplied MCP manager ownership, and pre-session failure cleanup.
- B: Built the Box skip plus focused component tests, and refactored `runRootCommand` to make CLI-created MCP manager ownership explicit with cleanup/disposal tests.
- C: `bun run check` and affected tests passed; adversarial review returned PASS with only low residual risks.

## Files changed

- `packages/tui/src/components/box.ts`: skips committed direct children during render while leaving invalidation propagation intact.
- `packages/tui/test/box-committed-skip.test.ts`: covers committed skip, live sibling rendering, all-committed empty render, and invalidation propagation.
- `packages/coding-agent/src/main.ts`: validates fatal `--api-key` errors before MCP discovery, skips normal MCP discovery for ACP/external managers, tracks CLI-owned MCP managers, cleans pre-session discovery on session creation failures, and disposes created sessions across startup failure/no-model/PI_TIMING/print/bridge ownership paths.
- `packages/coding-agent/test/main-cli-mcp-cleanup.test.ts`: covers pre-session cleanup, external-manager non-ownership, ACP skip, startup-profile/no-model cleanup, cleanup error preservation, PI_TIMING exit disposal, print single-dispose, and bridge throw disposal.
- `devlog/_plan/260614_performance/02_patch_roadmap.md`, `04_verification_matrix.md`, `07_hardening_addendum.md`: updated the P1.3/P1.4 value assessment, acceptance matrix, and MCP ownership contract.
- `devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md` through `22_p1_3_p1_4_done_summary.md`: recorded the PABCD plan, audits, fixes, verifier, C verdict, and closeout.

## Acceptance criteria met

- P1.3: committed Box direct children are not rendered; live siblings still render; all-committed Box returns `[]`; invalidation still reaches committed children.
- P1.4: normal CLI MCP discovery is not run for ACP mode or embedder-supplied managers; CLI-owned managers are cleaned on pre-session failures; created sessions own cleanup after successful creation; print/bridge/interactive early-exit paths do not double-dispose or leak the created session.

## Verification

- `bun biome check --write packages/coding-agent/src/main.ts packages/coding-agent/test/main-cli-mcp-cleanup.test.ts packages/tui/src/components/box.ts packages/tui/test/box-committed-skip.test.ts` — pass.
- `bun test packages/tui/test/box-committed-skip.test.ts packages/coding-agent/test/main-cli-mcp-cleanup.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts packages/coding-agent/test/acp-mcp-isolation.test.ts` — pass, 19 tests / 52 assertions.
- `bun --cwd=packages/coding-agent run check:types` — pass.
- `bun biome check packages/tui/src/components/box.ts packages/tui/test/box-committed-skip.test.ts packages/coding-agent/src/main.ts packages/coding-agent/test/main-cli-mcp-cleanup.test.ts` — pass.
- `bun run check` — pass.

## WONDER

- Cleanup-failure logging is code-reviewed but not logger-spy asserted; behavior preserves the original startup error and clears the global MCP instance.
- RPC runner-owned disposal remains covered by code review rather than a direct injected no-double-dispose regression test.
- `packages/tui/test/commit-lane.test.ts` is environment-sensitive and orthogonal to this Box contract; the new focused Box test is the reliable acceptance gate.

## REFLECT

- Future performance specs should separate CPU-rendering wins from hygiene/ownership patches so medium-value cleanup work is not oversold as a frame-time fix.
- MCP lifecycle acceptance criteria should explicitly name the owner for each path: CLI-created pre-session manager, session-owned manager, ACP-owned manager, and embedder-owned manager.
- Box committed-frame specs should state direct-child semantics and explicitly preserve non-render traversal paths such as invalidation/introspection/transcript ownership.
