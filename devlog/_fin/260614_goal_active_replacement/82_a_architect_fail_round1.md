FAIL

[CRITICAL] packages/coding-agent/src/slash-commands/builtin-registry.ts:413-418 — ACP direct `/goal` replacement rewrites durable `.jwc/goal` via `createGoalPlan`/`startNextGoal`, while TUI `#replaceGoalFromObjective` updates session goal only. — Add explicit session-only vs durable-rewrite decision and implement one shared contract or document/test intentional divergence.

[HIGH] packages/coding-agent/src/modes/interactive-mode.ts:1876-1884 — Planned planning replacement writes durable plan before session replacement, making failure ordering ambiguous. — Commit session replacement first or define a helper/rollback ordering.

[HIGH] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:113-131 — TUI planning replacement copy-pastes state refresh rather than sharing direct replacement side effects. — Extract helper such as `#applyReplacedGoalState` used by direct and plan replacements.

[MEDIUM] packages/coding-agent/src/slash-commands/builtin-registry.ts:393-422 — Removing `replaceActive` leaves ACP durable writes on every direct replace while TUI `/goal set` does not. — Unify `startTextGoal` and TUI replacement contract per acceptance criteria.

[MEDIUM] packages/coding-agent/test/goals/goal-mode-integration.test.ts — Planned active-replace tests check session only, not `.jwc/goal` sync. — Add filesystem assertions or narrow acceptance criteria.

[LOW] packages/coding-agent/test/acp-builtins.test.ts:392-420 — Replacing refusal test is correct; fake session must not mask integration bugs. — Align fake session with runtime semantics in new assertions.

[LOW] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:27-30 — Referenced code symbols/signatures match code. — None.

Most likely break first: Active TUI `/goal objective B` replaces session state while leaving existing `.jwc/goal` artifacts unchanged, but ACP `/goal objective B` rewrites durable files first; native `jwc goal` commands then see different truth depending on entry surface.
