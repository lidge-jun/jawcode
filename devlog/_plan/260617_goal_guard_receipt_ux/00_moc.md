# MOC: Goal Guard Receipt UX and Nested CWD Diagnosis

**Date**: 2026-06-17  
**Status**: Investigation active  
**Context**: Inline goal completion failed after jawcode PABCD work was complete because the current session/inline tool observed a parent `.jwc/goal` sentinel objective and the guard selected the wrong receipt-kind path.

## Problem Statement

The goal pause/complete safety model is intentionally strict: agents must not pause because they are tired, and completion must prove verified work through a durable quality-gate receipt rather than a naked status flip. That safety posture is correct, but the current UX is too opaque when multiple `.jwc/goal` ledgers exist across a parent/subrepo cwd boundary.

Observed state during this investigation:

- `jawcode/.jwc/goal/goals.json` had `G001: complete` with a `final-aggregate` receipt.
- `../.jwc/goal/goals.json` also had `G001: complete` after sanctioned checkpoint/reconcile work.
- `jwc goal status --shared` from both cwd roots showed no active story and `G001:complete`.
- `jwc orchestrate status --json` from both cwd roots showed `{"active":false,"stage":null}`.
- Guard reproduction showed:
  - jawcode aggregate objective -> `active_verified_complete`
  - parent aggregate objective -> `active_verified_complete`
  - parent sentinel story objective -> `active_stale_receipt` with `Goal G001 receipt is malformed or stale.`

## Current Safety Semantics

1. **Pause is a 2-tap audit gate**
   - `jwc goal pause --agent` does not pause immediately.
   - First run records an attempted pause and prints a checklist.
   - A second run with `--audit "<independent reviewer summary>"` is required before an agent-initiated pause is recorded.
   - This protects against agents stopping because the task is hard or ambiguous.

2. **Complete is receipt verification, not status mutation**
   - `goal({ op: "complete" })` calls `assertCanCompleteCurrentGoal`.
   - The guard checks durable `.jwc/goal` state, ledger events, receipt kind, quality-gate hash, goal snapshot hash, plan generation, and target `updatedAt` freshness.
   - This protects against agents marking a goal complete without a fresh checkpoint.

3. **The failure mode is objective-to-receipt-kind ambiguity**
   - `goal-guard.ts` maps the current inline goal objective to a receipt target.
   - If the current objective matches `plan.jwcObjective`, default objective, or `jwcObjectiveAliases`, it expects a `final-aggregate` receipt.
   - If it matches a specific `goal.objective`, it expects a `per-goal` receipt.
   - In this case, the parent goal's story objective was the sentinel `(AI-driven goal planning pending refinement)\nhint: ㄱㄱ`, while the completed ledger had an aggregate final receipt. The guard treated the sentinel as a story and rejected the aggregate receipt as stale/malformed.

## Initial Diagnosis

The strict completion guard is conceptually right; the defect is not that it fails closed. The defect is that the guard silently chooses receipt kind from an objective string in a nested cwd situation, then reports a generic stale/malformed receipt instead of exposing the basis of that choice.

This creates a bad operator experience:

- The durable ledgers can both be complete.
- Reconcile/session state can be complete/inactive.
- Inline completion can still fail because the active in-memory/current session objective is a sentinel story objective.
- The message does not disclose cwd, goals path, matched objective basis, expected receipt kind, or found receipt kind.

## Candidate Fix Direction

Preserve strict verification, but improve interpretation and diagnostics:

1. In aggregate goal mode, if the current objective matches a story objective and all required goals are complete with a fresh `final-aggregate` receipt, allow the guard to validate that final receipt rather than forcing a `per-goal` receipt.
2. Keep true `per-story` mode strict: story objectives should continue to require `per-goal` receipts unless the plan mode and receipt semantics explicitly allow aggregate fallback.
3. Enrich guard diagnostics with:
   - cwd
   - goals path
   - current objective
   - objective match basis (`aggregate`, `alias`, `default`, `story`, `none`)
   - expected receipt kind
   - found receipt kind
   - stale reason (`generation mismatch`, `ledger event missing`, `snapshot hash mismatch`, `updatedAt mismatch`, etc.)
4. Add regression coverage for sentinel/story objective + aggregate plan + final receipt.

## Files of Interest

- `packages/coding-agent/src/jwc-runtime/goal-guard.ts`
  - `findReceiptGoal`
  - `validateCompletionReceipt`
  - `readGoalVerificationState`
  - `assertCanCompleteCurrentGoal`
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
  - pause 2-tap gate implementation
- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
  - receipt kind, completion receipt, generation/hash logic
- Candidate tests:
  - `packages/coding-agent/test/goals/goal-tool.test.ts`
  - `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`

## Subagent Analysis Request

A read-only subagent is being dispatched to independently inspect the guard/engine/test surface and return:

- whether aggregate-mode story-objective fallback is safe,
- which exact branch should change,
- what tests are needed,
- any risks with per-story mode or stale receipt bypasses,
- recommended diagnostic message shape.

## Current Recommendation Before Subagent Result

Do not weaken receipt validation. Patch the objective matching/diagnostic layer so completed aggregate ledgers do not fail solely because the inline current objective is the sentinel story text, and make future failures self-explanatory.
