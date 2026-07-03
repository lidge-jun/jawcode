# 80_plan — P-stage draft: `/goal` and `/goalplan` force new goal state

Status: draft-for-critic
Cycle: PABCD phase 80 of `devlog/_plan/260703_chase_hardening_goal_passthrough/00_moc.md`
Work class: C3, cross-cutting command/runtime behavior

## Loop-spec header

- Loop archetype: verifier defines done. The target behavior is binary and testable by command/runtime state assertions.
- Trigger: user enters `/goal <objective>`, `/goal set <objective>`, `/goal plan <hint>`, `/goalplan <hint>`, or `/goal-plan <hint>` while a current active or paused goal may already exist.
- Goal: non-empty goal user input must enter a fresh active goal state or fresh AI-driven goal-planning state regardless of the prior goal state.
- Non-goals: no changes to no-arg `/goal` menu/status behavior; no changes to `/goal show|status|pause|resume|drop`; no rewrite of durable `.jwc/goal` ledger/guard semantics; no PABCD/goal completion guard fix in this phase.
- Verifier: focused Bun tests assert in-memory goal state, durable goal plan brief, submitted prompt text, and absence of paused-goal warnings for the replacement paths.
- Stop condition: all Phase 80 acceptance tests pass plus `git diff --check`; run `bun run check:tools` before committing the implementation.
- Memory artifact: this plan file, A/B/C/D receipts beside it, and the implementation commit hash.
- Expected terminal states: done (tests pass and behavior is patched), noop (current code already satisfies all acceptance; current evidence says it does not), blocked (test harness cannot express TUI/text state), needs-human (desired semantics conflict with durable ledger policy), budget-exhausted (plan or implementation incomplete).
- Escalation condition: if fixing paused replacement requires altering `GoalRuntime.replaceGoal()` semantics for all callers instead of adding command-path orchestration, return to P/A for architecture review.

## Evidence read

- `packages/coding-agent/src/slash-commands/builtin-registry.ts:491-531`: text `/goalplan` and `/goal` helpers currently refuse paused goal state before creating/replacing.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:541-577`: text `/goal plan`, `/goal set`, and direct `/goal <objective>` route through those helpers.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:662-685`: TUI `/goal` delegates to `runtime.ctx.handleGoalModeCommand()`.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts:770-784`: TUI `/goalplan` delegates as `plan <hint>` through the same generic handler.
- `packages/coding-agent/src/modes/interactive-mode.ts:1759-1800`: direct TUI goal input warns instead of replacing when a paused goal exists.
- `packages/coding-agent/src/modes/interactive-mode.ts:1928-1949`: goal planning warns instead of replacing when a paused goal exists.
- `packages/coding-agent/src/modes/interactive-mode.ts:1959-1973`: `/goal set` warns instead of replacing when paused.
- `packages/coding-agent/src/goals/runtime.ts:303-329`: `createGoal()` rejects any existing non-terminal goal; `replaceGoal()` requires enabled active goal and flushes active usage.
- `packages/coding-agent/src/goals/runtime.ts:366-380`: `dropGoal()` clears current goal state and persists `none`, allowing a subsequent create.
- `packages/coding-agent/test/acp-builtins.test.ts:366-455`: text/ACP tests already cover active replacement but not paused replacement.
- `packages/coding-agent/test/goals/goal-mode-integration.test.ts:201-215`: existing TUI integration test explicitly expects paused replacement to be rejected and must be updated.
- `packages/coding-agent/test/goals/goal-mode-integration.test.ts:332-371`: TUI goal planning tests cover fresh and active replacement but not paused replacement.

## Root cause

The command layer treats paused goal state as a management state that must be manually resumed or dropped. That is correct for no-arg `/goal` and administrative commands, but wrong for explicit new objective/planning input under the corrected user contract. The state machine already has safe primitives for active replacement and paused cleanup; the command paths simply do not use them.

## Implementation plan

### MODIFY `packages/coding-agent/src/slash-commands/builtin-registry.ts`

Current relevant behavior:

```ts
async function startTextGoalPlan(runtime, hint) {
  const current = runtime.session.getGoalModeState();
  if (current?.goal.status === "paused") {
    await runtime.output("Resume the current goal first, or drop it before starting goal planning.");
    return commandConsumed();
  }
  // createGoalPlan/startNextGoal, then replace active or create fresh
}

async function startTextGoal(runtime, objective) {
  const current = runtime.session.getGoalModeState();
  if (current?.goal.status === "paused") {
    await runtime.output(GOAL_PAUSED_DIAGNOSTIC);
    return commandConsumed();
  }
  // createGoalPlan/startNextGoal, then replace active or create fresh
}
```

Required shape:

1. Add a small helper near `addGoalTool()` / `removeGoalTool()`:

```ts
async function createOrReplaceGoalState(runtime: SlashCommandRuntime, objective: string): Promise<GoalModeState> {
  const current = runtime.session.getGoalModeState();
  if (current?.enabled && current.goal.status === "active") {
    return await runtime.session.goalRuntime.replaceGoal({ objective });
  }
  if (current?.goal.status === "paused") {
    await runtime.session.goalRuntime.dropGoal();
  }
  return await runtime.session.goalRuntime.createGoal({ objective });
}
```

Use the actual imported `GoalModeState` type if it is already exported into this file; otherwise keep the helper return type explicit using the existing imported type path, not `ReturnType<>`.

2. Remove the paused-goal early returns from `startTextGoalPlan()` and `startTextGoal()`.
3. Keep `createGoalPlan({ cwd, brief })` and `startNextGoal({ cwd })` before state creation/replacement so durable planning files keep matching the fresh state.
4. Replace the current `replacingActive ? replaceGoal : createGoal` branching with `createOrReplaceGoalState()`.
5. Preserve output semantics:
   - `/goal <objective>` returns `{ prompt: trimmedObjective }`.
   - `/goalplan <hint>` and `/goal plan <hint>` return the AI-driven planning prompt.
   - No paused diagnostic should be emitted for explicit new input.
6. Preserve administrative commands exactly: `show/status/pause/resume/drop` still act on the current goal.

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Current relevant behavior:

```ts
if (pausedState) {
  if (subRest) {
    this.showWarning("Resume the current goal first, or drop it before setting a new objective.");
    return;
  }
  await this.#openGoalMenu("paused");
  return;
}
```

and:

```ts
async #startGoalPlanningFromHint(hint: string) {
  if (this.#getPausedGoalState()) {
    this.showWarning("Resume the current goal first, or drop it before starting goal planning.");
    return;
  }
  // active replace or fresh enter
}
```

Required shape:

1. Add or refactor a private helper that creates a fresh goal state from any non-plan-mode goal state:

```ts
async #createOrReplaceGoalState(objective: string): Promise<void> {
  if (this.goalModeEnabled) {
    await this.#applyReplacedGoalState(objective);
    return;
  }
  if (this.#getPausedGoalState()) {
    await this.session.goalRuntime.dropGoal();
    this.session.setGoalModeState(undefined);
    this.goalModePaused = false;
  }
  await this.#enterGoalMode({ objective, silent: true });
  this.#resetGoalContinuationSuppression();
}
```

Implementation may choose a different helper name, but the behavior must remain explicit: active = replace, paused = drop/create, none = create. This helper is state-only: it must not write `.jwc/goal/brief.md` or the durable goal-planning files.

2. In `handleGoalModeCommand()` direct input path, when `pausedState && subRest`, first call `#writeGoalPlanFromBrief(subRest)`, then call the new state helper, then submit `subRest` through `onInputCallback`. Do not open the paused menu or warn.
3. In `#startGoalPlanningFromHint()`, remove the paused warning. It must build `{ brief, prompt }`, call `#writeGoalPlanFromBrief(brief)`, then use the new state helper with `brief`. It must still submit only the generated planning prompt, not the brief itself.
4. In `#handleGoalSetSubcommand()`, allow `set <objective>` while paused. After receiving explicit or editor-provided objective text, first call `#writeGoalPlanFromBrief(objective)`, then use the same state helper. No-arg `set` can still prompt the editor; after receiving text it must replace/create regardless of paused state.
5. Keep the existing no-current-goal direct input behavior semantically equivalent to today's `#startGoalFromObjective()` path, but add the missing durable plan write where the acceptance criteria require it.
6. Keep the plan-mode guard at `handleGoalModeCommand()` lines 1761-1764. `/goal` must still refuse while plan mode is active.
7. Do not alter `GoalRuntime.replaceGoal()` itself unless A-stage rejects the helper approach.

### MODIFY `packages/coding-agent/test/acp-builtins.test.ts`

Add paused-state coverage to the existing replacement block or a new nearby test:

- Start `/goal paused source`.
- Pause via `session.goalRuntime.pauseGoal()` or the fake runtime equivalent.
- Execute `/goal replacement after pause`.
- Assert result `{ prompt: "replacement after pause" }`.
- Assert no paused diagnostic in `output`.
- Assert state is enabled/active with objective `replacement after pause` and a new id.
- Assert `readGoalPlan(cwd)?.brief === "replacement after pause"`.
- Repeat for `/goal set replacement after pause`, `/goalplan paused planning hint`, and `/goal plan paused planning hint`; assert objective contains the expected replacement objective or `GOAL_PLAN_PENDING_BRIEF` + hint, and the planning routes return a prompt containing `AI-driven goal planning`.

Fake runtime note: current fake `replaceGoal()` throws unless `enabled && active`; paused path should therefore prove the implementation uses drop/create rather than replace-on-paused.

### MODIFY `packages/coding-agent/test/goals/goal-mode-integration.test.ts`

Replace the current rejection test at lines 201-215 with positive replacement coverage:

Before:

```ts
it("rejects a new /goal objective while paused", async () => {
  // expects warning and paused state remains
});
```

After:

```ts
it("replaces a paused goal via direct /goal text", async () => {
  // pause existing goal through bare /goal menu
  // call handleGoalModeCommand("Replace the objective")
  // assert active state, new objective, no paused warning, submitted text, durable plan brief
});
```

Add adjacent coverage for:

- `handleGoalModeCommand("set Replace the objective")` while paused.
- `handleGoalModeCommand("plan choose next target")` while paused; assert prompt text contains `AI-driven goal planning is active.` and `Hint: choose next target`, state objective contains `GOAL_PLAN_PENDING_BRIEF`, and durable plan brief contains the hint.
- Bare `handleGoalModeCommand()` while paused still opens the paused menu and can resume; existing resume-menu test should remain unchanged.

## Verification plan

Run focused tests first:

```bash
bun test packages/coding-agent/test/acp-builtins.test.ts --filter goal
bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts --filter goal
```

If Bun's filter does not select the intended tests in this repo, run the two files directly without `--filter`:

```bash
bun test packages/coding-agent/test/acp-builtins.test.ts packages/coding-agent/test/goals/goal-mode-integration.test.ts
```

Then run:

```bash
git diff --check
bun run check:tools
```

Run `bun run check:ts` only if TypeScript signature/import changes are non-trivial or focused tests do not typecheck the modified files sufficiently.

## Acceptance criteria

- Text/ACP `/goal <objective>` replaces a paused current goal with a fresh active goal state and returns the objective prompt.
- Text/ACP `/goal set <objective>` replaces a paused current goal with a fresh active goal state.
- Text/ACP `/goalplan <hint>` and `/goal plan <hint>` replace a paused current goal with a fresh AI-driven goal-planning state and return the planning prompt.
- TUI/Interactive `handleGoalModeCommand("<objective>")` replaces a paused current goal, writes the durable goal plan brief, and submits the objective as the pending input.
- TUI/Interactive `handleGoalModeCommand("set <objective>")` replaces a paused current goal and writes the durable goal plan brief.
- TUI/Interactive `handleGoalModeCommand("plan <hint>")` replaces a paused current goal with the planning brief, writes that brief durably, and submits only the generated planning prompt.
- No-arg `/goal` while paused still opens the paused management menu.
- `/goal show|status|pause|resume|drop` behavior is unchanged.
- `/goal` while plan mode is active still refuses with `Exit plan mode first.`
