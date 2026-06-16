# C-stage check — active goal slash replacement

Date: 2026-06-14
Status: pass

## Mechanical gates

- `bun test packages/coding-agent/test/goals/goal-mode-integration.test.ts packages/coding-agent/test/acp-builtins.test.ts packages/coding-agent/test/input-controller-escape.test.ts packages/coding-agent/test/agent-session-goal-reminder.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts`
  - Result: `106 pass, 0 fail, 446 expect() calls`.
- `bunx biome check src/modes/interactive-mode.ts src/slash-commands/builtin-registry.ts test/goals/goal-mode-integration.test.ts test/acp-builtins.test.ts` from `packages/coding-agent`
  - Result: OK.
- `bun run check:types` from `packages/coding-agent`
  - Result: pass.
- `bun run check` from `packages/coding-agent`
  - Initial: failed on unrelated/current `src/task/index.ts` Biome issues.
  - Cleanup: renamed unused `actor` param to `_actor` and formatted `src/task/index.ts`; package check passed.
- `bun run check` from repo root
  - Initial: failed on root Biome formatting for `packages/coding-agent/src/task/index.ts`.
  - Cleanup: root Biome formatted `packages/coding-agent/src/task/index.ts`; root check passed (`check:ts`, `check:rs`, rebrand inventory, package checks, Rust build).

## Acceptance audit

- Active TUI `/goal objective B` replaces objective A, submits objective B, and writes durable plan for B: covered by `goal-mode-integration.test.ts` direct replacement test.
- Active TUI `/goal plan hint` replaces active goal with planning sentinel and submits planning prompt only: covered by `goal-mode-integration.test.ts` plan replacement test.
- ACP/text `/goal`, `/goal plan`, `/goalplan`, `/goal-plan` active replacement no longer emits old active-goal diagnostic: covered by `acp-builtins.test.ts` replacement assertions and source removal of `GOAL_ACTIVE_DIAGNOSTIC`.
- Paused direct replacement remains blocked: existing paused test stays green.
- Existing goal interrupt no-respawn regression stays green: `input-controller-escape`, `agent-session-goal-reminder`, and `goal-runtime` tests passed.

## Residual risks

- Initial TUI direct `/goal <objective>` remains session-goal only to preserve existing `goal({op:"complete"})` behavior. Durable `.jwc/goal` rewrite is scoped to active replacement and plan-mode paths.
- Historical superseded-goal archive parity with cli-jaw is not implemented in this slice; replacement creates a fresh active Jawcode session goal and rewrites the durable active plan.
