# 40 — Phase 1: resume actor registry patch

> Status: planned scaffold.
> Goal: make repeated workflow role calls resume compatible actor sessions instead of fresh-spawning by default.
> Interview update 2026-06-14: Phase 1 actor compatibility key is conservative/full-scope. Include workflow session, stage, lane, role, model, provider, thinking level, role prompt hash, cwd/worktree, writable policy, and tool-surface hash in the MVP key rather than deferring safety fields.
> Follow-up check 2026-06-14: choose a dedicated `pabcd_run_id` / `actor_namespace_id` for actor lookup. Do not reuse `prompt_cache_key` as the namespace; provider cache identity and resume/session identity are separate fields.
> Interview update 2026-06-14: same-lane workflow role actors are non-concurrent. If a compatible non-executor role actor is running, do not open a second session for that lane; queue/retry/explicitly report busy according to the workflow caller. Executor parallelism is handled by fork lanes in Phase 2, not by concurrent resume of one role actor.
> Interview update 2026-06-14: Phase 1 only prepares compaction/prewarm hooks and metadata (`needsCompact`, `compactedAt`, cache/prewarm fields as needed). Actual automatic compaction/prewarm behavior belongs to Phase 4.
> Interview update 2026-06-14: Phase 1 automatic actor resume is session/process scoped. Persist cross-process-ready metadata, but after process restart do not silently claim full durable actor continuity until a later phase explicitly rebuilds/validates the runner/session resume path.
> Interview update 2026-06-14: hidden actor routing is automatic. Public `task` schema does not grow in Phase 1; when PABCD is active, TaskTool derives the actor lane from active PABCD state, target role agent, task id, and task description.
> Interview update 2026-06-14: store only the active actor namespace/run id in PABCD state. Store detailed actor records in `.jwc/state/sessions/<session-id>/actors.json`.

## 1. Scope

Phase 1 implements durable actor lookup/resume only. It does **not** implement cache-fork self-clone.

Targets:

- PABCD stage/gate role actors.
- Existing `task` subagent session files and resume runner.
- Actor registry state under `.jwc/state/sessions/<session-id>/`.

Non-targets:

- public `task` schema expansion;
- provider transport-state sharing;
- self-fork cache lane;
- cross-stage actor reuse.

## 2. Actor key

A compatible actor key should include at least:

```ts
workflowSessionId
workflow = "pabcd"
stage = "p" | "a" | "b" | "c" | "d"
lane = string // e.g. "planner", "critic", "audit:architect", "check:reviewer"
roleAgent = "planner" | "architect" | "critic" | "executor"
modelId
provider
thinkingLevel
rolePromptHash
cwdOrWorktree
writablePolicy
toolSurfaceHash
```

If any compatibility field changes, create a new actor lane.

## 3. Storage

Candidate file:

```text
.jwc/state/sessions/<session-id>/actors.json
```

Candidate operations:

- `readActorRegistry(sessionId)`
- `resolveCompatibleActor(key)`
- `allocateActorRecord(key)`
- `markActorRunning(actorId, jobId)`
- `markActorIdle(actorId, sessionFile, cacheIdentity)`
- `markActorFailed(actorId, reason)`
- `retireStageActors(stage)`

Writes must be atomic and scoped to the live JWC session.

## 4. Runtime behavior

### First call in a lane

1. Build actor key.
2. No compatible actor exists.
3. Allocate actor session file and cache identity.
4. Run subagent as `initial` for now.
5. Persist returned session file / cache identity / prompt hash.

### Repeated call in same compatible lane

1. Build actor key.
2. Find compatible actor.
3. Run subagent with existing `sessionFile`.
4. Use `runMode: "message"` when supplying a new task body, or `runMode: "resume"` for continue-only.
5. Do not build a new fork seed in this phase.

## 5. PABCD rules for Phase 1

- P: planner revisions and critic review loops can reuse P-stage actors.
- A: audit retry rounds reuse A-stage auditor actors.
- B: verifier retries reuse B-stage verifier actors.
- C: checker/reviewer retries reuse C-stage actors.
- Stage transition retires previous stage actor lanes from active lookup. Their records remain auditable but not compatible for the next stage.

## 6. Tests

Unit:

- same key resolves same actor;
- model change creates new actor;
- thinking change creates new actor;
- prompt hash change creates new actor;
- stage change creates new actor;
- retired stage actor is not selected.

Task runtime:

- initial actor call uses `runMode: initial`;
- second compatible actor call uses existing `sessionFile` and `runMode: message|resume`;
- generic detached task remains fresh by default.

PABCD:

- P-stage revision loop reuses planner actor;
- A-stage audit retry reuses auditor actor;
- advancing P→A does not reuse P actors.

## 7. Verification commands

Focused candidates after implementation:

```bash
bun test packages/coding-agent/test/task*.test.ts
bun test packages/coding-agent/test/jwc-runtime/*orchestrate*.test.ts
bun x biome check packages/coding-agent/src/task packages/coding-agent/src/jwc-runtime
```

Use narrower exact tests once files exist.
