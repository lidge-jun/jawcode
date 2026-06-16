# 260614 — `/goal plan`, `/goalplan`, `/goal-plan` literal-objective bug investigation

> Status: investigated only. No product-source patch applied in this note. Scope: slash command routing for TUI and ACP/text paths.

## Symptom

User observed that commands intended to mean “use the text as a planning hint and let the agent determine/refine the actual goal” are instead treated as literal goal text:

- `/goal plan text` becomes a goal objective like `plan text` or leaks as `/goal plan text` into the model path.
- `/goalplan text` and `/goal-plan text` have the same class of failure.

Expected behavior from historical devlog is different: `plan text` is a hint, not the objective. The agent should decide/refine the goal from context + hint, then execute under goal mode.

## Current code facts

### 1. `/goal` is TUI-only and has no text/ACP handler

`packages/coding-agent/src/slash-commands/builtin-registry.ts` currently defines `/goal` with `handleTui` only:

```ts
{
  name: "goal",
  subcommands: ["set", "show", "pause", "resume", "drop"],
  inlineHint: "[objective]",
  allowArgs: true,
  handleTui: async (command, runtime) => {
    await runtime.ctx.handleGoalModeCommand(command.args || undefined);
  },
}
```

AST check confirmed the goal spec has `handleTui` but no `handle`.

`packages/coding-agent/src/slash-commands/acp-builtins.ts` advertises ACP/text builtins with:

```ts
BUILTIN_SLASH_COMMANDS_INTERNAL.filter(command => command.handle !== undefined)
```

So `/goal` is invisible to ACP/text builtin dispatch. In `packages/coding-agent/src/modes/acp/acp-agent.ts`, when builtin dispatch returns `false`, the raw text falls through to:

```ts
await record.session.prompt(text, { images });
```

That is the path where `/goal plan text` can reach the model as a literal slash prompt.

### 2. `/goal plan text` is parsed as a direct objective in TUI

TUI submit path:

```text
input-controller.ts → executeBuiltinSlashCommand → /goal.handleTui → handleGoalModeCommand(command.args)
```

`InteractiveMode.handleGoalModeCommand()` parses only this subcommand set:

```ts
type GoalSubcommand = "set" | "show" | "pause" | "resume" | "drop";
const GOAL_SUBCOMMANDS = new Set(["set", "show", "pause", "resume", "drop"]);
```

`parseGoalSubcommand("plan text")` does not recognize `plan`, so it returns `{ sub: undefined, rest: "plan text" }`.

Then `handleGoalModeCommand()` starts a normal direct goal:

```ts
if (subRest) {
  await this.#startGoalFromObjective(subRest);
  return;
}
```

So in TUI, `/goal plan text` becomes direct objective `plan text`, not AI-driven plan mode.

### 3. `/goalplan` and `/goal-plan` exist but are also TUI-only and route to the broken `/goal plan` shape

`packages/coding-agent/src/slash-commands/builtin-registry.ts` currently defines:

```ts
{
  name: "goalplan",
  aliases: ["goal-plan"],
  description: "AI-driven goal planning — agent analyzes context and sets goal autonomously",
  inlineHint: "[hint]",
  allowArgs: true,
  handleTui: async (command, runtime) => {
    const args = (command.args ?? "").trim();
    const goalArgs = args ? `plan ${args}` : "plan";
    await runtime.ctx.handleGoalModeCommand(goalArgs);
    runtime.ctx.editor.setText("");
  },
}
```

Alias lookup itself works: `BUILTIN_SLASH_COMMAND_LOOKUP` registers `command.name` and every `command.aliases` item, so `/goal-plan` resolves to the same spec.

But the spec has no `handle`, so ACP/text-mode filters it out just like `/goal`.

In TUI, `/goalplan text` becomes `handleGoalModeCommand("plan text")`, which falls into the direct-objective path above. `/goal-plan text` does the same through the alias.

## Historical contract from devlog

Existing devlog entries establish that `/goalplan` was supposed to be a shortcut for AI-driven goal planning, not a direct objective:

- `devlog/_plan/260613_skill_consolidation/04_slash_commands_and_bridge.md` says `/goalplan` → `/goal plan` alias and describes it as “Create a plan-mode goal”.
- `devlog/_plan/260613_skill_consolidation/05_open_questions.md` records the user decision: `/goalplan` means the agent determines the goal from conversation context; hint is directional guidance.
- `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.07.00_issue_reset_goal_verb_parity.md` states `/goalplan [hint]` maps to `/goal plan` and explicitly notes the invariant: “hint는 objective가 아니다”.
- `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/99.00.04_plan_band_closeout_batch.md` lists `/goalplan [hint]` and the invariant test as intended S4 work.

## Root cause

There are two coupled bugs:

1. **Surface mismatch:** `/goal` and `/goalplan` are TUI-only (`handleTui`) commands. ACP/code/text dispatch only sees commands with `handle`, so raw slash commands can fall through as normal prompts.
2. **Semantic mismatch:** the TUI `/goalplan` implementation rewrites to `handleGoalModeCommand("plan ...")`, but `handleGoalModeCommand()` does not implement a `plan` subcommand. It treats `plan ...` as the literal objective.

## Required patch shape

Recommended implementation should avoid duplicating goal semantics in three places:

1. Add `plan` to the goal subcommand grammar:
   ```ts
   type GoalSubcommand = "set" | "show" | "pause" | "resume" | "drop" | "plan";
   ```

2. Implement `plan` as a distinct AI-planning mode, not a direct objective. It should preserve the invariant:
   ```text
   hint is guidance, not objective
   ```

3. Add text/ACP `handle` handlers for both `/goal` and `/goalplan` or route both to a shared helper:
   - `/goal plan [hint]`
   - `/goalplan [hint]`
   - `/goal-plan [hint]`

4. The shared helper should use the native `jwc goal plan [hint]` machinery or equivalent goal runtime state, rather than setting objective to `plan ${hint}`.

5. When goal plan mode starts, the next model-facing prompt should tell the agent:
   - goal planning is active;
   - the user hint is optional directional context;
   - infer/refine the actual objective from conversation + repo context;
   - do not treat the hint string itself as the final objective.

## Regression tests to add

- TUI / interactive:
  - `/goal plan text` must not create a goal whose objective is `plan text`.
  - `/goalplan text` must not create a goal whose objective is `plan text`.
  - `/goal-plan text` must behave identically to `/goalplan text`.

- ACP/text:
  - `ACP_BUILTIN_SLASH_COMMANDS` includes `goal` and `goalplan` or otherwise handles them before prompt fallthrough.
  - `executeAcpBuiltinSlashCommand("/goalplan text", runtime)` does not return `false`.
  - Raw `/goalplan text` and `/goal-plan text` are never forwarded to `record.session.prompt()` unchanged.

- Invariant:
  - stored brief/objective contains the sentinel or plan-mode state for AI-driven refinement;
  - user hint is stored separately or only as a hint line;
  - active user-facing objective is not exactly `plan text`, `/goalplan text`, or `/goal-plan text`.

## Current risk

Because `/goalplan` is advertised as AI-driven but currently TUI-only and internally rewritten to an unsupported `plan` subcommand, users can believe they started autonomous goal planning while the runtime actually started a literal direct goal. In ACP/code-mode, the same command can bypass builtin dispatch and become an ordinary user prompt.