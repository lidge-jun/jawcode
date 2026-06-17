# Subagent Analysis: Goal Guard Receipt Targeting

**Date**: 2026-06-17  
**Agent**: `0-GoalGuardAnalysis`  
**Mode**: Read-only; no product mutation; no project-wide gates or formatters run.

## Root Cause Confirmed

`readGoalVerificationState` first treats the inline current objective as a valid Goal objective, then `findReceiptGoal` maps that objective shape to the receipt kind it expects.

The current guard behavior is:

- `plan.jwcObjective`, default objective, or `jwcObjectiveAliases` -> expect `final-aggregate` receipt.
- exact `goal.objective` match -> expect `per-goal` receipt.

A sentinel plan created from `jwc goal plan <hint>` can split those meanings:

- aggregate plan objective: durable aggregate/default objective,
- story/current inline objective: `(AI-driven goal planning pending refinement)\nhint: ...`,
- completed receipt: `final-aggregate` on the final required goal.

When inline completion sees the sentinel story objective, the guard validates the final receipt as if it were a `per-goal` receipt and fails on receipt-kind mismatch, producing the generic stale/malformed error.

This is an objective-to-receipt-target selection bug, not a receipt verification bug.

## Safe Patch Shape

Keep strict receipt verification intact. Patch only target resolution and diagnostics in `goal-guard.ts`.

Recommended behavior:

1. Replace or extend `findReceiptGoal` with a richer resolver that returns:
   - target goal,
   - expected receipt kind,
   - objective match basis.
2. In `aggregate` mode only, when current objective matches a story objective but all required goals are complete and a final-aggregate receipt exists, resolve to the final-aggregate target instead of forcing `per-goal`.
3. Do **not** apply this fallback in `per-story` mode.
4. Continue to call `validateCompletionReceipt` with `receiptKind: "final-aggregate"`, preserving existing hash/generation/ledger/snapshot checks.
5. Enrich diagnostics with cwd/path/objective/match/receipt details.

## Functions to Modify

- `packages/coding-agent/src/jwc-runtime/goal-guard.ts::findReceiptGoal`
  - or replace with a richer `resolveReceiptTarget` helper.
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts::objectiveMatches`
  - optionally fold into the resolver so match basis is not recomputed inconsistently.
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts::validateCompletionReceipt`
  - add concrete stale reason and expected/found receipt-kind details.
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts::readGoalVerificationState`
  - propagate cwd/goals path/objective match basis.
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts::assertCanCompleteCurrentGoal`
  - surface richer diagnostic text only; pass/fail semantics remain strict.

`goal-engine.ts` receipt generation should remain unchanged.

## Tests to Add

1. `packages/coding-agent/test/goals/goal-tool.test.ts`
   - aggregate sentinel/story objective + fresh final-aggregate receipt + inline `goal({ op: "complete" })` succeeds instead of throwing stale/malformed.
2. `packages/coding-agent/test/goals/goal-tool.test.ts` or `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`
   - aggregate multi-story case where current inline objective is a completed story objective and final-aggregate receipt exists after all required goals complete.
3. `packages/coding-agent/test/goals/goal-tool.test.ts`
   - `per-story` mode must not use aggregate fallback; story objective still requires `per-goal` receipt.
4. `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`
   - deliberate receipt-kind mismatch diagnostic includes cwd, goals path, match basis, expected receipt kind, found receipt kind, and stale reason.

## Risks and Guardrails

- Never fallback for `per-story`; accepting aggregate receipts there would weaken the per-story contract.
- Gate fallback to aggregate mode, present final-aggregate target, and no incomplete required goals.
- Do not weaken hash, ledger event, plan generation, quality-gate, snapshot, or updatedAt checks.
- Diagnostics must be additive and must not collapse existing specific states such as `active_dirty_quality_gate`.
- When reporting paths, prefer the resolved goal storage path if legacy fallback exists; otherwise `getGoalPaths(cwd).goalsPath` is acceptable.

## Evidence Cited by Subagent

- `goal-guard.ts::objectiveMatches` accepts exact story objective matches, making sentinel text a valid active Goal objective.
- `goal-guard.ts::findReceiptGoal` maps story objectives to `per-goal`.
- `goal-guard.ts::validateCompletionReceipt` returns stale/malformed when `receipt.receiptKind !== input.receiptKind`.
- `goal-engine.ts::chooseReceiptKind` already emits `final-aggregate` for aggregate-mode final completion and `per-goal` for `per-story`; generation is mode-correct.
- Existing final-aggregate validation already preserves strict ledger/hash/freshness checks.

## Conclusion

The subagent agrees with the initial diagnosis: do not relax completion safety. Fix the guard's aggregate-mode story-objective fallback and make stale/malformed failures self-explanatory.
