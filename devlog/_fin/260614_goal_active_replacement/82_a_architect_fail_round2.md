FAIL

[HIGH] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:132-151 — Planned ACP/text `startTextGoal` snippet drops `await addGoalTool(runtime)`. — Add it so ACP/text replacement preserves existing tool activation wiring.

[HIGH] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:88-92 — `#applyReplacedGoalState` runs before `#writeGoalPlanFromBrief` with no rollback if durable write fails. — Specify durable-first ordering or rollback behavior.

[MEDIUM] packages/coding-agent/src/jwc-runtime/goal-engine.ts:538-567 — `createGoalPlan` overwrites plan files and appends `plan_created` without superseding prior ledger history. — Document replacement ledger/plan semantics in B evidence or add supersede handling as follow-up.

[MEDIUM] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:198-214 — Active planning replacement test does not assert durable brief rewrite. — Assert `readGoalPlan(cwd)?.brief` contains planning sentinel/hint after active `/goal plan`.

[MEDIUM] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:59 — Stale rationale “no new persistence semantics” conflicts with durable `.jwc/goal` rewrite contract. — Rewrite.

[LOW] packages/coding-agent/test/acp-builtins.test.ts:132-133 — Fake `replaceGoal` delegates to `createGoal`, masking active-only guard. — Use distinct fake behavior or integration harness for replacement assertions.

Most likely break first: Session goal is replaced before durable `.jwc/goal` rewrite completes, leaving mismatch if `createGoalPlan`/`startNextGoal` throws mid-flow.
