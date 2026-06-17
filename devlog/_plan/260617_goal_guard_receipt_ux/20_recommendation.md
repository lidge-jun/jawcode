# Recommendation: Preserve Strict Goal Safety, Fix Receipt Target UX

**Date**: 2026-06-17  
**Status**: Ready for implementation planning / patch approval

## Decision

Keep the strict pause/complete safety model. Do not weaken receipt verification.

Patch the confusing failure mode by improving `goal-guard.ts` receipt target resolution and diagnostic output.

## Why

The current problem is not that receipts are too strict. The problem is that the guard uses the inline current goal objective string to infer receipt kind, and in nested cwd/sentinel scenarios that string can be a story objective even though the durable aggregate goal is already complete with a valid final receipt.

That causes this bad UX:

```text
ledger: complete
receipt: final-aggregate and fresh
session objective: sentinel story text
guard expected: per-goal
result: stale/malformed
```

The guard should expose that reasoning instead of hiding it behind `Goal G001 receipt is malformed or stale`.

## Patch Recommendation

1. Add a richer receipt target resolver in `packages/coding-agent/src/jwc-runtime/goal-guard.ts`.
2. In aggregate mode only:
   - if current objective matches a story objective,
   - and required goals are all complete,
   - and a final-aggregate receipt target exists,
   - validate the final-aggregate receipt.
3. In per-story mode:
   - keep story objectives mapped to per-goal receipts.
4. Preserve all existing receipt validation invariants:
   - ledger event id,
   - plan generation,
   - quality-gate hash,
   - `goal({ op: "get" })` snapshot hash,
   - goal updatedAt freshness,
   - required-goals-complete check.
5. Improve error messages to include:
   - cwd,
   - `.jwc/goal/goals.json` path,
   - current objective,
   - objective match basis,
   - expected receipt kind,
   - found receipt kind,
   - concrete stale reason.

## Test Recommendation

Add focused regression coverage before/with the patch:

- aggregate sentinel/story objective + final-aggregate receipt passes inline completion;
- aggregate multi-story story objective + final-aggregate receipt passes only after all required goals complete;
- per-story mode does not accept aggregate fallback;
- deliberate mismatch reports expected/found receipt kind and stale reason.

## Non-goals

- Do not remove the 2-tap pause audit gate.
- Do not let `goal({ op: "complete" })` complete without a strict checkpoint receipt.
- Do not add aliases by mutating `.jwc/**` directly.
- Do not special-case only the literal Korean/current sentinel; fix the aggregate-mode interpretation generally.

## Implementation Risk

Low to moderate if scoped to `goal-guard.ts`. The main risk is accidentally allowing aggregate fallback in `per-story` mode or before all required goals are complete. The tests above should catch that.
