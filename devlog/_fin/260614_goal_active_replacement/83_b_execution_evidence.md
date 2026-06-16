# B-stage execution evidence — active goal slash replacement

Date: 2026-06-14
Status: implemented; read-only verifier DONE

## Changed files

- `packages/coding-agent/src/modes/interactive-mode.ts`
- `packages/coding-agent/src/slash-commands/builtin-registry.ts`
- `packages/coding-agent/test/goals/goal-mode-integration.test.ts`
- `packages/coding-agent/test/acp-builtins.test.ts`
- `packages/coding-agent/src/task/index.ts` (C-stage gate cleanup: unused parameter + formatting)
- `packages/coding-agent/test/jwc-runtime/actor-registry.test.ts` (C-stage gate cleanup: formatting)
- `devlog/_plan/260614_goal_active_replacement/80_pabcd_goal_active_replacement_plan.md`
- `devlog/_plan/260614_goal_active_replacement/81_a_planner_fail_round1.md`
- `devlog/_plan/260614_goal_active_replacement/81_a_planner_fail_round2.md`
- `devlog/_plan/260614_goal_active_replacement/82_a_architect_fail_round1.md`
- `devlog/_plan/260614_goal_active_replacement/82_a_architect_fail_round2.md`
- `devlog/_plan/260614_goal_active_replacement/82_a_architect_pass_final.md`
- `devlog/_plan/260614_goal_active_replacement/83_b_execution_evidence.md`

## Implementation notes

- TUI active `/goal <objective>` now routes through `handleGoalModeCommand` to `#replaceGoalFromObjective` instead of showing the old active-goal diagnostic.
- TUI replacement uses durable-first ordering: `#writeGoalPlanFromBrief(objective)` runs before `#applyReplacedGoalState(objective)`, preserving the prior in-memory goal if durable `.jwc/goal` writing fails.
- TUI active `/goal plan <hint>` / `/goalplan <hint>` rewrites durable `.jwc/goal` with the planning sentinel brief, replaces the active session goal, and submits only the `buildGoalPlanningStart(hint)` prompt to the agent.
- ACP/text `startTextGoal` and `startTextGoalPlan` no longer block active goals. They rewrite `.jwc/goal`, then use `goalRuntime.replaceGoal` for active goals or `createGoal` for inactive goals, keep the `goal` tool active, and commit the new goal mode state.
- Paused goal behavior remains blocked in both TUI and ACP/text paths.
- `GOAL_ACTIVE_DIAGNOSTIC` was removed because no remaining source path should emit the old active-goal block message for replacement commands.
- Replacement ledger/plan semantics: `createGoalPlan` overwrites the active durable plan and appends `plan_created`. This slice does not add a superseded-plan ledger event; historical supersede ledger support remains a follow-up if product wants cli-jaw-style archive parity.
- Initial TUI direct `/goal <objective>` remains session-goal only. A build-time attempt to create durable `.jwc/goal` for initial TUI goals caused existing `goal({op:"complete"})` tests to hit the strict per-goal checkpoint gate, so durable rewrite is scoped to active replacement and plan-mode paths.

## Verification

### Focused behavior + adjacent regression tests

```sh
bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/agent-session-goal-reminder.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts
```

Result: `106 pass, 0 fail, 446 expect() calls`.

### Touched-file formatter/lint check

```sh
bunx biome check src/modes/interactive-mode.ts src/slash-commands/builtin-registry.ts test/goals/goal-mode-integration.test.ts test/acp-builtins.test.ts
```

Result: OK.

### Type check

```sh
bun run check:types
```

CWD: `packages/coding-agent`

Result: pass (`tsgo -p tsconfig.json --noEmit`).

### Package check

```sh
bun run check
```

CWD: `packages/coding-agent`

Initial result: blocked by pre-existing `src/task/index.ts` Biome issues (`actor` unused parameter and formatting in task workflow actor code). C-stage gate cleanup renamed the unused parameter to `_actor` and applied Biome formatting to `src/task/index.ts`; package check then passed.

Final result: pass (`biome check .` + `tsgo -p tsconfig.json --noEmit`).

### Workspace check

```sh
bun run check
```

CWD: repo root

Initial result: blocked by root Biome formatting in `packages/coding-agent/src/task/index.ts`; C-stage gate cleanup applied root Biome formatting. Root workspace check then passed, including `check:ts`, `check:rs`, rebrand inventory, package checks, and Rust build.

## Read-only verifier

- Verifier task: `12-GoalActiveBVerifier`
- Verdict: `DONE`
- Notes: implementation matches plan; low finding to create this evidence file is resolved here; optional `/goalplan` compact alias parity test was added after verifier and focused tests were rerun.
