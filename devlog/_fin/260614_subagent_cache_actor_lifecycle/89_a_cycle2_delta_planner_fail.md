FAIL

[blocker] 80_pabcd_phase_execution_plan.md §8.2 — Final gate block still runs tests on planned files and §3.1 still listed a superseded retirement test — Canonicalize the test matrix and mark planned files as B deliverables.
[blocker] 80_pabcd_phase_execution_plan.md §6.1–§6.3 — Phase 4 compaction/prewarm lacked numbered tasks, named helper, conservative threshold rule, and per-bullet test mapping — Add concrete `maintainWorkflowActorBeforeResume` sequence and acceptance table.
[major] 80_pabcd_phase_execution_plan.md §6.3 / §12.2 — Black-box TaskTool resume acceptance was stated but not checkable enough — Add given/when/then AC for two dispatches, same `sessionFile`, message mode, no fork seed rebuild, and planner metadata ignored.
[major] 80_pabcd_phase_execution_plan.md §4.4–§4.5 / §6.1 — Non-cache-affinity diagnostics did not name the result/receipt field — Define `cacheAffinity` metadata shape.
[major] 80_pabcd_phase_execution_plan.md §3.5–§3.6 / §6.3 — Process-restart/context-unavailable behavior was not mapped to a planned test — Add `context_unavailable`/fresh-policy case.
[minor] 80_pabcd_phase_execution_plan.md §11 vs §12.1 — Profile migration remained contradictory — Update §11 to reflect the §12.1 decision.

Single statement an implementer would most likely misread: Because §12 lists cycle-2 deliverables and §6.1 mentions a TaskTool hook before `runMode: "message"`, an implementer may treat Phase 4 compaction/prewarm and black-box proof as already satisfied by cycle-1 registry/routing code and skip adding the missing tests and resume-path wiring.
