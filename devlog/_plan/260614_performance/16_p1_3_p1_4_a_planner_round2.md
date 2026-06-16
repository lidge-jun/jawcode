FAIL

[medium] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 P1.4 item 5 — Finally pseudocode gates session.dispose() on cliOwnedMcpManager, contradicting bridge startup-throw cleanup for externally supplied managers — change to `if (session && !sessionDisposedOrRunnerOwnsDispose) await session.dispose()` and reserve cleanupCliOwnedMcpManager for pre-session CLI-owned paths.

[low] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §3 — Add non-goal: no new CreateAgentSessionOptions ownership flag.

[low] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §4/§5 — Add acceptance that failed disconnectAll during root cleanup is logged and does not mask original startup/session error.

[low] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 — Renumber duplicate step 5.

The single statement an implementer would most likely misread: bridge startup throw cleanup; the current finally sketch would skip disposal when cliOwnedMcpManager is undefined.
