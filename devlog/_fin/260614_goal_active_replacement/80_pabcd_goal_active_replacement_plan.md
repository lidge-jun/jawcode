# PABCD P Plan — Active goal slash replacement UX

Date: 2026-06-14
Status: P draft for critic review
Goal: Implement cli-jaw-style goal replacement UX in Jawcode goal mode: while a goal is active, `/goal <objective>`, `/goal plan <hint>`, and `/goalplan <hint>` replace the active goal and continue/steer instead of blocking. Document the work, run PABCD gates, focused tests, package check, and executor verification.

## Requirements and source evidence

- User wants active goal mode to allow fresh `/goal ddd` and `/goalplan` as UX replacement/continuation, not block on the existing goal.
- User explicitly asked to inspect cli-jaw recent dev behavior.
- cli-jaw reference repo: `../cli-jaw`.
- cli-jaw evidence inspected:
  - `../cli-jaw/AGENTS.md` lines 47 and `../cli-jaw/structure/INDEX.md` line 154 record `/goal plan` and `/goalplan` plan-mode behavior.
  - `../cli-jaw/src/cli/handlers-workflows.ts:216-233` uses `replace: true` for `/goal plan`/`/goalplan`, archives prior goal, and returns a steer prompt instructing refinement.
  - `../cli-jaw/tests/unit/goal-terminal-no-steer.test.ts:79-127` asserts `/goal set`, direct `/goal ...`, `/goal plan ...`, and `/goalplan ...` replace existing active goals and archive history.
- Jawcode current evidence inspected:
  - `packages/coding-agent/src/modes/interactive-mode.ts:1712-1747` blocks active `/goal <objective>` with `Goal mode is already active...`.
  - `packages/coding-agent/src/modes/interactive-mode.ts:1867-1885` blocks active `/goal plan`/`/goalplan` in `#startGoalPlanningFromHint`.
  - `packages/coding-agent/src/slash-commands/builtin-registry.ts:372-389` blocks text/ACP `/goal plan`/`/goalplan` when goal mode is active.
  - `packages/coding-agent/src/slash-commands/builtin-registry.ts:392-422` blocks text/ACP direct `/goal <objective>` when active unless the verb is `set`.

## Change class

C2 ordinary product slice with C3-ish workflow-surface impact:
- touches TUI interactive command path, ACP/text slash path, tests, and devlog;
- no new dependencies, no persistence schema migration, no TUI visual/scroll files.

## Files and exact patch shape

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

#### Active direct `/goal <objective>`

Current behavior in `handleGoalModeCommand(rest?)`:

```ts
if (this.goalModeEnabled) {
	if (subRest) {
		this.showStatus("Goal mode is already active. Use /goal to manage it, or /goal drop to start over.");
		return;
	}
	await this.#openGoalMenu("active");
	return;
}
```

Planned behavior:

```ts
if (this.goalModeEnabled) {
	if (subRest) {
		await this.#replaceGoalFromObjective(subRest);
		return;
	}
	await this.#openGoalMenu("active");
	return;
}
```

Rationale: match cli-jaw direct `/goal replacement objective` replacement UX while making Jawcode's TUI and ACP/text entry surfaces converge on the same session goal + durable `.jwc/goal` rewrite contract.

Shared contract decision: Jawcode will not implement cli-jaw's historical archive store in this slice. Replacement creates a fresh active Jawcode session goal and rewrites the durable `.jwc/goal` plan for the new objective; superseded goal archival/history parity is a non-goal because Jawcode's inline `GoalRuntime` state and cli-jaw's `src/goal/store.ts` history model are different persistence systems.

#### Shared TUI replacement helpers

Add private helpers so direct replacement and plan replacement share the same state side effects:

```ts
async #writeGoalPlanFromBrief(brief: string): Promise<void> {
	const cwd = this.sessionManager.getCwd();
	await createGoalPlan({ cwd, brief });
	await startNextGoal({ cwd });
}

async #applyReplacedGoalState(objective: string): Promise<void> {
	const state = await this.session.goalRuntime.replaceGoal({ objective });
	this.session.setGoalModeState(state);
	this.goalModeEnabled = true;
	this.goalModePaused = false;
	this.#resetGoalContinuationSuppression();
	this.#updateGoalModeStatus();
	if (this.session.isStreaming) {
		await this.session.sendGoalModeContext({ deliverAs: "steer" });
	}
}
```

Update `#replaceGoalFromObjective(objective)` to call `#writeGoalPlanFromBrief(objective)` first, then `#applyReplacedGoalState(objective)`, then submit exactly `objective` via `onInputCallback`. Durable-first ordering preserves the existing session goal if writing `.jwc/goal` fails. Leave initial TUI `#startGoalFromObjective(objective)` unchanged because creating durable `.jwc/goal` files on first direct TUI goal changes the existing `goal({op:"complete"})` verification contract; this slice only rewrites durable files for active replacement and plan-mode paths.

#### Active `/goal plan <hint>` and `/goalplan <hint>`

Current behavior in `#startGoalPlanningFromHint(hint)`:

```ts
if (this.goalModeEnabled) {
	this.showStatus("Goal mode is already active. Use /goal to manage it, or /goal drop to start over.");
	return;
}
```

Authoritative planned behavior:

```ts
const { brief, prompt } = buildGoalPlanningStart(hint);
if (this.goalModeEnabled) {
	await this.#writeGoalPlanFromBrief(brief);
	await this.#applyReplacedGoalState(brief);
} else {
	await this.#writeGoalPlanFromBrief(brief);
	await this.#enterGoalMode({ objective: brief, silent: true });
	this.#resetGoalContinuationSuppression();
}
if (this.onInputCallback) {
	this.onInputCallback(this.startPendingSubmission({ text: prompt }));
}
```

Implementation detail: do **not** call `#replaceGoalFromObjective(brief)` in this branch. That helper submits its objective via `onInputCallback`; plan-mode replacement must submit only the planning prompt from `buildGoalPlanningStart(hint)`, not the sentinel objective.

Paused goals: keep existing paused guard unchanged in this slice. cli-jaw also replaces paused goals, but Jawcode `GoalRuntime.replaceGoal()` requires enabled active accounting; paused replacement should be a separate runtime/API decision.

### MODIFY `packages/coding-agent/src/slash-commands/builtin-registry.ts`

#### Text/ACP `/goal <objective>`

Current `startTextGoal(runtime, objective, replaceActive)` blocks active goals unless `replaceActive` is true:

```ts
if (current?.enabled && current.goal.status === "active" && !replaceActive) {
	await runtime.output(GOAL_ACTIVE_DIAGNOSTIC);
	return commandConsumed();
}
```

Planned behavior:

- Remove this active-block for direct replacement.
- Keep paused block unchanged.
- Remove the `replaceActive` parameter and update both `handleGoalTextCommand` callsites: the `set` branch and the default direct `/goal` branch both call the simplified `startTextGoal(runtime, objective)`.
- Direct active replacement uses the same replacement contract as TUI: rewrite durable `.jwc/goal` planning artifacts first, then replace the session goal for the committed replacement objective.

```ts
await createGoalPlan({ cwd: runtime.cwd, brief: trimmedObjective });
await startNextGoal({ cwd: runtime.cwd });
const replacingActive = current?.enabled && current.goal.status === "active";
const nextState = replacingActive
	? await runtime.session.goalRuntime.replaceGoal({ objective: trimmedObjective })
	: await runtime.session.goalRuntime.createGoal({ objective: trimmedObjective });
await addGoalTool(runtime);
runtime.session.setGoalModeState(nextState);
```

#### Text/ACP `/goal plan <hint>` and `/goalplan <hint>`

Current `startTextGoalPlan(runtime, hint)` blocks active goal mode.

Planned behavior:

```ts
const current = runtime.session.getGoalModeState();
if (current?.goal.status === "paused") { ...keep paused diagnostic... }
const { brief, prompt } = buildGoalPlanningStart(hint);
await createGoalPlan({ cwd: runtime.cwd, brief });
await startNextGoal({ cwd: runtime.cwd });
const replacingActive = current?.enabled && current.goal.status === "active";
const nextState = replacingActive
	? await runtime.session.goalRuntime.replaceGoal({ objective: brief })
	: await runtime.session.goalRuntime.createGoal({ objective: brief });
await addGoalTool(runtime);
runtime.session.setGoalModeState(nextState);
return { prompt };
```

This makes ACP/text behavior match the TUI behavior and cli-jaw replacement semantics while continuing to store the Jawcode planning sentinel in the goal objective. If `.jwc/goal/goals.json` already exists, `createGoalPlan({ cwd, brief })` rewrites the durable planning artifacts for the new active plan, matching cli-jaw replacement UX rather than refusing because a prior goal plan exists.

#### TUI slash contract

TUI slash dispatch enters through `builtin-registry.ts` `handleTui` for `/goal` and `/goalplan`, then delegates to `runtime.ctx.handleGoalModeCommand(...)`. TUI does **not** return an ACP-style `{ prompt }`; the user-visible submission is the `onInputCallback(this.startPendingSubmission(...))` side effect from `InteractiveMode`. `handleTui` still clears the editor with `editor.setText("")`, and when args are present while goal mode was already enabled, it adds the slash text to history. Tests should assert the `handleGoalModeCommand` side effect and, where needed, slash-registry tests should continue to cover ACP/text `{ prompt }` returns separately.

### MODIFY `packages/coding-agent/test/goals/goal-mode-integration.test.ts`

Add/adjust tests:

1. Change existing `rejects a new /goal objective while paused` remains as paused-only guard.
2. Add active replacement test:

```ts
it("replaces the active goal via direct /goal text", async () => {
	let submittedText: string | undefined;
	harness.mode.onInputCallback = input => {
		submittedText = input.text;
	};
	await harness.mode.handleGoalModeCommand("objective A");
	const original = harness.session.getGoalModeState()?.goal;
	await harness.mode.handleGoalModeCommand("objective B");
	expect(harness.session.getGoalModeState()?.goal.objective).toBe("objective B");
	expect(harness.session.getGoalModeState()?.goal.id).not.toBe(original?.id);
	expect(submittedText).toBe("objective B");
	expect(await Bun.file(path.join(harness.cwd, ".jwc", "goal", "goals.json")).exists()).toBe(true);
	expect(readGoalPlan(harness.cwd)?.brief).toBe("objective B");
});
```

3. Add active goal planning replacement test:

```ts
it("replaces an active goal via /goal plan and submits the planning prompt", async () => {
	let submittedText: string | undefined;
	harness.mode.onInputCallback = input => { submittedText = input.text; };
	await harness.mode.handleGoalModeCommand("objective A");
	await harness.mode.handleGoalModeCommand("plan choose next target");
	expect(harness.session.getGoalModeState()?.goal.objective).toContain(GOAL_PLAN_PENDING_BRIEF);
	expect(harness.session.getGoalModeState()?.goal.objective).toContain("hint: choose next target");
	expect(submittedText).toContain("AI-driven goal planning is active.");
	expect(submittedText).toContain("Hint: choose next target");
	expect(readGoalPlan(harness.cwd)?.brief).toContain("hint: choose next target");
});
```

4. Add active diagnostic negative tests:
   - TUI active `/goal objective B` and `/goal plan hint` must not call `showStatus("Goal mode is already active...")`.
   - ACP/text active `/goal objective B`, `/goal plan hint`, `/goalplan hint`, and `/goal-plan hint` must not write `GOAL_ACTIVE_DIAGNOSTIC` to `output`.


Import `readGoalPlan` from `@gajae-code/coding-agent/jwc-runtime/goal-engine` or the equivalent relative source path already used by tests, and use it only for durable-plan assertions.

### MODIFY `packages/coding-agent/test/acp-builtins.test.ts`

Add/adjust tests near existing goalplan coverage:

1. Current test `/goal-plan refuses active goal mode before writing durable planning files` must be replaced because the desired UX is pass-through replacement.
2. New assertions:
   - active direct `/goal replacement objective` returns `{ prompt: "replacement objective" }` and replaces state.
   - active `/goalplan should replace` returns a planning prompt, goal objective contains `GOAL_PLAN_PENDING_BRIEF`, and the old active state is gone.
   - durable `.jwc/goal/goals.json` exists after `/goalplan` because planning files are intentionally written now, unlike the old refusal test.
   - active `/goalplan` over an existing `.jwc/goal/goals.json` rewrites the durable plan; assert the file exists and reflects the new pending planning brief.
   - fake `replaceGoal` should not simply delegate to `createGoal`; it must assert/require an existing active state before replacing so tests do not mask `GoalRuntime.replaceGoal`'s active-only guard.

### UPDATE `devlog/_plan/260614_goal_active_replacement/83_b_execution_evidence.md`

Create/update this implementation evidence file during B with:
- changed source/test file list;
- implementation notes for TUI direct replacement, TUI planning replacement, ACP/text replacement, and durable `.jwc/goal` rewrite ordering;
- replacement ledger/plan semantics: `createGoalPlan` overwrites the active durable plan and appends `plan_created`; this slice does not add a superseded-plan ledger event, and any historical supersede ledger is a follow-up;
- focused test outputs;
- package check output;
- executor verifier receipt id and verdict.

### UPDATE `devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md`

This living PABCD plan file records the current P plan and later evidence log.

Canonical follow-up files in the same folder:
- `81_a_planner_fail_round*.md` / `82_a_architect_fail_round*.md` — A-stage fail reports.
- `83_b_execution_evidence.md` — canonical B-stage implementation, test, package-check, and executor-verifier evidence.
- `84_c_check.md` — C-stage check evidence.
- `85_d_done.md` — D-stage summary.

## Non-goals

- Do not change `.jwc/goal/goals.json` schema.
- Do not implement paused-goal replacement in this slice.
- Do not implement cli-jaw-style historical archive storage for superseded goals; replacement creates a fresh active session goal and rewrites the durable active plan.
- Do not change goal completion/drop/pause terminal command behavior.
- Do not touch welcome banner, scroll model, or other TUI visual identity files.
- Do not change cli-jaw; it is reference evidence only.
- Remove `GOAL_ACTIVE_DIAGNOSTIC` if active replacement eliminates all remaining references; otherwise keep it only for a still-tested paused/non-replacement path.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts
```

Regression tests from adjacent prior goal work:

```sh
bun test packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/agent-session-goal-reminder.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts
```

Package check:

```sh
bun run check
```

from `packages/coding-agent`.

Workflow gates:

- P: critic verdict OKAY.
- A: independent planner + architect audit pass.
- B: implement + read-only verifier DONE.
- C: mechanical gates and adversarial check pass.
- D: final summary.

Goal checkpoints:

- After P plan/critic.
- After implementation + focused tests.
- After package check + executor verification.

## Acceptance criteria

- Active TUI `/goal objective B` replaces active objective A, starts a user-visible submission for objective B, and rewrites durable `.jwc/goal/` planning artifacts for objective B.
- Active TUI `/goal plan hint` and `/goalplan hint` replace the active goal with the planning sentinel objective, rewrite durable `.jwc/goal/` planning artifacts for the new pending plan, and submit the AI-driven planning prompt, not the raw sentinel alone.
- Active ACP/text `/goal objective B`, `/goal plan hint`, `/goalplan hint`, and `/goal-plan hint` replace instead of returning the old active-goal diagnostic.
- Active ACP/text `/goalplan hint` rewrites existing `.jwc/goal/` planning artifacts for the new active plan instead of refusing because durable goal files already exist.
- Replacement creates a fresh active Jawcode session goal; cli-jaw-style archival/history of the superseded goal is explicitly not part of this slice.
- Paused goal direct replacement remains blocked with the existing paused diagnostic.
- Existing `/goal set`, `/goal show/status`, `/goal pause/resume/drop`, and goal interrupt no-respawn tests stay green.
- Devlog records cli-jaw evidence, implementation notes, test output, and executor verification in `devlog/_plan/260614_goal_active_replacement/83_b_execution_evidence.md`.
