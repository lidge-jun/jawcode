DONE

Read-only verifier found no blocking issues.

Verified areas:
- `packages/coding-agent/src/task/agents.ts`: `executor_ext` generated lazily from executor prompt body with separate frontmatter and visible callable role metadata.
- `packages/coding-agent/src/prompts/tools/task.md`: callable-role routing, explicit `provider/modelId[:effort]` guidance, JSON example, `EXECUTOR_EXT` / `task.agentModelOverrides.executor_ext`, and `inheritContext` support are documented.
- `scripts/lib/callable-task-roles.ts` and `scripts/check-visible-definitions.ts`: gate logic distinguishes four on-disk prompt files from five visible callable roles and rejects a duplicate `prompts/agents/executor_ext.md`.
- `packages/coding-agent/test/task/executor-ext-model-routing.test.ts`: covers executor_ext override, per-task model override, and legacy executor fallback.

Subagent evidence: `agent://18-ExecutorExtBVerifier`.
Durable verifier summary:
- Status: PASS / no blockers.
- Core conclusion: `executor_ext` is a generated callable role that reuses the executor prompt body while keeping separate role metadata and model override behavior.
- Coverage noted: TaskTool guidance/schema docs, callable-role gate split, duplicate on-disk prompt rejection, and executor_ext model-routing tests.
- Follow-up: keep these material findings inline so the checkpoint remains useful even when the transient `agent://...` transcript is unavailable.
