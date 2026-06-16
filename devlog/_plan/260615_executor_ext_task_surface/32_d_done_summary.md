# D-stage done summary

P — Planned a five-callable-task-role surface: `executor` default general subagent, `executor_ext` explicit external/fresh/model-diverse executor lane, and `planner`/`architect`/`critic` as PABCD-centered specialist roles.

A — Dual audit iterated until planner and architect PASS; the final plan pinned lazy generated `executor_ext`, gate split, model guidance, actor bypass, and test coverage.

B — Built the implementation: generated `executor_ext` from executor prompt body, exposed it in TaskTool guidance/schema/docs, updated goal/system guidance, added callable-role gates, and added/updated tests.

C — Checked with mechanical gates and adversarial review: `bun run check`, affected tests (92 pass / 602 expects), `bun run check:ts`, and C-stage architect review all passed.

Files/areas changed:
- Task role runtime/schema: `packages/coding-agent/src/task/agents.ts`, `packages/coding-agent/src/task/types.ts`.
- Prompt/docs: `packages/coding-agent/src/prompts/tools/task.md`, `packages/coding-agent/src/prompts/system/system-prompt.md`, `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`, `AGENTS.md`, `docs/models.md`, `docs/tools/task.md`, `structure/20_prompt_flow.md`.
- Gates/scripts: `scripts/lib/callable-task-roles.ts`, `scripts/check-visible-definitions.ts`, `scripts/verify-g002-gates.ts`, `scripts/rebrand-inventory.ts`.
- Tests: `packages/coding-agent/test/default-jwc-definitions.test.ts`, `packages/coding-agent/test/task/agent-visibility.test.ts`, `packages/coding-agent/test/task-bundled-agent-surface.test.ts`, `packages/coding-agent/test/task/executor-ext-model-routing.test.ts`, `packages/coding-agent/test/task-workflow-actor-routing.test.ts`, `packages/coding-agent/test/system-prompt-templates.test.ts`.

Acceptance criteria met:
- TaskTool description exposes `executor_ext` as callable visible role.
- Generic parallel implementation/research routes to `executor`; explicit external/ext/fresh/model-diverse executor work routes to `executor_ext`; specialist lenses remain `planner`/`architect`/`critic` even with model hints.
- `executor_ext` visible guidance prefers `provider/modelId[:effort]` and documents `EXECUTOR_EXT` / `task.agentModelOverrides.executor_ext`.
- `executor_ext` reuses executor prompt body without adding `prompts/agents/executor_ext.md`.
- Runtime semantics preserve `agentModelOverrides.executor_ext ?? agentModelOverrides.executor`, workflow actor bypass, and non-cache-affinity diagnostics.
- Public workflow skills remain exactly four; visible callable task roles are five.
- Tests and gates protect workflow skills, role prompt files, callable task roles, external lane routing, and model precedence/fallback.

WONDER:
- We did not add a browser/e2e-style verification for actual model selector UI rendering of `EXECUTOR_EXT`; existing model-selector tests already cover the role badge surface, but this slice focused on TaskTool/runtime docs.
- The plan assumed a generated role could reuse the executor prompt identity text; audits accepted this as intentional, but a future UX pass might add an explicit lane banner.
- The C review noted that actor-bypass tests prove registry emptiness; cache-affinity is covered in adjacent tests rather than the same actor-routing test.

REFLECT:
- Future specs should explicitly distinguish on-disk prompt-source counts from runtime callable-role counts at the first requirements pass.
- Model-selection acceptance criteria should always state whether examples must be exact selectors (`provider/modelId[:effort]`) or shorthand presets.
- PABCD audit plans should include implementation-order constraints whenever gates and generated runtime surfaces must land atomically.
