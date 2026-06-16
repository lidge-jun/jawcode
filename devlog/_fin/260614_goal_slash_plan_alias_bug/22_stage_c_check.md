# C-stage check — goal slash planning alias fix

## Mechanical gates

- PASS: `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts`
  - `66 pass`, `0 fail`, `289 expect() calls`.
- PASS: `bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts`
  - `43 pass`, `0 fail`, `135 expect() calls`.
- PASS: `bun --cwd=packages/agent run check`.
- PASS: `bun --cwd=packages/utils run check`.
- PASS: `bun --cwd=packages/coding-agent run check`.
- PASS: `bun run check`.
  - Includes `check:ts` (Biome, Node 20 baseline, schema check, JWC UI redesign gate, rebrand inventory, workspace TypeScript checks) and `check:rs` (Rust scope, cargo fmt check, cargo clippy).

## Adversarial review

Acceptance criteria re-read against the implementation:

- `/goal <text>` direct objective path remains intact in text/ACP mode: `startTextGoal(..., replaceActive=false)` creates a durable goal plan and returns `{ prompt: trimmedObjective }`; ACP regression asserts `/goal ship import cleanup` returns the direct prompt and stores that exact objective.
- `/goal plan <hint>` is now a real TUI subcommand: `GoalSubcommand` includes `plan`, `GOAL_SUBCOMMANDS` includes it, and `#dispatchGoalSubcommand` routes to `#startGoalPlanningFromHint`.
- `/goalplan <hint>` and `/goal-plan <hint>` share planning semantics: the registry keeps the TUI alias rewrite but `/goal plan` is now meaningful, and text/ACP `handle` calls `startTextGoalPlan` directly.
- Hint is not the final objective: all planning paths use `buildGoalPlanningStart()`, which stores the objective as `GOAL_PLAN_PENDING_BRIEF` plus optional `hint: ...`, and sends a model prompt explicitly saying the hint is directional context.
- ACP/text no longer falls through: `/goal` and `/goalplan` have text-mode handlers, so `ACP_BUILTIN_SLASH_COMMANDS` advertises them and `executeAcpBuiltinSlashCommand()` returns handled results.
- Active/paused refusal precedes durable writes: both TUI `#startGoalPlanningFromHint` and text `startTextGoalPlan` check active/paused state before `createGoalPlan()`; ACP regression asserts `/goal-plan` active refusal does not create `.jwc/goal/goals.json`.
- Pending refinement safety: `AgentSession.#activatePendingJwcGoalModeRequest()` only lets the sentinel planning objective be replaced by a pending native goal request, preserving refusal for non-sentinel active goals.

Residual risk: none for the requested slash-command contract. The C-stage also repaired unrelated dirty-tree gate failures surfaced by `bun run check` (format drift, stale pruning API/tests, phase-rollup receipt typing, RPC get_state include typing, Rust scope/doc lint, schema drift, Node release workflow baseline) so the workspace gate is currently green.
