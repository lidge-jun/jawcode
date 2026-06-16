FAIL

[HIGH] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 item 5 — `if (session && cliOwnedMcpManager && !sessionDisposedOrRunnerOwnsDispose)` blocks session.dispose() when cliOwnedMcpManager is undefined, contradicting bridge startup-throw cleanup; use `if (session && !sessionDisposedOrRunnerOwnsDispose) await session.dispose()`.

[MEDIUM] devlog/_plan/260614_performance/09_p1_3_p1_4_execution_plan.md §2 item 3 — Pre-discovery api-key move fixes one path but plan still lacks explicit outer try/finally around shared discovery at main.ts:914 before mode split.

[MEDIUM] packages/coding-agent/src/main.ts:895 — Wire deps.buildSessionOptions at the buildSessionOptions call site for external-manager tests.

[LOW] Plan duplicate step 5 numbering; partial fatal-exit inventory only.

Most likely first break: finally gated on cliOwnedMcpManager leads to no session.dispose on external-manager startup failures.
