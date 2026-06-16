# MOC: PABCD Actor Resume-Fail Fresh Spawn Fallback

**Date**: 2026-06-16  
**Scope**: `packages/coding-agent/src/jwc-runtime/actor-registry.ts`, `packages/coding-agent/src/task/index.ts`  
**Classification**: C2 — single subsystem, behavioral fix

## Problem

PABCD workflow actors (planner, architect, critic, verifier) that fail (e.g., turn abort) are left in `failed` status. On the next task tool call:

1. `isWorkflowActorSelectable` treats `failed` actors as selectable → resume is attempted on a broken session → fails again → infinite loop.
2. Even if (1) is fixed, the main agent must make two separate calls (first fails, second fresh-spawns). The main agent should not need to know about resume/fresh internals.

## Solution

Two coordinated changes:

1. **actor-registry.ts**: Exclude `failed` from `isWorkflowActorSelectable` so `resolveCompatibleActor` never returns a failed actor.
2. **task/index.ts `runTask`**: After a resumed actor fails, automatically retire the failed actor and re-run with a fresh-spawned actor within the same call. The fresh actor becomes idle on success and is resume-eligible for future calls.

## Phases

- `10_plan.md` — detailed diff-level plan
