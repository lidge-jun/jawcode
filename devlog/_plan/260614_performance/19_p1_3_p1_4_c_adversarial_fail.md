FAIL

[HIGH] packages/coding-agent/test/main-cli-mcp-cleanup.test.ts — Post-create failure tests do not model MCP disconnect contract — extend fake session/dispose or test setup so startup-profile and no-model failures prove CLI-owned MCP disconnect exactly once and instance clearing when session.dispose owns cleanup.

[HIGH] devlog/_plan/260614_performance/18_p1_3_p1_4_b_verifier_done.md — Verifier DONE overstates MCP evidence on post-create paths — update after tests model AgentSession.dispose MCP behavior.

[MEDIUM] packages/coding-agent/test/main-cli-mcp-cleanup.test.ts — Missing disconnectAll rejection/original-error preservation, PI_TIMING===x disposal, and optional RPC no-double-dispose cases — add focused cases or narrow claims.

[MEDIUM] packages/coding-agent/src/main.ts — Post-create MCP cleanup depends on session.dispose — acceptable if tests document/verify this ownership boundary.

[LOW] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md — Commit-lane gate remains orthogonal/red in this environment — avoid treating it as P1.3 acceptance.

[LOW] packages/tui/test/box-committed-skip.test.ts — Optional cache regression guard after committed skip.

P1.3 PASS. P1.4 PARTIAL pending stronger tests/evidence.
