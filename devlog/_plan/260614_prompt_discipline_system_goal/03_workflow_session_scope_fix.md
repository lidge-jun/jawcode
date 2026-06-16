# Workflow Session Scope Fix

Date: 2026-06-14

## Problem

`jwc orchestrate status` and `jwc goal status` can describe different scopes in the same terminal session:

- `jwc orchestrate status` honors the live session id and reports `.jwc/state/sessions/<session>/pabcd-state.json`.
- `jwc goal status` reports the cwd-global durable ledger in `.jwc/goal/goals.json` / `.jwc/goal/ledger.jsonl` and can show an unrelated active goal.

This makes a completed session-scoped PABCD cycle look unfinished because the global goal ledger still contains an active story from another effort.

## Current evidence

Observed in this repo:

```sh
jwc orchestrate status
# Stage: complete (inactive)
# Scope: session 019ec71f-9736-7000-b55e-90349f784f5f

jwc goal status
# Goal: Implement H1 ctrl+t component replay hardening...
# Status: active
# Mode: goal ledger (.jwc/goal/)
# ID: G001
```

Read-only executor audit IDs:

- `14-GoalScopeEngineAudit`: confirmed `jwc goal` reads shared `.jwc/goal` and only uses session env for goal-mode activation/pending requests/derived workflow state.
- `15-GoalScopeTestAudit`: confirmed current tests do not cover `jwc goal status/update/done` under `GJC_SESSION_ID` / `JWC_SESSION_ID`.
- `16-OrchestrateScopeAudit`: confirmed orchestrate CLI itself does **not** leak shared PABCD when a session env exists; `--shared` is parsed but ignored except for `reset`, and GJC-only coverage is weaker than JWC coverage.
- `17-GoalOrchestrateScopePlan`: confirmed the minimal fix should preserve shared `.jwc/goal`, add session-id resolver parity, label status scopes, and add focused tests before prompt edits.

## Root cause map

### Goal command

Relevant files:

- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/legacy-storage.ts`
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`

Findings:

- `runNativeGoalCommand()` `status` calls `getGoalStatus(cwd)` and `readGoalPlan(cwd)`.
- `readGoalPlan()`, `readGoalLedger()`, and `getGoalStatus()` resolve storage through `resolveGoalStoragePaths(cwd)`.
- `resolveGoalStoragePaths(cwd)` only selects `.jwc/goal` or legacy `.jwc/ultragoal`; it has no session-id argument.
- `activateGoalMode()` stamps pending goal-mode requests with `process.env[GJC_SESSION_ID_ENV]` only; it lacks `JWC_SESSION_ID` fallback parity.
- `reconcileGoalState()` uses `process.env.GJC_SESSION_ID` only and reconciles the shared goal summary into session workflow state.

### Orchestrate command

Relevant files:

- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts`
- `packages/coding-agent/src/commands/orchestrate.ts`

Findings from local inspection:

- `parseArgs()` defaults to `(process.env.JWC_SESSION_ID ?? process.env.GJC_SESSION_ID)` when `--session-id` is absent.
- `readCurrent()` rejects unscoped/shared envelopes when a session id is active.
- `resetPabcdState()` supports `--shared`, but `parseArgs()` currently applies env session id even when `--shared` is present. That makes `--shared` additive for reset, not an opt-out for normal status/stage commands.
- `--shared` is parsed but not used by normal `status` or stage transitions.

Executor refinement:
- Normal orchestrate `status`/stage/verdict paths are already strict session reads when `JWC_SESSION_ID` or `GJC_SESSION_ID` is set.
- The real orchestrate-side gap is operator control/coverage: `--shared` cannot inspect or mutate shared PABCD from an env-scoped shell except through `reset --shared`; tests should also cover `GJC_SESSION_ID`-only parity.
- Any fallback from session PABCD to shared PABCD must be deliberate. Silent fallback would reintroduce the same scope confusion in the opposite direction.

## Product decision to preserve

Do **not** blindly move the durable goal ledger to session paths in this patch. `.jwc/goal` is a cwd-level durable ledger contract and existing workflows may rely on it.

The immediate bug is UX/scope confusion: commands executed inside a session must not present shared/global state as if it is the current session's active workflow.

## Patch shape

### 1. Shared session-id resolver

Add or reuse a small resolver with this precedence:

1. explicit `--session-id`
2. `JWC_SESSION_ID`
3. `GJC_SESSION_ID`
4. undefined

Use it consistently in goal/orchestrate command adapters.

Implementation detail: this resolver should be shared by command adapters, but must preserve command-specific semantics:
- orchestrate `reset --shared` remains additive: clear scoped + shared.
- orchestrate non-reset `--shared` should mean explicit shared target.
- goal shared ledger remains shared, but current-session workflow state/status must be labeled separately.

### 2. Orchestrate

Minimal changes:

- Keep default env-scoped orchestrate behavior strict: session env reads/writes session PABCD only.
- Make non-reset `--shared` an explicit shared-state target for `status` and stage commands.
- Keep `reset --shared` additive only where that behavior is already tested/documented: scoped reset plus shared reset.
- Add focused tests:
  - env session id + shared PABCD state: `status` must not read shared by default.
  - env session id + `status --shared`: reads shared scope.
  - env session id + `p --shared`: writes shared state, not session state.
  - `GJC_SESSION_ID`-only behavior matches `JWC_SESSION_ID`.
  - `reset --shared` retains additive behavior if required by existing tests.

### 3. Goal

Minimal UX-safe changes:

- `jwc goal status` inside a session should first identify the session scope and distinguish session goal-mode state from shared durable ledger state.
- If no session goal is active, it should not headline the shared `.jwc/goal` active story as the current session goal.
- Show shared ledger information as a clearly labeled secondary block, e.g. `Shared ledger: active G001 ...`, when present.
- Add `JWC_SESSION_ID` fallback wherever goal code currently reads only `GJC_SESSION_ID`.

Mutation commands require a stricter decision:

- Conservative option: `update/done/cancel/pause/resume` keep mutating shared `.jwc/goal`, but their output labels the target as `shared ledger` when a session id is active.
- Safer isolation option: when a session id is active and no current session goal-mode state exists, refuse `update/done/cancel` instead of mutating the shared active story.

Recommended first implementation: refuse session-scoped mutation when no matching session goal is active, unless the user passes an explicit shared/global flag. This prevents accidental checkpointing/completion of another session's goal.

### 4. Tests

Primary files:

- `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`
- `packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts`
- `packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts`

Goal tests:

- Seed shared `.jwc/goal` active objective.
- Set `GJC_SESSION_ID` or `JWC_SESSION_ID` to a different session.
- Assert `jwc goal status` does not headline the shared active objective as the session goal.
- Assert `jwc goal update ... --evidence ...` from the foreign session is refused or requires explicit shared targeting.
- Duplicate at least one case with `JWC_SESSION_ID` only to guarantee alias parity.

Orchestrate tests:

- Existing env-scoped reads stay green.
- Add explicit `--shared` read/write behavior under env session.

## Risks

- Making goal mutations fail-closed in session scope may break scripts that intentionally update the cwd-global `.jwc/goal` while an agent session env is present.
- Solving that cleanly likely needs an explicit shared flag for `jwc goal`, mirroring `jwc orchestrate --shared`.
- Status-only UX changes are safer but leave accidental global mutation possible.
- Full session-scoped `.jwc/goal` storage is larger and risks orphaning existing durable ledgers.
- Switching orchestrate session reads to shared fallback would be risky and is not recommended for this patch.

## Implementation evidence

- Added CLI session scope helpers in `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`: `resolveCliWorkflowSessionId`, `resolveCliWorkflowSessionFile`, and `readCurrentSessionGoalModeState`.
- Updated `packages/coding-agent/src/jwc-runtime/goal-cli.ts` so `jwc goal status` separates current-session goal state from shared `.jwc/goal`, `status --shared` preserves the shared headline, and session-scoped mutations require a matching session goal unless `--shared` is explicit.
- Updated `packages/coding-agent/src/jwc-runtime/goal-engine.ts` reconciliation to use `JWC_SESSION_ID` / `GJC_SESSION_ID` parity and optional explicit session id.
- Updated `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts` so default env-scoped PABCD stays strict while non-reset `--shared` explicitly targets shared PABCD; `reset --shared` remains additive.
- Added help flags/examples in `packages/coding-agent/src/commands/goal.ts` and `packages/coding-agent/src/commands/orchestrate.ts`.
- Added focused regression tests in `packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts`, `goal-mode-request.test.ts`, and `orchestrate-state.test.ts`.

Verification:
```sh
JWC_SESSION_ID= GJC_SESSION_ID= JWC_SESSION_FILE= GJC_SESSION_FILE= bun test packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
# 85 pass, 0 fail, 317 expect() calls

bunx biome check packages/coding-agent/src/jwc-runtime/goal-mode-request.ts packages/coding-agent/src/jwc-runtime/goal-cli.ts packages/coding-agent/src/jwc-runtime/goal-engine.ts packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts packages/coding-agent/src/commands/goal.ts packages/coding-agent/src/commands/orchestrate.ts packages/coding-agent/test/jwc-runtime/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/goal-mode-request.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-state.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-reset.test.ts
# OK

bun run check
# OK
```
## Deferred prompt work

System/goal prompt edits are intentionally deferred. This note tracks source behavior first so later prompt changes can reference the corrected CLI contract instead of documenting a workaround.
