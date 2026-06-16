# 260614 — Subagent cache-fork + PABCD durable actor lifecycle

> Status: scaffold only. No product source changes in this slice.
> Trigger: repeated Planner/Architect/Critic/Executor subagent calls are fresh-spawn oriented, so same-provider calls do not reliably reuse prompt cache, websocket append state, or role-agent conversation state.
> Decision direction: introduce a cache-fork self-clone lane for cache affinity, and a PABCD durable role-actor resume lane for workflow stages.
> Interview update 2026-06-14: topology confirmed as five phases — (1) resume actor registry, (2) cache-fork self-clone, (3) PABCD wiring, (4) compaction/prewarm, (5) public API/model UI cleanup.
>
> Locked decisions:
> - Actor compatibility key is conservative/full-scope.
> - PABCD gets a dedicated `actor_namespace_id` / run id; a new PABCD cycle never reuses old actors.
> - Actor records are separate from async job records: jobs can complete while workflow actors become idle/resumable.
> - PABCD state stores only the active namespace; detailed records live in `.jwc/state/sessions/<session-id>/actors.json`.
> - Phase 1 automatic resume is session/process scoped; cross-process resume is prepared but not claimed until a later phase.
> - Non-executor role actors are same-lane non-concurrent.
> - Default `executor` is a full-coding self-fork lane, model-setting independent, parallel via separate fork actors.
> - `executor_ext` is an internal policy alias for model-configurable fresh-spawn executor behavior.
> - Cache-fork failure may explicitly fall back to `executor_ext`/fresh spawn when policy allows, without claiming cache affinity.
> - Model UI should remove misleading configurable `EXECUTOR` and expose `EXTERNAL EXECUTOR` / `EXECUTOR_EXT`.
> - Implementation strategy: run repeated PABCD cycles per phase under the overall subagent actor lifecycle goal; keep devlog files current as the execution ledger evolves.

## 1. Problem statement

Current JWC task subagents have two partial mechanisms, but neither matches the desired lifecycle:

1. `inheritContext` can seed a child with a parent snapshot, but it is optional and does not by itself create a durable forked thread lane.
2. `subagent resume/steer` can reopen a registered `sessionFile`, but normal repeated task calls do not automatically resolve to the same role actor.

This means repeated calls such as P-stage Planner/Architect/Critic or A-stage audit agents are effectively fresh spawn unless the explicit resume path is used. Same provider alone is not enough for caching: OpenAI Codex-style cache affinity requires a stable prompt cache key, same model, same reasoning/thinking, and stable prefix.

## 2. Desired model

Use two explicit lanes instead of treating every subagent spawn as the same operation.

### 2.1 Cache-fork self-clone lane

Purpose: maximize first-call cache affinity from the parent session.

Contract:

- The child is a self-fork of the caller, not a role-agent model override.
- It inherits the parent model and thinking level; executor/planner/architect/critic model presets do not apply.
- It preserves the parent prompt prefix and appends the task instruction after the inherited prefix.
- It uses the parent cache identity as the provider-facing cache key.
- It may receive a lightweight appended role/task directive, but must not replace the stable system prompt prefix.

Non-goal:

- This is not the default replacement for all role agents. It is the cache-optimized path for self-clone delegation and first actor bootstrap.

### 2.2 Durable role-actor resume lane

Purpose: make workflow role agents behave like persistent actors instead of fresh jobs.

Contract:

- A role actor is keyed by workflow session + workflow stage/lane + role + model + thinking level.
- The first creation may use cache-fork/full-context bootstrap when the model/thinking lane matches the parent.
- Subsequent calls resume the same actor session instead of spawning a new one.
- If model, thinking level, role prompt version, or workflow lane changes, a new actor lane is created.
- Automatic compaction is actor-local and persisted; after compaction, that compacted actor history becomes the new resume baseline.

Primary target:

- PABCD P/A/C/D role lanes: Planner, Architect, Critic, verifier/reviewer.

Secondary target:

- General `task` API can expose this as an opt-in actor policy after the workflow path proves stable.

## 3. Why this fits multi-provider orchestration

The current model-profile system intentionally allows different providers/models for roles. That is good for orchestration quality but bad for prefix cache reuse. The split-lane design keeps both:

- Multi-provider role agents remain available as fresh or durable role actors.
- Cache-sensitive work uses the self-clone lane where model/thinking cannot diverge.
- PABCD can choose per lane: same-model cache fork for cheap cache hits, or multi-provider role actor when quality/risk requires an independent model.

This avoids pretending that "same provider" equals cache reuse. Cacheability becomes an explicit lane property.

## 4. Current source map

JWC task/subagent lifecycle:

- `packages/coding-agent/src/task/index.ts`
  - registers detached task jobs;
  - registers resume descriptors with `sessionFile`;
  - explicit resume runner reopens the descriptor session.
- `packages/coding-agent/src/task/executor.ts`
  - opens `SessionManager.open(sessionFile)` when provided, otherwise uses in-memory sessions;
  - default `runMode` is `initial`, which sends the assignment as a fresh prompt;
  - `runMode: resume|message` only happens through resume/steer paths.
- `packages/coding-agent/src/session/agent-session.ts`
  - `buildForkContextSeed()` emits `cacheIdentity: options.cacheIdentity ?? this.sessionId`.
- `packages/coding-agent/src/sdk.ts`
  - provider-facing cache id is `options.providerSessionId ?? options.forkContextSeed?.cacheIdentity ?? logicalSessionId`.
- `packages/ai/src/providers/openai-codex-responses.ts`
  - Codex websocket/cache state keys include model id and prompt cache key, so provider equality alone is insufficient.

Codex-rs comparison points from `~/developer/codex/openai-codex/codex-rs`:

- `core/src/tools/handlers/multi_agents_v2/spawn.rs`
  - `fork_turns` defaults to `all`.
  - full-history fork rejects role/model/reasoning overrides.
- `core/src/agent/control.rs`
  - fork reads stored parent history, filters it, preserves reference context only for full-history fork, and then appends child guidance.
- `core/src/client.rs`
  - request `prompt_cache_key` defaults to thread id unless explicitly overridden.

## 5. Proposed storage shape

Runtime state belongs under `.jwc/`. Candidate actor registry path:

```text
.jwc/state/sessions/<session-id>/actors.json
```

Candidate record:

```ts
interface WorkflowActorRecord {
  id: string;
  workflow: "pabcd" | "goal" | "team" | "task";
  workflowSessionId: string;
  lane: string; // e.g. "p:planner", "a:architect", "c:reviewer"
  role: "self-fork" | "planner" | "architect" | "critic" | "executor";
  modelId: string;
  provider: string;
  thinkingLevel: string | undefined;
  rolePromptVersion: string;
  sessionFile: string;
  providerCacheSessionId: string;
  forkParentSessionId?: string;
  forkMode?: "full" | "bounded" | "none";
  status: "idle" | "running" | "paused" | "completed" | "failed";
  lastJobId?: string;
  lastUsedAt: string;
  compactedAt?: string;
}
```

The exact type should live in code after implementation planning, not in prompt text.

## 6. Implementation slices

1. Source confirmation and cli-jaw comparison
   - Confirm the existing cli-jaw actor/fork/resume behavior the user referenced.
   - Identify the exact state keys and lifecycle semantics to port or adapt.

2. Actor registry runtime
   - Add a small registry helper for durable actor lookup/create/update.
   - Keep it workflow-state scoped and atomic.
   - Preserve existing detached task APIs.

3. Cache-fork self-clone lane
   - Add an explicit task/subagent mode for self-fork.
   - Force same model/thinking as parent.
   - Append task directive after inherited prefix.
   - Keep provider cache identity stable.

4. PABCD role actor integration
   - P stage: Planner is persisted and resumed for revisions.
   - A stage: Planner/Architect auditors can be durable across audit rounds.
   - C stage: reviewer/verifier can resume within the check loop.
   - Fresh spawn remains possible when actor lane is missing, incompatible, or intentionally reset.

5. Compaction and prewarm
   - Actor-local auto-compact at existing session thresholds.
   - After resume, prewarm provider content for Codex-style transports before the next prompt when possible.

6. Tests and gates
   - Unit tests for actor-key resolution and incompatible-lane fallback.
   - Task tests for initial fresh spawn vs actor resume behavior.
   - Provider-cache tests asserting stable `prompt_cache_key` for cache-fork lanes.
   - PABCD flow tests ensuring repeated planner/architect calls reuse actor records.

## 7. Risks

- Sharing mutable provider websocket state across concurrent actors can race. Prefer stable cache identity first; only share provider transport state if guarded by provider/session locks.
- Role prompt changes can silently poison cache assumptions. Actor keys must include a role prompt version/hash.
- Multi-provider orchestration should not be downgraded just for cache. Cache-fork is an optimization lane, not a universal routing policy.
- Compaction changes the prefix. The first post-compact turn may be cold; subsequent turns use the compacted baseline.

## 8. Acceptance criteria for the future implementation

- Repeated PABCD role calls do not fresh-spawn when a compatible actor record exists.
- Cache-fork self-clone calls cannot accidentally use executor/planner/architect model overrides.
- Provider-facing cache key is stable for compatible cache-fork lanes.
- Incompatible model/thinking/role prompt changes create a new lane instead of corrupting the old one.
- Existing generic detached task behavior remains available and does not regress.
