FAIL

[medium] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — TUI slash contract — Plan does not state that `/goal` TUI input flows through `builtin-registry.ts` `handleTui` into `handleGoalModeCommand`, with `onInputCallback` submission rather than ACP-style `{ prompt }`. — Add explicit subsection and tests.

[low] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Active diagnostic cleanup — Verification lacks negative assertions that active replacement paths do not emit old active-goal diagnostic. — Add paired negative TUI/ACP tests.

[low] devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md — Executor verification artifact — Plan has optional `83_b_verifier.md` plus mandatory `83_b_execution_evidence.md`, which can split evidence. — Make `83_b_execution_evidence.md` canonical for verifier receipt fields.

Most likely misread: That adding `#writeGoalPlanFromBrief` to TUI replacement already documents the full TUI slash entry contract, when actual TUI path is handleTui delegation and onInputCallback submission rather than ACP-style returned prompt.
