# D-stage done summary — `/goal plan` / aliases

## Cycle summary

- P — Planned the root fix for slash-command routing drift: make `plan` a real goal subcommand, share the AI-planning sentinel/hint contract, and cover TUI + ACP/text paths.
- A — Planner/architect audit passed after tightening the plan around `/goal plan` metadata and no-write-before-refusal coverage.
- B — Built the shared planning-start helper, native/TUI/ACP routing, sentinel replacement safety, and regression tests.
- C — Checked with focused tests, package checks, and full workspace `bun run check`; all gates are green.

## Files changed for the requested acceptance criteria

- `packages/coding-agent/src/goals/goal-planning-start.ts`
  - Added the canonical `GOAL_PLAN_PENDING_BRIEF` sentinel and `buildGoalPlanningStart()` helper.
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
  - Native `jwc goal plan [hint]` now uses the shared sentinel/hint builder.
- `packages/coding-agent/src/modes/interactive-mode.ts`
  - TUI `/goal plan [hint]` is a real subcommand and no longer becomes literal objective text.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts`
  - ACP/text `/goal`, `/goal plan`, `/goalplan`, and `/goal-plan` are handled before prompt fallthrough.
- `packages/coding-agent/src/session/agent-session.ts`
  - Pending native goal activation may replace only sentinel planning goals, not normal active goals.
- `packages/coding-agent/test/goals/goal-mode-integration.test.ts`
  - Covers TUI `/goal plan <hint>` sentinel objective + planning prompt behavior.
- `packages/coding-agent/test/acp-builtins.test.ts`
  - Covers ACP advertisement, direct `/goal <objective>`, `/goal plan`, `/goalplan`, `/goal-plan`, and active refusal before durable writes.
- `devlog/_plan/260614_goal_slash_plan_alias_bug/*`
  - Captures investigation, plan, audit receipts, build verification, C-stage evidence, and this closeout.

## Acceptance criteria met

- `/goal <text>` remains a direct goal objective.
- `/goal plan <hint>` starts AI-driven planning; `hint` is not the objective.
- `/goalplan <hint>` starts the same AI-driven planning path.
- `/goal-plan <hint>` starts the same AI-driven planning path.
- ACP/text command dispatch advertises and handles `goal` / `goalplan`; the known forms do not fall through to raw model prompt text.
- Active/paused refusal paths run before durable `.jwc/goal` writes.
- Native CLI, TUI, and ACP/text share the same sentinel/hint contract.

## WONDER — still missing / risks

- The tests cover command dispatch and state shape; they do not run a full end-to-end model turn that uses the planning prompt to call `jwc goal refine`. That behavior is governed by the goal-mode continuation contract and prompt text, not asserted here.
- The plan assumed only the slash routing bug would block C-stage, but full `bun run check` exposed unrelated dirty-tree gate failures. Those were repaired to keep the workspace green.
- The active-goal refusal coverage is strongest in ACP/text for `/goal-plan`; TUI refusal ordering is verified by reviewer inspection and code ordering, not a new dedicated TUI no-write test.

## REFLECT — spec improvements

- The goal slash-command spec should explicitly define `/goal plan [hint]` as a public subcommand, not only describe `/goalplan` as an alias.
- Acceptance criteria should require text/ACP dispatch coverage whenever a TUI slash command has user-facing semantics.
- The spec should name the durable sentinel and say whether the optional hint belongs in the goal brief, metadata, or prompt-only context; this implementation stores it as a `hint:` line under the sentinel.
- Future C-stage specs should distinguish feature-specific gates from whole-workspace dirty-tree gate repair, because here the full check forced unrelated cleanup.
