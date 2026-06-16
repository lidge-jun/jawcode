# 260614 — `/goal plan` / `/goalplan` build notes

## Implemented source changes

- Added shared goal-planning start contract in `packages/coding-agent/src/goals/goal-planning-start.ts`.
  - `GOAL_PLAN_PENDING_BRIEF` is the durable sentinel objective prefix for AI-driven goal planning.
  - `buildGoalPlanningStart(hint)` stores user text as a `hint:` line and creates a model-facing prompt that explicitly says the hint is directional context, not the final objective.
- Updated native `jwc goal plan [hint]` in `packages/coding-agent/src/jwc-runtime/goal-cli.ts` to use the same sentinel/hint builder instead of treating `plan` arguments as the objective.
- Updated TUI `/goal` parsing in `packages/coding-agent/src/modes/interactive-mode.ts`.
  - `plan` is now a real `GoalSubcommand`.
  - `/goal plan [hint]` starts durable goal planning via `createGoalPlan` + `startNextGoal`, enters goal mode on the sentinel objective, and submits the planning prompt to the model.
  - Active/paused goal preflights run before durable writes, so `/goal-plan` cannot create partial state when refusal is required.
- Updated text/ACP slash handling in `packages/coding-agent/src/slash-commands/builtin-registry.ts`.
  - `/goal` now has a text-mode `handle` and is advertised to ACP clients.
  - `/goal plan [hint]`, `/goalplan [hint]`, and `/goal-plan [hint]` share the same planning helper.
  - `/goal <text>` remains direct goal creation and still returns `<text>` as the model prompt.
- Updated pending goal activation in `packages/coding-agent/src/session/agent-session.ts` so a sentinel planning goal may be refined/replaced by a later pending goal request, while normal active goals remain protected.

## Regression coverage

- `packages/coding-agent/test/goals/goal-mode-integration.test.ts`
  - Added TUI coverage proving `/goal plan ship import cleanup` creates a sentinel planning objective with a `hint:` line, not literal `plan ship import cleanup`, and submits the planning prompt.
- `packages/coding-agent/test/acp-builtins.test.ts`
  - Added ACP advertisement coverage for `goal` and `goalplan`.
  - Added text/ACP routing coverage for `/goal <objective>`, `/goal plan <hint>`, `/goalplan <hint>`, and `/goal-plan <hint>`.
  - The alias cases assert the objective contains the sentinel and hint, and never becomes the literal `plan <hint>` objective.
  - Added no-partial-write coverage proving `/goal-plan <hint>` refuses while goal mode is already active before creating `.jwc/goal/goals.json`.

## Verification evidence

- PASS: `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts`
  - `66 pass`, `0 fail`, `289 expect() calls`.
- TYPECHECK ATTEMPT: `bun --cwd=packages/coding-agent run check:types`
  - Failed on pre-existing unrelated dirty-tree errors in `bench/context-optimization.bench.ts`, `src/coordinator-mcp/server.ts`, `src/harness-control-plane/phase-rollup.ts`, and legacy workflow-name tests (`ralplan`/`ultragoal` type fallout).
  - The rerun no longer reports the new `test/acp-builtins.test.ts` errors that appeared before the local test fix.

## Contract outcome

The intended slash-command contract is now consistent across native CLI, TUI, and ACP/text mode:

| Command | Meaning |
|---|---|
| `/goal text` | Direct goal objective `text`. |
| `/goal set text` | Replace active goal objective with `text`. |
| `/goal plan text` | Start AI-driven goal planning; `text` is a hint. |
| `/goalplan text` | Alias for AI-driven goal planning; `text` is a hint. |
| `/goal-plan text` | Alias for AI-driven goal planning; `text` is a hint. |

The invariant from earlier devlog is preserved: `hint는 objective가 아니다`.
