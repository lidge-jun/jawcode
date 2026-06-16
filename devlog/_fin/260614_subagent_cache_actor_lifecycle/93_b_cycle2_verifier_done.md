DONE

Read-only B-stage verifier recheck passed after commit `a29f3708`.

Checks:
- `packages/coding-agent/src/task/receipt.ts` surfaces `context_unavailable` in receipt synopsis/error summary for async job result assertions.
- `packages/coding-agent/test/task-workflow-actor-routing.test.ts` asserts missing actor session does not call a second `SessionManager.open`, creates no second child session, and result text contains `context_unavailable`.
- Successful actor resume test observes both subprocess session opens use the same actor session file.
- `packages/coding-agent/test/task-executor-self-fork.test.ts` asserts receipt `cacheAffinity` for `self_fork` and `executor_ext`.

Verification already run by main session before this report:
- `bun test packages/coding-agent/test/jwc-runtime/actor-registry.test.ts packages/coding-agent/test/task-executor-self-fork.test.ts packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/task-fork-context.test.ts` → 28 pass, 0 fail.
- `bun --cwd=packages/coding-agent run check:types` → pass.
