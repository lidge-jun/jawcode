# 20 — cli-jaw worker lifecycle findings

> Status: read-only source comparison against `/Users/jun/Developer/new/700_projects/cli-jaw`.
> Purpose: capture the worker/session mechanics that should inform JWC cache-fork + PABCD actor design.

## 1. cli-jaw worker lifecycle facts

### 1.1 Worker registry is session-runtime scoped, not durable storage

Source: `cli-jaw/src/orchestrator/worker-registry.ts`.

- `workers` and `previousRuns` are in-memory `Map`s.
- `claimWorker()` rejects concurrent duplicate dispatch for the same employee id.
- `finishWorker()` marks a slot `done`, stores result/tools, and sets `pendingReplay`.
- `markWorkerReplayed()` clears completed slots after replay.

Implication for JWC:

- This is a good model for live ownership/progress/replay.
- It is not enough for cross-process durable PABCD actors.
- JWC actor registry should persist under `.jwc/state/sessions/<session-id>/...`, while retaining an in-memory live slot layer for active runs.

### 1.2 Employees resume by employee id + cli + model

Source: `cli-jaw/src/orchestrator/distribute.ts`.

- `runSingleAgent()` loads `employee_sessions` by `employee_id`.
- It clears stale records when the employee `cli` or `model` changes.
- It resumes only if:
  - employee is not virtual;
  - CLI supports session persistence;
  - prior session id exists;
  - stored `cli` equals current `cli`;
  - stored `model` equals current model.
- It calls `spawnAgent(..., { forceNew: !canResume, employeeSessionId })`.
- On success, it writes the returned `sessionId` back with `upsertEmployeeSession`.

Implication for JWC:

- The compatibility key is intentionally small and strict: actor identity + CLI/provider lane + model lane.
- JWC should extend this with thinking level, role prompt hash, stage/lane, cwd/worktree, and tool surface compatibility.

### 1.3 Main session resume uses buckets and frozen prompt snapshots

Sources:

- `cli-jaw/src/agent/spawn.ts`
- `cli-jaw/src/agent/session-persistence.ts`
- `cli-jaw/src/core/db.ts`

Findings:

- Main sessions use `session_buckets`, not one global session id.
- Buckets separate incompatible lanes, e.g. `codex-spark` vs normal `codex`.
- `resolveSessionBucket()` exists specifically to avoid cross-model resume errors.
- `spawn.ts` stores a frozen `memory_snapshot` on fresh spawn and reuses it on resume so the system prompt prefix stays byte-identical for prompt-cache hits.
- The frozen snapshot is regenerated on fresh spawn / compact / model change / stale TTL.

Implication for JWC:

- This directly supports the proposed JWC actor-lane registry.
- Role actor records should store a stable provider cache/session id and a stable prompt-prefix digest/snapshot.
- Changing model/thinking/prompt hash should create a new lane rather than reusing the old actor.

### 1.4 CLI-specific resume arg builder is explicit

Source: `cli-jaw/src/agent/args.ts`.

Examples:

- Claude: `--resume <sessionId>` plus `--append-system-prompt`.
- Codex: `exec resume ... <sessionId> <prompt> --json`.
- Gemini: `--resume <sessionId>`.
- Grok: `--resume <sessionId>`.
- OpenCode: `run -s <sessionId>`.

Implication for JWC:

- JWC does not need CLI-specific args, but it needs the same explicit lifecycle split:
  - fresh session creation;
  - resume existing compatible actor;
  - incompatible lane starts fresh.

### 1.5 Prompt injection is append-like, not prefix replacement

Source: `cli-jaw/src/prompt/builder.ts` and `cli-jaw/src/orchestrator/distribute.ts`.

- Employee system prompt is built once per role/phase cache key.
- Task/workspace/phase content is sent as task prompt body.
- Resume calls keep the employee session and send the next task prompt into the existing thread.
- Main prompt snapshot freezing preserves stable prefix across resumes.

Implication for JWC:

- For cache-fork self-clone, role/task guidance must be appended after inherited parent context.
- Replacing the system prompt prefix for the child defeats the cache lane.

## 2. Refined JWC design from cli-jaw comparison

### 2.1 Executor/self-fork lane

- Add a self-fork executor lane that clones the caller.
- It is not configurable through executor model presets.
- It always uses the parent model and thinking level.
- It appends task instructions after inherited context.
- It is the cache-optimized delegation path.

### 2.2 PABCD stage role lanes

Stage lifecycle should be session-scoped, not globally persistent:

- P stage:
  - Planner/critic revision loop should resume within P.
  - Auto compaction can happen inside that actor session.
  - Leaving P retires or freezes P actors.
- A stage:
  - Starts fresh actor lanes because the stage task is different.
  - Within A, audit retries/gate rounds resume their A-stage actors.
- B/C stages:
  - Build verifier/check reviewers get their own stage lanes.
  - Gate retries within the same stage resume compatible actors.
- D stage:
  - Optional summary actor; no strong cache requirement.

This matches the user's intended model: **fresh per PABCD state, resume within that state/gate lane**.

### 2.3 Multi-provider orchestration rule

- Multi-provider role agents remain valuable.
- They should be durable/resumable within their lane, but not treated as cache-compatible with the parent self-fork lane.
- Same provider is insufficient; compatibility requires same model id, thinking, prompt prefix, and cache key.

## 3. Implementation consequences

JWC needs two layers:

1. Live slot layer, analogous to cli-jaw `worker-registry.ts`:
   - prevents duplicate actor runs;
   - tracks live progress;
   - stores pending results/replay metadata.
2. Durable actor registry:
   - stored under `.jwc/state/sessions/<session-id>/`;
   - maps workflow stage/lane/role/model/thinking/prompt hash to session file/cache identity;
   - survives command boundaries inside the same JWC session.

The durable registry is the part cli-jaw intentionally does not fully solve because its worker registry is server-session memory.

## 4. Design answer

Yes, the target design is feasible:

- executor/self-fork: self clone, model-setting independent, cache-oriented;
- other role agents: stage-scoped durable resume actors;
- P resumes through its planning loop with auto compaction;
- A starts fresh lanes, then resumes within A gate/audit retries;
- B/C similarly fresh per state, resume within state/gate;
- prompt injection should be append-style after the stable inherited prefix.
## 5. Follow-up namespace finding (2026-06-14)

User requested a second check against cli-jaw and web/API cache semantics before locking the JWC actor namespace.

Findings:
- cli-jaw resumes employees through `employee_sessions` keyed by `employee_id`, and invalidates the stored session when `cli` or `model` changes.
- cli-jaw also has `session_buckets(bucket, session_id, model, resume_key)` to prevent cross-model resume errors when the main CLI/model family changes.
- Web/API cache semantics reinforce that a prompt cache key is not a conversation/resume id. Conversation/thread/session identity and prompt-cache routing identity should remain separate.
- Therefore JWC should use a dedicated `pabcd_run_id` / actor namespace for compatibility lookup, and store provider/session/cache identifiers as separate actor-record fields.

Design consequence:
- `actor_namespace_id` decides whether an actor is selectable for the current PABCD cycle.
- `sessionFile` / provider conversation state decides what can be resumed.
- `providerCacheSessionId` / prompt cache key is cache optimization metadata and must not be treated as the actor namespace by itself.
