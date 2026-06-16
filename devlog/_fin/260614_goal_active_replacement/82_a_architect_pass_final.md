PASS

[low] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md:143-151 — Planned `startTextGoal` excerpt initially omitted `runtime.session.setGoalModeState(nextState)` after `addGoalTool`; patched in the plan before B.

Most likely break first: B copies the abbreviated direct `startTextGoal` snippet without `setGoalModeState`; resolved in the plan by adding the state commit line.
