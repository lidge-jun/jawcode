# 260614 — execution plan: fix `/goal plan`, `/goalplan`, `/goal-plan` plan-mode routing

> PABCD P-stage plan. Scope: slash-command routing and regression coverage only. Source edits are pending approval.

## Problem

`/goal plan text`, `/goalplan text`, and `/goal-plan text` are meant to start AI-driven goal planning where `text` is a hint. Current behavior can treat the hint/literal command as the goal objective.

Root causes from `00_findings.md`:

1. `/goal` has only `handleTui`; ACP/text builtin dispatch filters it out because it lacks `handle`.
2. `/goalplan` and alias `/goal-plan` also have only `handleTui`.
3. `/goalplan` rewrites to `handleGoalModeCommand("plan ...")`, but `InteractiveMode` does not implement a `plan` goal subcommand.
4. Existing historical invariant: hint is guidance, not objective.

## Desired behavior

- `/goal <objective>` remains direct human objective creation.
- `/goal set <objective>` remains replacement/direct set.
- `/goal plan [hint]`, `/goalplan [hint]`, `/goal-plan [hint]` start AI-driven goal-planning mode.
- The hint must not become the active objective as `plan <hint>`, `/goalplan <hint>`, or `/goal-plan <hint>`.
- ACP/text-mode must consume these commands instead of forwarding raw slash text as a prompt.

## Files

### MODIFY `packages/coding-agent/src/modes/interactive-mode.ts`

Add `plan` to the `GoalSubcommand` grammar and dispatch:

Before:

```ts
type GoalSubcommand = "set" | "show" | "pause" | "resume" | "drop";
const GOAL_SUBCOMMANDS = new Set<GoalSubcommand>(["set", "show", "pause", "resume", "drop"]);
```

After:

```ts
type GoalSubcommand = "set" | "show" | "pause" | "resume" | "drop" | "plan";
const GOAL_SUBCOMMANDS = new Set<GoalSubcommand>(["set", "show", "pause", "resume", "drop", "plan"]);
```

Add case in `#dispatchGoalSubcommand`:

```ts
case "plan":
  await this.#handleGoalPlanSubcommand(rest);
  return;
```

Add helper near goal subcommand helpers:

```ts
async #handleGoalPlanSubcommand(hint: string): Promise<void> {
  await this.#startGoalPlanningFromHint(hint);
}
```

Add `#startGoalPlanningFromHint(hint: string)` with a single concrete state sequence and a preflight before any durable write:

1. Refuse plan start if an active or paused goal already exists:
   ```ts
   const current = this.session.getGoalModeState();
   if (current?.enabled && current.goal.status === "active") {
     this.showStatus("Goal mode is already active. Use /goal to manage it, or /goal drop to start over.");
     return;
   }
   if (current?.goal.status === "paused") {
     this.showWarning("Resume the current goal first, or drop it before starting goal planning.");
     return;
   }
   ```
2. Build the plan-mode brief through a shared helper:
   ```ts
   const { brief, prompt } = buildGoalPlanningStart(hint);
   ```
3. Persist durable goal-plan artifacts in `.jwc/ultragoal`:
   ```ts
   const cwd = this.sessionManager.getCwd();
   await createGoalPlan({ cwd, brief });
   await startNextGoal({ cwd });
   ```
4. Enter in-session goal mode with the sentinel brief, not `plan ${hint}`:
   ```ts
   await this.#enterGoalMode({ objective: brief, silent: true });
   ```
5. Submit the model-facing planning prompt from the helper, not the raw hint:
   ```ts
   this.onInputCallback(this.startPendingSubmission({ text: prompt }));
   ```

Imports needed in `interactive-mode.ts`:

```ts
import { buildGoalPlanningStart } from "../goals/goal-planning-start";
import { createGoalPlan, startNextGoal } from "../jwc-runtime/goal-engine";
```

### NEW `packages/coding-agent/src/goals/goal-planning-start.ts`

Create a neutral shared module for the sentinel, brief construction, and prompt. It owns no state writes, and `goal-cli.ts` must import its sentinel/helper from here so there is one owner.

```ts
export const GOAL_PLAN_PENDING_BRIEF = "(AI-driven goal planning pending refinement)";

export interface GoalPlanningStart {
  brief: string;
  hint: string;
  prompt: string;
}

export function buildGoalPlanningStart(rawHint: string | undefined): GoalPlanningStart {
  const hint = rawHint?.trim() ?? "";
  const brief = hint ? `${GOAL_PLAN_PENDING_BRIEF}\nhint: ${hint}` : GOAL_PLAN_PENDING_BRIEF;
  const prompt = [
    "AI-driven goal planning is active.",
    "The user hint below is directional context, not the final objective.",
    hint ? `Hint: ${hint}` : "Hint: (none)",
    "Infer the concrete goal from the conversation and repo context.",
    "Refine the active goal with `jwc goal refine \"<specific objective>\"` before completing execution.",
    "Then execute the refined goal with verification.",
  ].join("\n");
  return { brief, hint, prompt };
}
```

### MODIFY `packages/coding-agent/src/jwc-runtime/goal-cli.ts`

Remove the local `GOAL_PLAN_PENDING_BRIEF` constant and import from `../goals/goal-planning-start`:

```ts
import { buildGoalPlanningStart, GOAL_PLAN_PENDING_BRIEF } from "../goals/goal-planning-start";
```

For the `plan` verb, use:

```ts
const { brief } = buildGoalPlanningStart(positional.join(" "));
```

This keeps CLI, TUI, and ACP using the same sentinel and hint formatting.

### MODIFY `packages/coding-agent/src/session/agent-session.ts`

Fix pending refine activation for plan-mode sentinels. In `#activatePendingJwcGoalModeRequest()`, before the current “active non-terminal goal blocks activation” return, allow replacement when the active objective is the plan-mode sentinel:

```ts
const currentState = this.getGoalModeState();
const currentObjective = currentState?.goal.objective ?? "";
const isPlanPending = currentObjective.startsWith(GOAL_PLAN_PENDING_BRIEF);
if (currentState?.goal && currentState.goal.status !== "complete" && currentState.goal.status !== "dropped") {
  if (!isPlanPending) return false;
  const replaced = await this.#goalRuntime.replaceGoal({ objective: pendingGoal.objective });
  this.setGoalModeState(replaced);
  return true;
}
```

Import `GOAL_PLAN_PENDING_BRIEF` from the new neutral module. This is required because `jwc goal refine` updates `.jwc/ultragoal` and writes a pending request, but current activation refuses to update an active sentinel goal.

### MODIFY `packages/coding-agent/src/slash-commands/builtin-registry.ts`

Add shared text-mode helpers for goal command handling.

Concrete `/goal` text/ACP contract:

- Add `/goal` subcommand metadata for discoverability:
  ```ts
  { name: "plan", description: "Start AI-driven goal planning", usage: "[hint]" }
  ```
- no args → run `runNativeGoalCommand(["status"], runtime.cwd)`, output stdout/stderr, consume.
- Preflight for `plan [hint]`, `set <objective>`, and direct `<objective>` before durable writes:
  - if active and command is `plan` or direct objective → output the same active-goal diagnostic as TUI and consume without writes;
  - if paused and command is `plan`, direct objective, or `set` → output the same paused-goal diagnostic as TUI and consume without writes;
  - `set <objective>` while active uses replacement semantics, not create semantics.
- `plan [hint]` → run the same plan-mode sequence as TUI:
  1. `const { brief, prompt } = buildGoalPlanningStart(hint)`
  2. `createGoalPlan({ cwd: runtime.cwd, brief })`
  3. `startNextGoal({ cwd: runtime.cwd })`
  4. `const state = await runtime.session.goalRuntime.createGoal({ objective: brief })`
  5. `await runtime.session.setActiveToolsByName([...new Set([...runtime.session.getActiveToolNames().filter(name => name !== "goal"), "goal"])])`
  6. `runtime.session.setGoalModeState(state)`
  7. return `{ prompt }`
- `set <objective>`:
  - if an active accounting goal exists: persist durable `createGoalPlan`/`startNextGoal` for the new objective, then `goalRuntime.replaceGoal({ objective })`;
  - if no goal exists: direct create sequence below;
  - if paused: reject before durable writes with the paused diagnostic.
- direct `<objective>` → direct goal creation in text mode when no goal is active/paused:
  1. `createGoalPlan({ cwd: runtime.cwd, brief: objective })`
  2. `startNextGoal({ cwd: runtime.cwd })`
  3. `const state = await runtime.session.goalRuntime.createGoal({ objective })`
  4. add `goal` to active tools and set session goal-mode state as above
  5. return `{ prompt: objective }`
- `show`/`status` → same as no args.
- `pause` → `const state = await runtime.session.goalRuntime.pauseGoal()`, `runtime.session.setGoalModeState(state)`, remove `"goal"` from active tools, output `"Goal mode paused."`, consume.
- `resume` → `const state = await runtime.session.goalRuntime.resumeGoal()`, add `goal` to active tools, set state, output `"Goal mode resumed."`, consume.
- `drop`/`cancel` → `await runtime.session.goalRuntime.dropGoal()`, `runtime.session.setGoalModeState(undefined)`, remove `"goal"` from active tools, output `"Goal dropped."`, consume.
- Every recognized `/goal` form must return a handled result; no known `/goal` invocation may return `false`.

For `/goalplan`:

Before:

```ts
handleTui: async (command, runtime) => {
  const args = (command.args ?? "").trim();
  const goalArgs = args ? `plan ${args}` : "plan";
  await runtime.ctx.handleGoalModeCommand(goalArgs);
  runtime.ctx.editor.setText("");
},
```

After:

- Keep `handleTui`, and route it through the public `runtime.ctx.handleGoalModeCommand(goalArgs)` entrypoint after adding real `plan` dispatch to `InteractiveMode`. This is intentional: once `plan` is a real subcommand, `goalArgs = args ? `plan ${args}` : "plan"` no longer creates a direct `plan ...` objective.
- Add `handle` that consumes ACP/text `/goalplan [hint]` and `/goal-plan [hint]` through alias lookup by invoking the same shared text-mode goal-plan helper used by `/goal plan [hint]`.

### MODIFY `packages/coding-agent/src/slash-commands/acp-builtins.ts`

If adding `handle` to the registry is sufficient, no logic change needed. Add tests proving `ACP_BUILTIN_SLASH_COMMANDS` includes `goal` and `goalplan` because the existing filter includes handlers.

### MODIFY `packages/coding-agent/test/goals/goal-mode-integration.test.ts`

Add TUI regression tests:

1. `handleGoalModeCommand("plan ship import")` must not set objective to `plan ship import`.
2. `/goalplan ship import` through builtin command execution must not set objective to `plan ship import`.
3. `/goal-plan ship import` through builtin command execution must behave identically to `/goalplan ship import`.
4. Existing direct objective behavior remains: `handleGoalModeCommand("Ship the release")` still sets `Ship the release`.
5. Existing `budget 123` direct-objective regression remains valid; `budget` must not become a command.

### MODIFY `packages/coding-agent/test/acp-builtins.test.ts`

Extend the fake session/runtime with minimal goal APIs needed by the text handlers.

Add ACP/text regression tests:

1. `ACP_BUILTIN_SLASH_COMMANDS` includes `goal` and `goalplan`.
2. `executeAcpBuiltinSlashCommand("/goalplan ship import", runtime)` does not return `false`.
3. `executeAcpBuiltinSlashCommand("/goal-plan ship import", runtime)` does not return `false`.
4. `executeAcpBuiltinSlashCommand("/goal plan ship import", runtime)` does not return `false`.
5. The returned prompt/output does not contain a final objective equal to raw `/goalplan ship import`, `/goal-plan ship import`, or `plan ship import`.
6. Direct ACP/text `/goal ship import` creates a direct goal and returns `{ prompt: "ship import" }`.
7. ACP `/goal-plan ship import` alias coverage belongs here; TUI `/goal-plan ship import` alias coverage belongs in `goal-mode-integration.test.ts`.

## Acceptance criteria

- `/goal plan [hint]` starts AI-driven planning; hint is not objective.
- `/goalplan [hint]` starts the same behavior.
- `/goal-plan [hint]` starts the same behavior.
- ACP/code/text mode consumes all three forms; no raw slash command falls through to `session.prompt()` unchanged.
- Direct `/goal <objective>` remains direct objective creation.
- Goal mode still blocks conflicting plan mode as before.
- Stored plan-mode brief/objective contains `GOAL_PLAN_PENDING_BRIEF`.
- Hint text is stored only as the `hint: ...` line in the plan-mode brief, not as the final direct objective.
- Active user-facing objective for plan mode is not exactly `plan text`, `/goalplan text`, or `/goal-plan text`.
- `jwc goal refine "<real objective>"` during active plan-mode sentinel replaces the active session goal objective with the refined objective via pending-goal activation.
- `/goal plan ...`, `/goalplan ...`, and `/goal-plan ...` while an active/paused goal exists do not write `.jwc/ultragoal` artifacts before refusing.

## Verification

Run focused tests:

```bash
bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts
```

Run type/check only if edits touch exported types or handler signatures broadly:

```bash
bun run check:ts
```

## Risks

- Native `jwc goal plan` currently writes `.jwc/ultragoal` artifacts. The implementation must intentionally mirror those artifacts by calling `createGoalPlan` + `startNextGoal` directly, then separately activate the in-session `GoalRuntime`.
- Text-mode direct `/goal <objective>` is required to activate a direct goal, not just consume with a diagnostic.
- Avoid changing the public meaning of `/goal set`, `/goal show`, `/goal pause`, `/goal resume`, `/goal drop`.
