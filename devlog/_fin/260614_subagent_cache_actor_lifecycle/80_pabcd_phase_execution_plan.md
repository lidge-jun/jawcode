# 80 — PABCD phase execution plan for subagent actor lifecycle

> Status: A-stage cycle 2 audit failed; plan revised to scope the remaining compaction/prewarm and black-box actor-routing work before B-stage.
> Goal: implement the subagent actor lifecycle program through repeated PABCD cycles per phase while keeping this devlog current.
> Source requirements: `00_moc.md`, `10_execution_scaffold.md`, `20_cli_jaw_worker_findings.md`, `30_phase_split.md`, `40_phase1_resume_patch.md`, `50_phase2_fork_patch.md`, `60_pabcd_stage_lifecycle.md`, `70_executor_ext_lane.md`.
> Audit round 1 fixes: `81_a_fail_reports.md` findings are incorporated below.

## 1. Confirmed requirements

- Work proceeds as six PABCD-driven implementation loops, one per phase/slice, rather than one oversized patch.
- Phase topology:
  1. Resume actor registry.
  2. Cache-fork self-clone executor lane.
  3. PABCD wiring.
  4. Compaction/prewarm hardening and black-box TaskTool actor-routing proof.
  5. Public API/model UI cleanup and executor_ext diagnostics.
  6. Final integration/check/done pass across the actor lifecycle program.
- PABCD actor resume is fresh per PABCD cycle/state and resume within state/stage/lane.
- A new PABCD cycle must never select actors from a prior completed/reset cycle.
- Actor namespace and provider prompt-cache key are separate concepts.
- Actor record and AsyncJob/SubagentRecord are separate concepts: job can complete while workflow actor becomes idle/resumable.
- Non-executor role actors are same-lane non-concurrent.
- Default `executor` is a full-coding self-fork/cache lane, not externally model configurable.
- `executor_ext` is an internal policy alias for model-configurable fresh-spawn executor behavior.
- Model UI must remove misleading configurable `EXECUTOR` and expose `EXTERNAL EXECUTOR` / `EXECUTOR_EXT` for the external lane.

## 2. Pre-implementation checklist — cli-jaw/source parity

Before Phase 1 code mutation, update `20_cli_jaw_worker_findings.md` or this plan if source facts changed. The current locked parity facts are:

- cli-jaw employee resume invalidates on `cli` or `model` mismatch.
- cli-jaw uses session buckets/resume keys to avoid cross-model resume errors.
- JWC must use a dedicated `actor_namespace_id`; provider prompt-cache key is not an actor namespace.
- JWC Phase 1 automatic resume is same process/session scoped. Cross-process resume metadata is stored, but no silent restart resume is claimed.

Acceptance:

- A test or fixture verifies old namespace actor records are not selected when a new namespace is active.
- A test or fixture verifies process restart simulation produces no silent auto-resume claim in Phase 1.

## 3. Phase 1 plan — Resume actor registry

### 3.1 Files

MODIFY:
- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts`
  - Add `actor_namespace_id?: string` to `PabcdCtx`, lenient read schema, and the strict write-side schema path used by `RequiredOnWriteNativeEnvelopeSchema`.
  - Preserve existing ctx passthrough.
- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
  - Mint `actor_namespace_id` on new PABCD entry/cycle.
  - Preserve namespace through stage transitions inside the same PABCD cycle.
  - Retire active actors on stage transitions, reset, and complete without deleting historical records.
  - Stage transition hook order: before `persist()` writes a new stage with `fromPhase`, call `retireStageActors(actor_namespace_id, fromPhase)` when `fromPhase` is a real PABCD stage and differs from target.
  - Reset/complete hook order: read current ctx/namespace, call `retireNamespaceActors(actor_namespace_id)`, then unlink or write inactive PABCD state.
- `packages/coding-agent/src/tools/index.ts`
  - Ensure TaskTool has access to `cwd`, `getSessionId`, and current session identity already exposed through `ToolSession`.
- `packages/coding-agent/src/task/index.ts`
  - Read `readPabcdStateWithFallback(cwd, getSessionId())` when PABCD is active.
  - Resolve/allocate workflow actor before choosing `sessionFile` and `runMode`.
  - Mark actor lifecycle around task job start/end.
  - Enforce Phase 1 sole-authority invariant: TaskTool/actor-registry is the only runtime path that selects workflow actor `sessionFile` for PABCD task routing; legacy planphase `planner_subagent_id` metadata must not drive resume selection.
- `packages/coding-agent/src/task/executor.ts`
  - Only if needed: expose a small completion hook/result field so TaskTool can mark actor idle without conflating actor with AsyncJob terminal state.
- `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`
  - Phase 1 minimal stub: remove/qualify unconditional `Fresh spawn` wording for the P critic lane so operators do not follow stale guidance before Phase 3 full prompt alignment.
- `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
  - Phase 1 minimal stub: remove/qualify unconditional `Fresh spawn` wording for A auditor lanes; A starts fresh at A entry but retries resume compatible A lanes.

NEW:
- `packages/coding-agent/src/jwc-runtime/actor-registry.ts`
- `packages/coding-agent/test/jwc-runtime/actor-registry.test.ts`
- `packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts`
- `packages/coding-agent/test/task-workflow-actor-routing.test.ts`

### 3.2 Actor registry storage

PABCD state stores only the active `actor_namespace_id`. Detailed records live in:

```text
.jwc/state/sessions/<session-id>/actors.json
```

Candidate record:

```ts
interface WorkflowActorRecord {
  id: string;
  namespaceId: string;
  workflow: "pabcd" | "goal" | "team" | "task";
  workflowSessionId: string;
  stage: "i" | "p" | "a" | "b" | "c" | "d";
  lane: string;
  roleAgent: "planner" | "architect" | "critic" | "executor" | "verifier" | "self-fork" | "executor_ext";
  modelId: string;
  provider: string;
  thinkingLevel?: string;
  rolePromptHash: string;
  cwdOrWorktree: string;
  writablePolicy: string;
  toolSurfaceHash: string;
  sessionFile: string;
  providerCacheSessionId?: string;
  status: "idle" | "running" | "paused" | "retired" | "failed";
  currentJobId?: string;
  historicalJobIds: string[];
  compactedAt?: string;
  needsCompact?: boolean;
  createdAt: string;
  lastUsedAt: string;
}
```

Required helper operations:

- `readActorRegistry(cwd, sessionId)`
- `writeActorRegistryAtomic(cwd, sessionId, registry)`
- `resolveCompatibleActor(key)` — excludes retired and namespace-mismatched records.
- `allocateActorRecord(key, sessionFile)`
- `markActorRunning(actorId, jobId)`
- `markActorIdle(actorId, sessionFile, jobId)` — job completed, actor remains resumable.
- `markActorPaused(actorId, sessionFile, jobId)`
- `markActorFailed(actorId, reason, jobId)`
- `retireStageActors(namespaceId, stage)`
- `retireNamespaceActors(namespaceId)`
- `buildWorkflowActorLane(input)` — deterministic lane id from PABCD stage, target role, task id, and task description.
- `buildWorkflowActorKey(input)` — conservative compatibility key including namespace, stage/lane, role, model/provider/thinking, prompt hash, cwd/worktree, writable policy, and tool surface.
- `isWorkflowActorSelectable(record, key)` — excludes retired, running, namespace-mismatched, and incompatible records.

### 3.3 Hidden routing

Public `task` schema does not grow in Phase 1. When PABCD is active, TaskTool derives actor routing from:

- `actor_namespace_id`;
- current PABCD phase;
- target role agent;
- task id and description;
- model/provider/thinking/prompt/tool/cwd compatibility.
Phase 1 lane derivation lives in `actor-registry.ts`, not in prompt prose. Required deterministic mapping for initial implementation:

| PABCD stage | Agent | Task shape | Lane |
|---|---|---|---|
| `p` | `critic` | any P review task | `p:critic` |
| `a` | `planner` | audit/planner-lens task | `a:planner-auditor` |
| `a` | `architect` | audit/architect-lens task | `a:architect-auditor` |
| `b` | `architect`/reviewer-like verifier | verification task | `b:verifier` |
| `c` | architect/reviewer-like mechanical check | mechanical/check task | `c:mechanical-check-reviewer` |
| `c` | architect/reviewer-like adversarial review | adversarial/review task | `c:adversarial-reviewer` |
| fallback | any non-executor role | role + normalized task id | `<stage>:<role>:<task-id>` |

For Phase 1, `executor` and `executor_ext` were excluded from automatic resume actor reuse until Phase 2 defined fork/fresh routing. The current cycle-1 runtime has a bare compatible-actor resume path; cycle 2 must upgrade that path with the §6.1 pre-resume maintenance hook before cycle-2 C/D closeout.

First compatible lane call uses `runMode: "initial"`. Later compatible lane calls use existing `sessionFile` and `runMode: "message"` with the new assignment appended only after the actor-local maintenance/openability guard succeeds. Until cycle 2 lands, the bare resume path is scaffold behavior and not final acceptance. Generic detached task behavior outside PABCD remains fresh by default.

TaskTool integration point:

1. Before scheduling a PABCD task, read PABCD state.
1a. PABCD-active predicate: state exists, `active === true`, `current_phase` is not `complete`, and `ctx.actor_namespace_id` is present.
1b. If `getSessionId()` is undefined/null, skip automatic actor resume and run the existing fresh behavior; do not write `.jwc/state/sessions/<session-id>/actors.json` without a session id.
2. Build a conservative actor key.
3. If a compatible idle/paused actor exists, call the cycle-2 `maintainWorkflowActorBeforeResume(actor, actor.sessionFile, options)` hook from §6.1.
3a. If actor session open/restore fails in the current process, return deterministic `context_unavailable`/fresh-policy behavior; do not claim resume.
3b. If maintenance succeeds, pass the actor `sessionFile` into `#executeSync` and set `runMode: "message"`.
4. If no actor exists, allocate one with a deterministic session file path under the parent artifacts/session directory and run `initial`.
5. On completion, update WorkflowActorRecord to `idle`; do not interpret AsyncJob `completed` as actor retirement.

### 3.4 Busy policy

Normative Phase 1 behavior: **deterministic busy error for same-lane non-executor actors**.

- If a compatible Planner/Architect/Critic/verifier actor is `running`, do not open a second session and do not inject a concurrent prompt into that session.
- Return/report a clear `actor_busy` routing error with actor id, lane, and current job id.
- Executor parallelism is handled by Phase 2 separate fork actors, not by concurrent prompts into a single actor.

### 3.5 Process/restart boundary

Phase 1 automatic actor resume is same process/session scoped:

- Actor registry persists cross-process-ready metadata.
- If the process restarts and the in-memory runner/descriptor needed to safely resume is unavailable, do not silently resume.
- Mark/return `context_unavailable` or fall back only when the caller policy explicitly allows fresh spawn.

### 3.6 Acceptance

- Same actor key resolves the same record.
- Changed model/provider/thinking/prompt hash/cwd/tool surface/writable policy creates a new record.
- Changed `actor_namespace_id` prevents selecting old records.
- Stage transition retires old stage actors from compatible lookup while preserving history.
- Reset/complete retires namespace actors.
- Job completion marks actor `idle`, not terminal/deleted.
- Cycle 1: second compatible PABCD task call uses `runMode: "message"` or resume path, not `initial`.
- Cycle 2: second compatible call first passes `maintainWorkflowActorBeforeResume`, proves actor session openability, and then dispatches `runMode: "message"`.
- Cycle 2: simulated process restart/context loss does not silently auto-resume from persisted registry metadata alone.
- Generic detached task remains fresh by default.
- `buildWorkflowActorLane` maps P/A/B/C role tasks to the expected deterministic lanes.
- Missing session id disables hidden actor routing and preserves existing fresh task behavior.
- Strict PABCD write schema accepts `ctx.actor_namespace_id`.
- Orchestrate transition tests prove `retireStageActors` is invoked before/with stage advance and `retireNamespaceActors` is invoked before reset/complete cleanup.
- Task routing tests prove `planner_subagent_id` / plan-writer metadata is never used to choose a workflow actor `sessionFile`.

## 4. Phase 2 plan — Cache-fork self-clone executor lane

### 4.1 Files

MODIFY:
- `packages/coding-agent/src/task/index.ts`
  - Gate self-fork/cache lanes out of existing batch prefreeze behavior.
  - Build fork seeds at the actual actor creation/dispatch moment.
  - Map explicit external executor model/provider intents to `executor_ext`.
- `packages/coding-agent/src/task/types.ts`
  - Add `CacheAffinityMetadata` and `SingleResult.cacheAffinity`.
- `packages/coding-agent/src/task/receipt.ts`
  - Propagate sanitized cache-affinity diagnostics in task receipts/tool details.
- `packages/coding-agent/src/task/executor.ts`
  - Preserve parent model/thinking for self-fork executor lane.
  - Accept appended directive fragment without replacing parent prefix.
- `packages/coding-agent/src/session/agent-session.ts`
  - Use existing `buildForkContextSeed()`; do not reuse old seeds across new actor creations.
- `packages/coding-agent/src/prompts/system/subagent-system-prompt.md` only if append placement requires template support.
- `packages/coding-agent/src/task/model-presets.ts` or adjacent policy helper if mapping explicit executor model overrides to `executor_ext` requires it. Default self-fork executor must ignore configurable executor role targets.

NEW:
- `packages/coding-agent/src/prompts/system/executor-self-fork.md`
- `packages/coding-agent/test/task-executor-self-fork.test.ts`

### 4.2 Runtime shape

Default `executor` becomes a self-fork cache lane:

- parent active model and thinking level are inherited;
- executor model profile override does not affect it;
- fork seed is built at actual actor creation moment;
- new static prompt fragment is appended after inherited parent prefix/snapshot;
- full coding tool surface is available;
- fallback to `executor_ext`/fresh spawn is allowed only when caller policy allows and must be reported as non-cache-affine.

Existing `frozenForkSeeds` batch prebuild in `packages/coding-agent/src/task/index.ts` must not be used for self-fork actor creation. Either:

- keep it only for legacy explicit `inheritContext` task behavior; or
- move self-fork seed creation into the per-actor dispatch path immediately before session creation.
Acceptance must include an explicit test that self-fork/cache executor path never consumes the batch `frozenForkSeeds` map created for legacy explicit `inheritContext`.

### 4.3 Executor parallelism and overlap policy

- Parallel default executor work uses distinct fork actors and distinct session files.
- Multiple executor tasks must not share one actor session concurrently.
- Reuse existing task isolation/non-overlap conventions where available.
- If writable scopes overlap and the caller has not explicitly isolated/serialized them, reject or force serial execution according to existing task safety settings.

### 4.4 Fallback and cache-affinity metadata policy

When cache-fork creation, actor prewarm, or explicit external executor routing cannot preserve parent-cache affinity:

- Extend `SingleResult` and task receipt/details with `cacheAffinity?: { affine: boolean; reason: "self_fork" | "actor_resume" | "executor_ext" | "fork_fallback" | "prewarm_failed" | "not_applicable"; prewarm?: "refresh" | "cold" | "skipped" | "failed" }`.
- Default self-fork creation/resume may report `affine: true` only for `"self_fork"` or `"actor_resume"` intent; this is an intent/diagnostic signal, not a provider cache-hit guarantee.
- `executor_ext`, forced fallback, and injected prewarm failure must report `affine: false`.
- If fallback policy denies fallback, fail closed with a clear cache-fork error.
- If fallback policy allows fallback, run through `executor_ext`/fresh-spawn behavior and mark result metadata/log text as non-cache-affine.
- Never claim parent-cache affinity for fallback execution or for same-provider model reuse alone.

### 4.5 Acceptance

- Fork seed includes parent messages available at fork time.
- A later new fork sees later parent messages.
- Existing actor resume does not rebuild a fork seed.
- Executor override does not change self-fork model.
- Explicit external executor model/provider request routes to `executor_ext`.
- `executor_ext` uses existing model override/model-change path.
- Appended directive appears after inherited content.
- Provider-facing cache id comes from fork seed/cache identity.
- Extend `task-cache-key.test.ts` or add provider-level test proving assertable prompt/cache key behavior, including the locked scaffold assertion that OpenAI Codex request body contains the expected `prompt_cache_key` for cache-fork lanes.
- Forced fork failure tests both allow and deny fallback paths and checks non-cache-affine signaling.
- Parallel executor forks use distinct actor ids/session files and enforce overlap policy.

## 5. Phase 3 plan — PABCD wiring

### 5.1 Files

MODIFY:
- `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-b.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-c.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-d.md` only if D actor lane is introduced.
- `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`
- `packages/coding-agent/src/jwc-runtime/plan-writer.ts`

### 5.2 Stage lane table

| Stage | Lane | Role | Concurrency | Lifecycle |
|---|---|---|---|---|
| P | `p:critic` | critic | non-concurrent | resume within P review loop |
| P | `p:planner` | planner only if P later reintroduces planner actor | non-concurrent | resume within P only |
| P | `p:architect` | architect only if P later adds architecture review | non-concurrent | resume within P only |
| A | `a:planner-auditor` | planner | parallel with architect lane, not with itself | fresh at A entry, resume A retries |
| A | `a:architect-auditor` | architect | parallel with planner lane, not with itself | fresh at A entry, resume A retries |
| B | `b:verifier` | verifier/reviewer | non-concurrent | fresh at B entry, resume verification retries |
| B | `b:executor:<slice>` | executor self-fork | parallel with independent slices | fresh fork per slice, resume same slice only |
| B | `b:executor_ext:<slice>` | executor_ext | parallel fresh-spawn | no parent-cache guarantee |
| C | `c:mechanical-check-reviewer` | reviewer/architect as chosen | non-concurrent | fresh at C entry, resume reruns |
| C | `c:adversarial-reviewer` | reviewer/architect as chosen | non-concurrent | fresh at C entry, resume reruns |
| D | `d:summary` | optional | non-concurrent | fresh if needed |

### 5.3 Prompt sequencing

- Phase 1 may add minimal runtime-aligned wording only where current prompts are actively misleading.
- Phase 1 minimal prompt stub edits are required for currently misleading operator guidance:
  - `orchestrate-p.md`: replace unconditional `Fresh spawn` wording for critic with wording that says Phase 1 runtime may resume compatible P-stage actor lanes; before runtime lands, use normal task spawn.
  - `orchestrate-a.md`: replace unconditional `Fresh spawn` wording for auditors with wording that says A starts fresh lanes at A entry and resumes compatible A retry lanes.
- Full prompt rewrite belongs to Phase 3 after runtime routing exists.
- Remove or qualify `Fresh spawn` language from P/A prompts once runtime hidden actor routing is in place.
- Ensure prompts say stage actors resume only within the same stage/namespace and do not cross PABCD cycles.

### 5.4 plan-writer interaction

`packages/coding-agent/src/jwc-runtime/plan-writer.ts` may keep planner subagent metadata for audit traceability, but the actor registry is the sole workflow actor resume owner.

- `planner_subagent_id` is audit metadata only and must not select or imply a workflow actor `sessionFile`.
- `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md` operator guidance must not teach resume-by-planner-id once actor registry routing owns P-stage actor reuse.
- Tests must prove TaskTool routing ignores `planner_subagent_id`/planphase metadata when selecting actor sessions.

Do not create two independent resume owners for the same lane.

### 5.5 Acceptance

- Prompt text no longer says fresh spawn where runtime expects resume.
- P→A never selects P actors.
- A retry resumes A auditor actors and never selects P actors.
- B verifier retry resumes B verifier and never selects A actors.
- C rerun/review retry resumes C lanes.
- C→B/P/I routing retires C lookup before target stage starts.
- reset/complete retires active actor lookup.
- plan-writer planner metadata cannot conflict with actor registry ownership.
- Add a mechanical prompt test or fixture grep that fails if `orchestrate-p.md` or `orchestrate-a.md` still instructs unconditional `Fresh spawn` after runtime actor routing lands.

## 6. Phase 4 plan — Compaction/prewarm and black-box actor routing

### 6.1 Files and concrete implementation tasks

MODIFY:
- `packages/coding-agent/src/jwc-runtime/actor-registry.ts`
  - Keep `needsCompact` and `compactedAt` as actor-local metadata; do not treat them as namespace or stage lifecycle markers.
  - Add an atomic helper such as `markActorMaintained(registry, actorId, { compactedAt, needsCompact })` if B-stage code needs a named update primitive.
- `packages/coding-agent/src/task/index.ts`
  1. Add `maintainWorkflowActorBeforeResume(actor, sessionFile, options)` and call it after `resolveCompatibleActor()` returns an idle/paused actor and before `actorRunMode`/`actorResumeMessage` are used to dispatch `runMode: "message"`.
  2. Actor maintenance opens/restores an actor-scoped session by `actor.sessionFile` using a narrowly-scoped SessionManager/AgentSession restoration helper; it must never compact/prewarm the parent tool session.
  3. If `actor.needsCompact === true`, run actor-local compaction through the existing `AgentSession.compact()` path, update `compactedAt`, clear `needsCompact`, and continue with the same actor `sessionFile`.
  4. Threshold-triggered compaction is explicit and conservative for cycle 2: only `needsCompact === true` forces compaction; token-threshold auto-detection may be added only if it uses existing compaction settings and has a focused test.
  5. After successful actor maintenance, call existing Codex prewarm behavior (`prewarmCodexContent()` through the actor-scoped `AgentSession`/agent) best-effort; catch failures, continue resume, and annotate cache-affinity metadata as prewarm failed.
  6. Before resume, verify the current process can safely open the actor `sessionFile`. If it cannot, return a deterministic `context_unavailable`/fresh-policy result instead of silently claiming actor resume.
  7. Add task result/receipt metadata using the `cacheAffinity` shape in §4.4.
- `packages/coding-agent/src/task/types.ts`
  - Define the shared `CacheAffinityMetadata` type from §4.4 and add `cacheAffinity?: CacheAffinityMetadata` to `SingleResult`.
- `packages/coding-agent/src/task/receipt.ts`
  - Include sanitized cache-affinity metadata in receipts/tool details without changing the public task schema.
- `packages/coding-agent/src/task/executor.ts`
  - Preserve/pass through `cacheAffinity` result metadata so TaskTool receipts can report self-fork, `executor_ext`, fallback, and prewarm failure state.
- `packages/coding-agent/src/session/agent-session.ts`
  - Reuse existing `AgentSession.compact()` and Codex `prewarmCodexContent()` behavior; do not duplicate provider logic.
- `packages/coding-agent/src/prompts/jaw/orchestrate-b.md`
- `packages/coding-agent/src/prompts/jaw/orchestrate-c.md`
  - Align B/C prompt wording with runtime actor routing: compatible lanes resume only inside the same stage/namespace; stage transitions retire lookup.
- `packages/coding-agent/src/jwc-runtime/plan-writer.ts`
- `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md`
  - Document planphase subagent ids as audit metadata only; actor registry remains the sole `sessionFile` resume owner.

NEW/UPDATE TESTS:
- `packages/coding-agent/test/task-workflow-actor-routing.test.ts`
  - Given a PABCD fixture with `actor_namespace_id`, first compatible TaskTool dispatch allocates actor/session.
  - Second compatible dispatch uses the same `sessionFile`, sets `runMode: "message"`, appends the new assignment, and does not rebuild a fork seed.
  - `planner_subagent_id` / plan-writer metadata cannot choose actor `sessionFile`.
  - Persisted `actors.json` without an openable/current-process actor session produces deterministic `context_unavailable`/fresh-policy behavior, not silent safe resume.
  - Injected prewarm failure lets resume continue and reports `cacheAffinity.affine === false` with `reason: "prewarm_failed"`.
- `packages/coding-agent/test/task-executor-self-fork.test.ts`
  - Default `executor` ignores configurable executor model override, builds fork seed at actor creation time, and reuses compatible actor without rebuilding the seed.
  - `executor_ext` uses fresh/model-configurable executor behavior and reports `cacheAffinity.affine === false` with `reason: "executor_ext"`.
- `packages/coding-agent/test/task-cache-key.test.ts`
  - Add provider-level cache assertion only when the hook exposes a stable `prompt_cache_key`/provider cache identity for self-fork lanes.
- `packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts`
  - Extend existing stage/namespace retirement coverage for C→B/P/I reroutes; this supersedes the older planned `orchestrate-actor-retirement.test.ts` filename.

### 6.2 Runtime shape

- Actor-local compaction runs only on the selected actor's session file; parent session compaction must not rewrite existing actor histories.
- New executor self-forks after parent compaction snapshot the parent at the new post-compact state; existing actor resumes maintain their own actor-local history.
- Provider prewarm is best-effort and must not be confused with conversation resume or a guaranteed prompt-cache hit.
- Prewarm failure leaves actor resume intact and reports non-cache-affine diagnostics.
- `executor_ext` is intentionally fresh-spawn/model-configurable and bypasses actor resume/cache-fork unless a future explicit policy changes it.
- Same-provider model selection alone is never a cache-affinity guarantee.

### 6.3 Mechanical acceptance and test mapping

| Acceptance | Test / check |
|---|---|
| Actor-local compaction updates `WorkflowActorRecord.compactedAt` and clears `needsCompact`. | `task-workflow-actor-routing.test.ts` maintenance case or `actor-registry.test.ts` helper case. |
| Resume after compaction uses the compacted actor session file and then appends the new assignment in `runMode: "message"`. | `task-workflow-actor-routing.test.ts` two-dispatch case. |
| Injected prewarm failure lets resume continue without throwing. | `task-workflow-actor-routing.test.ts` prewarm failure case. |
| Prewarm failure, fallback, and `executor_ext` report `cacheAffinity.affine === false`. | `task-executor-self-fork.test.ts` and workflow routing prewarm failure case. |
| Persisted actor metadata alone does not silently claim safe resume after restart/context loss. | `task-workflow-actor-routing.test.ts` context-unavailable case. |
| B/C prompts no longer contain unconditional fresh-spawn guidance for runtime-owned lanes. | Prompt fixture/search assertion or `default-jwc-definitions.test.ts` extension. |
| plan-writer metadata cannot compete with actor registry ownership for `sessionFile`. | `task-workflow-actor-routing.test.ts` metadata-isolation case. |

Consolidated TaskTool double-dispatch AC:
- Given active PABCD state with an `actor_namespace_id` and no compatible actor, first dispatch creates one actor and one `sessionFile`.
- When the same lane is dispatched again with a compatible key, the runtime runs `maintainWorkflowActorBeforeResume`, does not rebuild the executor fork seed, and dispatches the new assignment with the same `sessionFile` and `runMode: "message"`.
- Then `planner_subagent_id` or other planphase metadata has no effect on the selected `sessionFile`, and a non-openable actor session returns `context_unavailable`/fresh-policy behavior instead of silently resuming.
## 7. Phase 5 plan — Public API/model UI cleanup

### 7.1 Pre-step: exact symbol discovery

Before UI implementation, locate exact model selector/profile files and update this section with concrete paths. Candidate areas based on current repo structure:

- model selector components under `packages/coding-agent/src/modes/components/`;
- task model preset helpers under `packages/coding-agent/src/task/model-presets.ts`;
- model resolver/profile settings under `packages/coding-agent/src/config/`.

Do not edit protected TUI visual files unless exact symbols require it and the change is not aesthetic.

### 7.2 Semantics

- Remove misleading configurable `EXECUTOR` badge for default self-fork executor.
- Add `EXTERNAL EXECUTOR` / `EXECUTOR_EXT` surface for the model-configurable fresh-spawn executor lane.
- Explicit user request for a different executor model/provider routes to `executor_ext`.
- `executor_ext` starts as an internal policy alias, not a fifth public bundled role agent.
- Phase 2 routing rule: default self-fork `executor` ignores configurable executor role targets; explicit external model/provider intent maps to `executor_ext`.

### 7.3 Acceptance

- Model selector no longer implies default executor model can be changed.
- External executor model override uses existing model-change/model-override logic.
- No `packages/coding-agent/src/prompts/agents/executor_ext.md` is added.
- Bundled role-agent count remains four; `verify-g002-gates.ts` and `default-jwc-definitions.test.ts` remain green.

## 8. Phase 6 plan — Final integration/check/done pass

### 8.1 Files

MODIFY:
- Devlog status files in this folder.
- Changelog only if user requests release-facing notes.

### 8.2 Verification

Existing focused gates that can run before cycle-2 B creates new test files:

```bash
bun test packages/coding-agent/test/jwc-runtime/actor-registry.test.ts
bun test packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts
bun test packages/coding-agent/test/task-cache-key.test.ts
bun test packages/coding-agent/test/task-fork-context.test.ts
bun test packages/coding-agent/test/model-selector-role-badge-thinking.test.ts
bun test packages/coding-agent/test/model-selector-profiles.test.ts
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
```

Cycle-2 B-stage deliverable tests (post-B; these commands become mandatory once the files are created in B-stage):

```bash
bun test packages/coding-agent/test/task-workflow-actor-routing.test.ts
bun test packages/coding-agent/test/task-executor-self-fork.test.ts
```

Use narrower exact tests when implementation files differ, but C-stage cannot claim cycle-2 completion until the new B-stage deliverable tests exist and pass.

## 9. Risk controls

- Do not touch unrelated dirty files.
- Do not rewrite protected TUI visuals/scroll behavior.
- Do not add public fifth role agent in Phase 1/2.
- Do not claim prompt-cache hit from same provider alone.
- Do not reuse stale fork seeds.
- Do not allow one actor session to receive concurrent prompts.
- Do not silently resume across PABCD cycle boundaries.
- Do not silently resume after process restart in Phase 1.
- Do not let plan-writer legacy metadata become a competing actor registry.

## 10. HOTL checkpoint

This revised plan is ready for A-stage delta audit. Evidence phrase after A PASS remains `plan finalized`.

## 11. B-stage implementation checkpoint — Phase 1/2/3/5 scaffold

Status: B-stage implementation in progress with the first integrated actor-lifecycle slice landed.

Implemented evidence:
- `packages/coding-agent/src/jwc-runtime/actor-registry.ts` adds workflow actor keys, deterministic P/A/B/C lanes, same-lane busy detection, idle/paused/failed lifecycle updates, and stage/namespace retirement helpers.
- `packages/coding-agent/src/jwc-runtime/orchestrate-state.ts` and `packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts` persist `ctx.actor_namespace_id`, preserve it across in-cycle stage transitions, and retire actors on stage transition/reset/complete.
- `packages/coding-agent/src/task/index.ts` adds hidden PABCD actor routing for non-executor lanes, same-lane busy behavior, actor lifecycle updates around subprocess completion, default executor self-fork seed creation at dispatch time, and `executor_ext` alias dispatch through the existing executor agent definition.
- `packages/coding-agent/src/prompts/jaw/orchestrate-p.md` and `packages/coding-agent/src/prompts/jaw/orchestrate-a.md` no longer instruct unconditional fresh spawn for lanes now owned by runtime actor routing.
- `packages/coding-agent/src/config/model-registry.ts` and `packages/coding-agent/src/modes/components/model-selector.ts` expose `EXECUTOR_EXT` / External Executor as the model-configurable selector target while default `executor` ignores role override settings.

Verification evidence:
- `bun --cwd=packages/coding-agent run check:types`
- `bun test packages/coding-agent/test/jwc-runtime/actor-registry.test.ts packages/coding-agent/test/jwc-runtime/orchestrate-actor-lifecycle.test.ts packages/coding-agent/test/task-fork-context.test.ts packages/coding-agent/test/model-selector-role-badge-thinking.test.ts packages/coding-agent/test/model-selector-profiles.test.ts packages/coding-agent/test/default-jwc-definitions.test.ts`
- `bun scripts/check-visible-definitions.ts`
- `bun scripts/verify-g002-gates.ts`
- `bun scripts/rebrand-inventory.ts --strict`

Open follow-up before cycle-2 C/D:
- OPEN: add black-box TaskTool actor-routing coverage for full PABCD actor dispatch and resume path (`§12.2` item 1).
- OPEN: implement actor-local maintenance/prewarm and cache-affinity diagnostics (`§12.2` item 2).
- OPEN: align B/C prompt wording and plan-skill planphase metadata guidance (`§12.2` items 3–4).
- DECIDED: legacy model-profile `executor` mappings remain compatibility input; visible model-configurable lane is `executor_ext`, while default `executor` remains self-fork/model-inherited.

Cycle-2 open/closed checklist:
- CLOSED: actor registry, namespace persistence, stage/namespace retirement, P/A prompt alignment, default executor self-fork scaffold, and `executor_ext` model-selector surface.
- OPEN: TaskTool black-box actor resume tests, actor-local maintenance/prewarm hook, `cacheAffinity` result/receipt metadata, `context_unavailable` restart guard, B/C prompt alignment, and plan-skill metadata guidance.

## 12. Cycle 2 revised scope after A-stage FAIL

### 12.1 Audit findings mapped to work

| Finding source | Work item | Verification |
|---|---|---|
| `87_a_cycle2_planner_fail.md` blocker: no cycle-2 checklist | This section defines the cycle-2 scope and exit criteria. | A-stage delta audit must reference this section. |
| `87_a_cycle2_planner_fail.md` / `88_a_cycle2_architect_fail.md`: missing test file mismatch | `§8.2` now names actual existing tests plus the new black-box tests this cycle owns. | B/C must run the updated command list or narrower exact equivalent. |
| `88_a_cycle2_architect_fail.md`: no named compaction/prewarm hook | `§6.1` names the TaskTool resume hook before `runMode: "message"` dispatch and reuses `AgentSession` compaction/prewarm APIs. | Focused TaskTool test with injected prewarm failure. |
| `87_a_cycle2_planner_fail.md`: cache-affinity metadata missing | B-stage adds task receipt/result metadata for self-fork, `executor_ext`, and fallback/prewarm failure diagnostics. | `task-executor-self-fork.test.ts` or `task-workflow-actor-routing.test.ts`. |
| `87_a_cycle2_planner_fail.md`: profile migration undecided | Decision: legacy model-profile `executor` mappings remain compatibility input; visible selector target is `executor_ext`, and default `executor` remains self-fork/model-inherited. No automatic migration in cycle 2 unless an existing activation path misroutes. | Model selector/profile tests stay green and add assertion only if activation code is touched. |
| `87_a_cycle2_planner_fail.md`: `planner_subagent_id` ownership unresolved | Decision: `planner_subagent_id` is audit metadata only; actor registry is sole workflow actor resume owner. | Black-box TaskTool test asserts metadata cannot choose `sessionFile`. |
| `88_a_cycle2_architect_fail.md`: B/C prompts still stale | Update `orchestrate-b.md` and `orchestrate-c.md` to describe stage/namespace actor routing and retry semantics. | Prompt fixture/search test or exact focused assertion in existing default-definition tests. |

### 12.2 Cycle 2 deliverables

1. Implement black-box TaskTool actor-routing coverage for PABCD-compatible lane creation and resume.
2. Implement or wire actor-local pre-resume maintenance metadata: `needsCompact`, `compactedAt`, prewarm failure survival, and cache-affinity diagnostics.
3. Align B/C orchestration prompts with the runtime actor lifecycle.
4. Lock `planner_subagent_id` as non-authoritative for actor resume.
5. Keep default `executor` self-fork/model-inherited; keep `executor_ext` model-configurable and fresh/non-cache-affine.
6. Update this devlog with B/C evidence before closing the cycle.

### 12.3 Cycle 2 exit criteria

- Delta A audit returns PASS for planner and architect lenses.
- Focused tests cover black-box TaskTool actor resume, self-fork metadata, and cache/prewarm failure behavior.
- `bun run check` or the explicitly justified affected gate set is green.
- C-stage adversarial review confirms the cycle does not claim full provider cache-hit guarantees from same-provider model reuse alone.
