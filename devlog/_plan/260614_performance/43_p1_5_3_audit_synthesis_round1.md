# P1.5.3 A-stage audit synthesis — round 1

> Plan: `devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md`
> Planner audit: `agent://15-P153PlannerAudit`
> Architect audit: `agent://17-P153ArchitectAuditReal`
> Verdicts: FAIL / FAIL

## Findings and resolutions

### PLANNER-A1 / ARCH-A3 — Add File and grouping must be mandatory, not only if tests expose a gap

Decision: accept.

Resolution: pruning source deltas now explicitly require Add File headers, Move to grouping, and failed per-file grouping as mandatory upstream-derived deltas, while preserving current Jawcode staleness behavior.

### PLANNER-A2 — Digest/redteam reference was mixed with staleness ownership

Decision: accept.

Resolution: redteam test section now references digest/notice/candidate-flow only. Staleness envelope grouping is assigned to `pruning.ts` plus `pruning-staleness.test.ts` / `pruning-staleness-redteam.test.ts`.

### PLANNER-A3 / ARCH-A4 — Encoding preservation needs evidence or an explicit waiver artifact

Decision: accept.

Resolution: the plan now requires a focused encoding fixture if a real runtime-safe `Encoding` utility exists; otherwise B summary must name the runtime waiver and C-stage must cite that artifact. Typecheck alone is not enough without the named waiver.

### PLANNER-A4 — Parent docs still imply openai/token-cache work

Decision: accept.

Resolution: the plan now adds a non-goal for `compaction/openai.ts` and parent-listed `compaction-estimate-cache.test.ts`, plus parent-doc alignment tasks for `04_verification_matrix.md` and `23_p1_5_upstream_v3_merge_plan.md`.

### PLANNER-A5 — Existing staleness coverage documentation location missing

Decision: accept.

Resolution: B summary must document existing/added coverage for selector, Add File, Move to, failed per-file, and search-default cases.

### PLANNER-A6 — Package check wording ambiguous

Decision: accept.

Resolution: package check is now labeled blocking when run and expected to pass after focused gates.

### PLANNER-A7 — Add File acceptance was implicit only

Decision: accept.

Resolution: acceptance criteria now require `*** Add File:` patch envelopes to stale earlier reads of the added path, covered in `pruning-staleness.test.ts`.

### ARCH-A1 / ARCH-A2 — Digest source and tests must land together

Decision: accept.

Resolution: no plan structure change beyond above; the candidate notice/savings source deltas and redteam helper/test updates are explicitly coupled.

### ARCH-A5 / ARCH-A6 — Informational confirmations

Decision: accept as non-blocking.

Resolution: no additional changes.

## Residual risk

Runtime Encoding fixture availability is unknown until implementation; if unavailable, the B/C artifacts must explicitly record the waiver rather than silently treating typecheck as runtime coverage.
