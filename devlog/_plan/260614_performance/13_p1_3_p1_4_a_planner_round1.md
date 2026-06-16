FAIL

[blocking] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 P1.4 items 2–4 — MCP discovery and cliOwnedMcpManager assignment sit before the non-ACP try/finally while main.ts still has post-discovery process.exit paths such as invalid --api-key — extend a root-level cleanup scope from post-discovery through session shutdown and inventory every post-discovery exit.

[high] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 P1.4 item 6 — runPrintMode already calls session.dispose(), but current main.ts also calls session.dispose() immediately after runPrintMode — remove duplicate root dispose or document exactly how double-disconnect is avoided.

[high] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 P1.4 item 4 — cleanup finally only applies after entering non-ACP session branch; discovery followed by pre-createSession process.exit is not owned — merge discovery into same cleanup scope or add pre-session finally.

[medium] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md focused MCP tests — external-manager test lacks a concrete seam because buildSessionOptions is not injectable — add deps.buildSessionOptions or a concrete injected options helper.

[medium] devlog/_plan/260614_performance/04_verification_matrix.md MCP lifecycle — ACP skip must be proved in new runRootCommand cleanup test via injected discoverAndLoadMCPTools spy; acp-mcp-isolation.test.ts is regression-only.

[low] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md non-goals — explicitly defer new CreateAgentSessionOptions ownership flag; infer ownership only through cliOwnedMcpManager.

[low] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md risk controls — specify cleanup disconnect error handling acceptance.

[info] P1.3 plan is coherent.

The single statement an implementer would most likely misread: “After entering a mode runner that already disposes the session on return or shutdown, set sessionDisposedOrRunnerOwnsDispose = true after it returns.”
