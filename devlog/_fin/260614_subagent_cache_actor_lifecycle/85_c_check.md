# C-stage check — subagent actor lifecycle patch

## Mechanical verification

PASS:
- `bun run check`
- `bun test packages/coding-agent/test/jwc-runtime/actor-registry.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts packages/coding-agent/test/task-fork-context.test.ts packages/coding-agent/test/model-selector-role-badge-thinking.test.ts packages/coding-agent/test/model-selector-profiles.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts` → 72 pass, 0 fail.

## Adversarial review against acceptance

Met:
- PABCD actor namespace persisted in state and preserved across stage transitions.
- Stage transition/reset/complete retire actor lookup without deleting history.
- Non-executor P/A/B/C lanes resolve through actor registry and busy same-lane actors are rejected.
- Default executor routes as self-fork actor, creates dispatch-time fork seed on initial actor creation, and does not use batch frozen seeds.
- `executor_ext` aliases to the executor implementation while remaining model-configurable and fresh-spawn/non-cache-affine.
- P/A prompts no longer instruct unconditional fresh spawn for lanes now controlled by runtime routing.
- Model selector exposes `EXECUTOR_EXT` / External Executor instead of configurable default executor.
- Bundled public role-agent count remains four; no `executor_ext.md` role agent was added.

Residual risks:
- Dedicated black-box TaskTool actor-resume integration coverage is still a C/D follow-up; current coverage proves helper/runtime behavior and fork seeding, while verifier accepted the implementation for B→C.
