PASS

[minor] 80_pabcd_phase_execution_plan.md §3.3 step 3b — Resume dispatch should name TaskTool subprocess dispatch rather than `#executeSync` — B-stage can use `runTask`/`runSubprocess` terminology.
[minor] 80_pabcd_phase_execution_plan.md §6.1 item 2 — Actor-scoped session open/restore helper must remain explicit and parent `ToolSession` must not be compacted/prewarmed — Plan now keeps this as a B-stage deliverable.
[minor] 80_pabcd_phase_execution_plan.md §4.5 vs §6.3 — Forced fork-failure allow/deny cases should be mapped to tests — B-stage tests should cover deny-fallback and allow-fallback non-cache-affine metadata.
[minor] 80_pabcd_phase_execution_plan.md §5.5 vs §6.3 — Cross-stage routing AC should be mapped into lifecycle tests — B-stage/C-stage should extend `orchestrate-actor-lifecycle.test.ts` or black-box cases.
[minor] 80_pabcd_phase_execution_plan.md §10 vs §11–§12 — Status wording should stay synchronized with cycle-2 state.
[minor] 80_pabcd_phase_execution_plan.md §7.1 vs §11 — Model-selector discovery is effectively done; remaining Phase 5 gaps are diagnostics and compatibility semantics.
[minor] 80_pabcd_phase_execution_plan.md §6.1 / defaults/jwc/skills/plan/SKILL.md — Keep plan-skill guidance edit explicit; B-stage must not assume plan text alone changes operator behavior.

Single statement an implementer would most likely misread: Because cycle-1 already resolves compatible actors and dispatches `runMode: "message"` with the same `sessionFile`, an implementer may treat §6.1 `maintainWorkflowActorBeforeResume`, actor-local compaction/prewarm, `cacheAffinity` on `SingleResult`/receipts, and the §8.2 B-deliverable tests as already satisfied and skip cycle-2 work.
