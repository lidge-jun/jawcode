# Goal-mode explicit interrupt should not auto-respawn

Date: 2026-06-14
Status: implemented and focused-verified

## User request

When Jawcode is running in goal mode, an explicit user stop action should prevent the goal loop from immediately spawning another continuation turn. Today the concrete in-flight model interrupt is `Esc`; Ctrl-C is user-requested scope for parity but currently has different TUI semantics.

## Pre-patch behavior

Goal mode has two continuation paths:

1. **Interactive hidden continuation**
   - `packages/coding-agent/src/modes/interactive-mode.ts`
   - `#scheduleGoalContinuation()` sets an 800ms timer and submits a hidden `customType: "goal-continuation"` input when goal mode is active, the editor is empty, and interactive continuation is enabled.
   - `#handleGoalSessionEvent()` calls `#scheduleGoalContinuation()` after `agent_end`.

2. **Session-level incomplete-goal reminder**
   - `packages/coding-agent/src/session/agent-session.ts`
   - `#checkGoalCompletion()` appends a developer reminder and schedules `agent.continue()` after a non-aborted final assistant stop while a goal is active.
   - This path already avoids `stopReason === "aborted"` in the main `agent_end` flow, so the observed respawn is primarily the interactive hidden continuation path.

Explicit `Esc` while streaming currently flows through:

- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `#abortInteractive()` calls `session.abort({ cause: "user_interrupt", ... })`.
- `packages/coding-agent/src/session/agent-session.ts`
  - `abort()` cancels the current agent turn, waits for idle, then calls `goalRuntime.onTaskAborted({ reason: ... })`.
- `packages/coding-agent/src/goals/runtime.ts`
  - `GoalRuntime.onTaskAborted()` flushes usage accounting and preserves the active goal.

Because the goal remains active and `InteractiveMode` does not suppress the next continuation for user interrupts, a later `agent_end` can schedule the hidden goal continuation again.

Ctrl-C currently maps to editor clear / double-press exit in `InputController.handleCtrlC()`. It does not call `#abortInteractive()`, does not inspect `session.isStreaming`, and does not mark goal continuation suppression on the first press.

## Recommended patch shape

Preserve goal state and accounting; suppress only the automatic interactive continuation caused by explicit user interrupt.

Target files:

1. `packages/coding-agent/src/modes/types.ts`
   - Add an `InteractiveModeContext` hook such as `onUserInterrupt(): void`.

2. `packages/coding-agent/src/modes/interactive-mode.ts`
   - Implement `onUserInterrupt()` to:
     - call `#cancelGoalContinuation()`;
     - set `#goalSuppressNextContinuation = true` when goal mode is active.
   - Keep existing reset behavior on real user submissions and tool execution so normal goal work can continue after the user sends a new message.

3. `packages/coding-agent/src/modes/controllers/input-controller.ts`
   - Call `ctx.onUserInterrupt()` before every `session.abort({ cause: "user_interrupt" })` in the Esc streaming path, including the first-Esc silent steer-consume path.
   - Extending Ctrl-C to in-flight goal interruption is a product behavior change: current code only clears the editor / double-press exits. If parity is desired, route active in-flight goal Ctrl-C through the same explicit-interrupt suppression hook without breaking its existing idle-editor exit chord.

4. Optional hardening in `packages/coding-agent/src/session/agent-session.ts`
   - Keep distinguishing `cause: "user_interrupt"` from internal abort causes.
   - Avoid broad `stopReason === "aborted"` logic in `InteractiveMode`; internal aborts such as compaction, teardown, or retries must not lose their intended follow-up behavior.

No public `.jwc/goal/goals.json` or `GoalModeState` persistence format change is required.

## Implemented patch

- `InteractiveModeContext.onUserInterrupt()` now exists.
- `InteractiveMode.onUserInterrupt()` cancels any pending goal-continuation timer and sets `#goalSuppressNextContinuation = true` while goal mode is active and not paused.
- `InputController.#abortInteractive()` calls `ctx.onUserInterrupt()` before `session.abort({ cause: "user_interrupt" })`, covering normal Esc, silent steer-consume Esc, queued-message abort paths, and related explicit interactive aborts.
- `InputController.handleCtrlC()` routes Ctrl-C through the same explicit interrupt path only when goal mode is enabled and the session is streaming. Idle Ctrl-C retains the existing clear / double-press-exit behavior.
- No `.jwc/goal/goals.json` or `GoalModeState` persistence format changed.


## Risks

- Do not remove `GoalRuntime.onTaskAborted()` from the abort path; it is the partial-turn usage accounting hook.
- Do not suppress all aborted turns blindly; internal aborts may need their own continuation/retry path.
- Preserve the existing no-tool goal-continuation suppression behavior (`#goalSuppressNextContinuation = !#goalTurnHadToolCalls`).
- Preserve steer-on-interrupt behavior for queued steering; goal continuation suppression should not drop queued user steering.
- First Esc with queued steering uses silent abort and steer-on-interrupt; run goal-continuation suppression there too, but keep the queued steering continuation alive.
- User interrupt during `#goalContinuationTurnInFlight` must not fight the existing no-tool continuation suppression logic.

## Suggested coverage

Focused tests after implementation:

- `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts`
  - active goal + user interrupt does not submit hidden `customType: "goal-continuation"` after the continuation delay.
  - normal `agent_end` with active goal still schedules continuation.
  - test harness note: ensure `InteractiveMode` event subscriptions are active (`mode.init()` or equivalent); constructing the harness alone may not wire `#handleGoalSessionEvent()`.

- `bun test packages/coding-agent/test/goals/goal-runtime.test.ts`
  - existing baseline already covers `onTaskAborted({ reason: "interrupted" })` flushing tokens/time and preserving active goal status; keep it green and extend only if runtime starts branching on `reason`.

- `bun test packages/coding-agent/test/agent-session-goal-reminder.test.ts`
  - aborted assistant turns do not trigger the session-level incomplete-goal reminder continuation.
  - preserve the existing normal-stop reminder tests.

## Verification

- `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/agent-session-goal-reminder.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts`
  - Result: 51 pass, 0 fail.
- `bun run check` from `packages/coding-agent`
  - Result: pass (`biome check .` + `tsgo -p tsconfig.json --noEmit`).
- Executor verification `4-GoalInterruptVerify`
  - Verdict: PASS.
  - Notes: no blocking risks; remaining gaps are full end-to-end interrupt→agent_end coverage and `#goalContinuationTurnInFlight` edge coverage, but the implemented unit/integration split covers the wiring and scheduler behavior.


## Executor investigation receipts

Read-only executor lanes used for this issue:

- `0-GoalInterruptFlow`: traced goal continuation and interrupt flow.
- `1-GoalInterruptTests`: identified test placement and assertions.
- `2-DevlogReview`: reviewed this devlog against source and requested the corrections now folded into this file.
- `4-GoalInterruptVerify`: reviewed the implemented patch and tests; verdict PASS.

Both concluded the change is feasible without changing public persisted goal state.
