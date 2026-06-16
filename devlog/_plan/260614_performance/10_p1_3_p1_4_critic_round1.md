# 10 — P1.3/P1.4 critic round 1

Verdict: ITERATE

Blocking gaps:

- P1.4 ownership handoff is ambiguous: setting sessionOwnsCliMcpManager right after createSession conflicts with post-create process.exit paths in main.ts that never call session.dispose(), so root finally would not clean up CLI-owned MCP on those failures.
- RunRootCommandDependencies does not yet specify discoverAndLoadMCPTools injection as a required plan change, blocking a concrete test strategy for main-cli-mcp-cleanup.test.ts.
- No planned test for externally supplied sessionOptions.mcpManager despite acceptance criteria forbidding CLI cleanup on those managers.

Required revisions:

- Document a single ownership rule: defer sessionOwnsCliMcpManager until mode runners own disposal, or list every post-createSession exit and require session.dispose() when cliOwnedMcpManager is set.
- Add test cases for external mcpManager (no cliOwnedMcpManager, no root disconnect) and post-create startup failure (exactly one disconnectAll).
- Add discoverAndLoadMCPTools to RunRootCommandDependencies in the plan §2.

Revision applied in devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md.
