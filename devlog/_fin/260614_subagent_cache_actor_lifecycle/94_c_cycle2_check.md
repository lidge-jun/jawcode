# C-stage check — subagent actor lifecycle cycle 2

## Mechanical verification

PASS:
- `bun run check` → workspace checks passed (Biome, Node 20 baseline, JSON schema check, UI redesign gate, rebrand inventory strict, package TS checks, Rust scope/build).
- `bun test packages/coding-agent/test/jwc-runtime/actor-registry.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/task-executor-self-fork.test.ts packages/coding-agent/test/task-cache-key.test.ts packages/coding-agent/test/task-fork-context.test.ts packages/coding-agent/test/model-selector-role-badge-thinking.test.ts packages/coding-agent/test/model-selector-profiles.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts` → 79 pass, 0 fail, 412 expect calls.

## Adversarial review against plan acceptance

Met:
- Async task execution no longer disables PABCD actor routing merely because the wrapper passes a `sessionFiles` override; only explicit `runMode`/`resumeMessage` overrides bypass hidden actor routing.
- Compatible actor resume now runs a pre-resume openability/maintenance guard before message dispatch; missing actor session files return `context_unavailable` instead of silently claiming resume.
- `WorkflowActorRecord.needsCompact` can be cleared through `markActorMaintained`, recording `compactedAt` without retiring the actor.
- `cacheAffinity` is typed on `SingleResult`, propagated through executor options/results, and exposed in sanitized task receipts.
- `executor_ext` remains non-cache-affine/model-configurable; default executor self-fork remains the cache-affine path.
- B/C orchestration prompts now document stage-local actor resume/retirement semantics.
- Plan skill guidance marks `planner_subagent_id` metadata as audit/fallback breadcrumbs only; PABCD actor registry owns workflow actor `sessionFile` routing.

Residual risks:
- The actor-local compaction implementation is still conservative: cycle 2 clears explicit `needsCompact` and checks session openability, but does not yet run a full restored child `AgentSession.compact()` pass. This is intentionally reflected in the plan as scaffold/maintenance metadata rather than a provider cache-hit guarantee.
- Codex prewarm remains reported as skipped in the current hook; no provider prewarm success is claimed.

## Verdict

All required gates for this cycle are green. The remaining risks are accurately scoped and do not block C→D for the committed actor lifecycle checkpoint.
