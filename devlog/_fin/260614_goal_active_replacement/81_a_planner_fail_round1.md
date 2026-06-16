FAIL

[high] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Acceptance criteria — First AC requires active TUI `/goal objective B` to start a user-visible submission, but the proposed test only asserts objective/id. — Add submittedText capture and `expect(submittedText).toBe("objective B")`.

[high] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Requirements/source evidence — cli-jaw replacement archives prior goals, but the plan does not decide whether Jawcode must archive/supersede prior goals or make it a non-goal. — Add explicit decision and acceptance criterion/non-goal.

[medium] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Acceptance criteria — Regression AC names `/gd`, but Jawcode has no `/gd` builtin. — Drop `/gd` or map to actual Jawcode command.

[medium] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Patch shape — TUI and ACP planning-replacement blocks can drift. — Extract shared helper or add explicit sync step and paired tests.

[medium] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Devlog deliverable — Executor/devlog evidence is required but artifact fields are optional. — Add concrete evidence file/update requirements.

[medium] packages/coding-agent/src/slash-commands/builtin-registry.ts:557-565 — TUI slash registry delegates to `handleGoalModeCommand`; plan does not explicitly state the TUI submission contract. — Document intended contract and test it.

[low] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Executor verification lacks a concrete owner/artifact. — Name verifier step and artifact.

[low] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — GOAL_ACTIVE_DIAGNOSTIC cleanup is conditional without proof. — Add check/test ensuring active replacement paths do not emit old diagnostic.

Most likely misread: That reusing `#replaceGoalFromObjective` and `GoalRuntime.replaceGoal` already satisfies the cli-jaw replacement contract, including archival/history behavior described in the reference evidence.
