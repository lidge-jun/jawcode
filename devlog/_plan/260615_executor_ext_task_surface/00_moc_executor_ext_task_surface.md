# 260615 — executor_ext task surface + routing decision tree

> Status: doctrine clarification scaffold; no product/source code changes in this artifact.
> Trigger: the repo implementation supports `executor_ext` as an internal/fresh external executor lane, but the active task/subagent tool surface exposed to this session still advertises only the four bundled role agents (`executor`, `architect`, `planner`, `critic`). That mismatch caused an external review request to be routed through plain `executor` with prose saying “executor_ext-style”. Follow-up product decision: make `executor` the normal general-purpose subagent role, make `executor_ext` its user-selectable external/fresh counterpart, and treat `planner`/`architect`/`critic` as lifecycle/review specialist roles that remain callable when explicitly requested.

## 1. Current code facts

`executor_ext` exists in product code, but not as a fifth bundled role-agent prompt file.

- `packages/coding-agent/src/task/types.ts`
  - `agent` is `z.string()`, not an enum.
  - each task item has optional `model?: string` (`self`, `cheap:<provider>`, `best:<provider>`, or direct model id).
- `packages/coding-agent/src/task/index.ts`
  - `requestedAgentName === "executor_ext" ? "executor" : requestedAgentName` for agent lookup.
  - runtime `agentName` remains `executor_ext` for model/cache/routing behavior.
  - `executor_ext` uses `agentModelOverrides.executor_ext ?? agentModelOverrides.executor`.
  - `executor_ext` bypasses PABCD workflow actor routing and stays fresh-spawn/non-cache-affine.
  - result metadata sets `cacheAffinity: { affine: false, reason: "executor_ext" }`.
- `packages/coding-agent/src/config/model-registry.ts`
  - model selector target includes `executor_ext` with tag `EXECUTOR_EXT`, name `External Executor`, settings path `task.agentModelOverrides`.
- `packages/coding-agent/src/config/model-profiles.ts`
  - profile role supports `executor_ext`.
  - legacy/profile `executor` mapping is normalized into `agentModelOverrides.executor_ext`.
- `packages/coding-agent/src/modes/components/model-selector.ts`
  - UI exposes `EXECUTOR_EXT` / `External Executor` and maps old executor role entries to `executor_ext` where needed.
- Tests already cover the internal policy target:
  - `packages/coding-agent/test/default-jwc-definitions.test.ts`
  - `packages/coding-agent/test/task-executor-self-fork.test.ts`
  - `packages/coding-agent/test/model-selector-*.test.ts`
  - `packages/coding-agent/test/model-profile-*.test.ts`

Conclusion: `executor_ext` is already a supported task runtime policy target and model selector target. The product decision under discussion is to expose it as the user-selectable external counterpart to the general `executor` lane, not as a separate prompt behavior unrelated to executor.

## 2. Gap

The model-facing tool description / active tool metadata still presents only the four role agents. That is correct for bundled role-agent files, but incomplete for task routing because `executor_ext` is a valid `agent` string accepted by the TaskTool runtime.

This creates two failure modes:

1. Agents think `executor_ext` is unavailable and use `executor` with “external-style” prose.
2. Agents choose the cache-affine default `executor` when the user explicitly requested an external/model-configurable executor lane.

## 3. Product decision

Promote the task-role surface to five callable agents:

- `executor`
- `executor_ext`
- `architect`
- `planner`
- `critic`

Semantic split:

- `executor` is the default general-purpose subagent for ordinary parallel work. It can do implementation, focused fixes, read-only research, repo investigation, and bounded verification prep depending on the assignment. It uses the normal execution-model fork lane.
- `executor_ext` is the external/fresh counterpart to `executor`. Use it when the user explicitly wants external/ext workers, a non-default external executor lane, model-diverse executor work, or a separately configured `EXECUTOR_EXT` target. It may also do implementation or read-only research depending on the assignment.
- `planner`, `architect`, and `critic` are specialist lifecycle/review roles. In ordinary operation they are mainly used by PABCD/plan/audit/check flows, but they remain directly callable when the user explicitly requests that lens.

Do not make `executor_ext` a different implementation discipline from `executor`; it is the external dispatch lane for executor-like work. Do make it visible enough that agents stop pretending the lane is unavailable.
Final interview decisions:

- `executor_ext` reuses the executor prompt/implementation; only dispatch policy, model target, cache affinity, and workflow actor routing differ.
- `executor_ext` examples must show explicit `provider/modelId[:effort]` selectors. Shorthands may remain supported but should not be the primary agent-facing example.
- Specialist lens wins over externality: “external architect/planner/critic” should keep the specialist role and apply a model hint/override, not collapse into `executor_ext`.
- Legacy compatibility stays: `agentModelOverrides.executor` remains a fallback for `executor_ext`.
- `planner`, `architect`, and `critic` should be presented as PABCD-lifecycle-centered specialist roles that remain directly callable when explicitly requested.

## 4. Routing decision tree

### 4.1 Default general subagent lane

Use `agent: "executor"` when:

- the user says “subagent 병렬”, “parallel executors”, “workers”, or asks to split implementation/research work without specifying an external model/provider;
- the task is normal bounded implementation, refactor, test work, repo investigation, or read-only research;
- parent/default execution-model fork behavior is acceptable or preferred;
- PABCD B-stage implementation slices should use normal runtime actor/self-fork behavior.

Behavior:

- default general-purpose fork executor lane;
- can be used for implementation or research depending on assignment instructions;
- model override for `EXECUTOR_EXT` does **not** apply;
- can run multiple bounded non-overlapping slices in parallel;
- under PABCD, actor routing may apply according to current workflow state.

### 4.2 External general subagent lane

Use `agent: "executor_ext"` when:

- the user explicitly says “external executor”, “외부 executor”, “external subagent”, “외부 서브에이전트”, “ext”, “executor_ext”, or `EXECUTOR_EXT`;
- the user asks for external/fresh workers for parallel implementation or read-only research;
- the user wants executor-like work on a different model/provider as an independence/model-diversity requirement;
- the task is a freshness/model-diversity review where the normal fork lane is undesirable;
- the goal is to test the external executor lane itself.

Behavior:

- resolves to executor-like implementation/research behavior;
- model-configurable through `task.agentModelOverrides.executor_ext` or per-task `model` hint;
- bypasses workflow actor resume/self-fork cache routing;
- records non-cache-affinity diagnostics;
- for research-only use, the parent assignment must explicitly say read-only/no product mutation.

### 4.3 Specialist lifecycle/review roles

Use `planner`, `architect`, and `critic` when the requested lens is specifically planning, architecture review, or plan critique. Their default home is the PABCD lifecycle and related plan/audit/check workflows, but direct calls remain valid when a user asks for that specialist role outside the lifecycle.

Do not map specialist review requests to `executor_ext` just because an external model is desired. Preserve the requested role and apply a per-task `model` hint or role model override if supported.

## 5. Model selection answer

Yes: `executor_ext` can be model-specified.

Supported paths:

1. **Per-task model hint**
   - The TaskTool task item schema has `model?: string`.
   - Agent-friendly guidance should prefer explicit selectors in the form `provider/modelId[:effort]`, for example `openai/gpt-5.4:high` or `anthropic/claude-sonnet-4-6:low`.
   - Presets such as `cheap:<provider>` and `best:<provider>` are accepted as convenience selectors, but they are less audit-friendly than explicit `provider/modelId[:effort]` when the user intends a specific external lane.
   - Bare model ids, canonical ids, fuzzy patterns, and globs may resolve, but external executor examples should not rely on inference unless the user provided that exact shorthand.
   - This is task-call local and should be used for one-off external lane requests.

2. **Role/model selector override**
   - `task.agentModelOverrides.executor_ext` is the persistent external executor override.
   - UI/model profile target is `EXECUTOR_EXT` / `External Executor`.
   - Existing legacy profile mappings from `executor` normalize to `executor_ext` so the default cache-fork executor is not accidentally made externally configurable.

Precedence to document/verify:

- explicit task item `model` should win for that task;
- otherwise `task.agentModelOverrides.executor_ext`;
- fallback compatibility: `task.agentModelOverrides.executor` may still be read for legacy configs;
- otherwise normal agent/default model resolution.
Current state answer: yes, `executor_ext` model designation is already possible in code. The missing piece is the visible expression/tool guidance: agents need to see that `executor_ext` is a callable external executor lane and that its model can be selected through `model`, `EXECUTOR_EXT`, or `task.agentModelOverrides.executor_ext`.
Agent-facing expression rule: examples and tool guidance should show `executor_ext` with the model in the same task item, e.g. `{ agent: "executor_ext", tasks: [{ ..., model: "provider/modelId:effort" }] }`. Persistent setup should be expressed as `EXECUTOR_EXT = provider/modelId[:effort]` / `task.agentModelOverrides.executor_ext`.

## 6. Patch targets

Likely source files to update after code inspection:

1. Task tool metadata/description generator
   - Goal: advertise `executor_ext` as a supported callable agent value and external executor lane.
   - Also clarify that `executor` is the default general-purpose subagent for ordinary parallel implementation **and** research.
   - Search targets: Task tool description, tool schema examples, generated active tool docs, bundled agent list rendering.

2. System prompt / task docs
   - Add a compact routing rule:
     - ordinary parallel implementation or research → `executor`;
     - explicit external/ext executor or model-diverse executor work → `executor_ext`;
     - planning/architecture/critique lenses → specialist roles, usually in PABCD lifecycle but callable on demand.

3. Tests
   - Add or update a TaskTool schema/description test proving rendered task guidance mentions `executor_ext` / External Executor as callable.
   - Update role-agent/default-surface tests from four to five callable task roles while preserving exactly four public workflow skills.
   - Add behavior test if missing: `agent: "executor_ext"` resolves executor-like behavior, applies external model override/per-task model, bypasses actor routing, and emits `cacheAffinity.reason = "executor_ext"`.

## 7. Acceptance criteria

- The active TaskTool model-facing description clearly lists `executor_ext` as a supported callable `agent` value.
- The docs distinguish public workflow skills from task role agents:
  - workflow skills remain four: `jaw-interview`, `plan`, `goal`, `team`;
  - callable task roles become five: `executor`, `executor_ext`, `architect`, `planner`, `critic`.
- Decision tree is unambiguous:
  - generic user-requested parallel subagents for implementation or research → `executor`;
  - explicit external/ext/model-diverse executor lane → `executor_ext`;
  - specialist planning/architecture/critique lens → `planner`/`architect`/`critic`, usually via PABCD lifecycle but callable on demand.
- The docs answer that `executor_ext` can be model-specified via per-task `model` and persistent `EXECUTOR_EXT`/`task.agentModelOverrides.executor_ext` settings.
- Tests protect the distinction between workflow skills, default general subagent lanes, and specialist lifecycle/review roles.

## 8. Verification plan

Focused:

```sh
bun test packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/task-executor-self-fork.test.ts
```

Add the relevant TaskTool description/schema test once the source target is identified.

If source code changes touch task runtime/model routing:

```sh
bun test packages/coding-agent/test/task-workflow-actor-routing.test.ts packages/coding-agent/test/model-selector-profiles.test.ts packages/coding-agent/test/model-selector-role-badge-thinking.test.ts
bun --cwd=packages/coding-agent run check:types
```
