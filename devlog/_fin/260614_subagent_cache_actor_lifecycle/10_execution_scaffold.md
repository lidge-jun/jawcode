# 10 — Execution scaffold: cache-fork actor + workflow resume

> Status: scaffold. This is not an approved source patch plan yet; it is the working decomposition for the next planning/implementation pass.
> Interview update 2026-06-14: implementation should proceed as a durable overall goal through repeated PABCD cycles per phase, not as one oversized patch. Keep rewriting this devlog as each phase crystallizes.
> First source-patch acceptance: actor registry + hidden PABCD actor routing + repeat-call `runMode` test proving compatible second calls use `message`/resume instead of `initial`, plus PABCD prompt/docs updates so runtime and guidance agree.

## A. Terms

- **Fresh spawn**: create a new subagent job/session and send the assignment as the first prompt.
- **Explicit resume**: user/tool resumes an already registered subagent descriptor by id.
- **Workflow actor resume**: workflow runtime resolves a stable role actor and resumes it automatically.
- **Cache-fork self-clone**: child inherits parent model/thinking/prompt prefix/cache identity and receives the work directive as appended context.
- **Role actor**: Planner/Architect/Critic/Executor style agent with its own durable session lane.

## B. Routing matrix

| Scenario | Desired path | Cache expectation |
|---|---|---|
| Generic independent `task` call | fresh spawn | none unless caller explicitly opts into fork |
| `task` with `inheritContext: full` but different model/thinking | forked context, not cacheable | weak/none |
| Self-clone cache lane | full fork, same model/thinking, append directive | strongest first-call cache affinity |
| PABCD first Planner/Architect/Critic in a lane | create durable actor, preferably full fork if compatible | strong if same model/thinking; otherwise normal role quality path |
| PABCD repeated same lane | resume durable actor | strongest continuity; no repeated cold bootstrap |
| PABCD role model changed | new actor lane | old lane retained, not reused |
| Actor context too large | compact actor session, persist, then resume | first post-compact turn may be cold |

## C. Minimal viable implementation shape

### C1. Actor registry helper

Target files likely:

- `packages/coding-agent/src/jwc-runtime/` new helper or existing orchestrate state module.
- `packages/coding-agent/src/task/index.ts` for task execution integration.
- `packages/coding-agent/src/task/executor.ts` for session creation/resume options.

Responsibilities:

1. Build deterministic actor keys.
2. Resolve compatible existing actor record.
3. Allocate session file/cache identity for new actors.
4. Mark lifecycle transitions: idle/running/paused/completed/failed.
5. Preserve resume descriptor linkage where the existing async manager needs it.

### C2. Cache-fork mode

Potential API shape for internal callers:

```ts
interface ActorSpawnPolicy {
  lifecycle: "fresh" | "resume-compatible" | "cache-fork-self";
  actorKey?: string;
  requireSameModel?: boolean;
  requireSameThinking?: boolean;
}
```

Rules:

- `cache-fork-self` rejects or ignores role model overrides.
- It uses parent active model and thinking level.
- It passes a full fork seed with parent cache identity.
- It appends the task directive after inherited context.

### C3. PABCD integration

P stage:

- Planner actor is created once for the plan draft lane.
- Critic feedback revisions resume the same Planner actor.
- Architect/Critic review lanes may be durable by stage round or by role depending on cli-jaw parity findings.

A stage:

- Planner audit and Architect audit use deterministic audit actor lanes.
- Re-run rounds resume existing compatible audit actors unless reset/incompatible.

C stage:

- Verification/review actor resumes through check reruns while the same plan/code lane remains active.

D stage:

- Summary/reflection actor is optional; no cache requirement unless repeated reflection loops exist.

## D. Compatibility rules

Actor records are compatible only when all required fields match:

- workflow session id;
- actor lane;
- role;
- model id;
- provider/base URL as relevant;
- thinking level;
- role prompt version/hash;
- tool surface compatibility where needed;
- cwd/worktree identity where mutation is allowed.

If compatibility fails, create a new actor record and preserve the old one for auditability.

## E. Compaction policy

Use existing session compaction machinery rather than inventing a separate summary format.

Actor resume flow should:

1. Open actor session file.
2. Inspect context usage when available.
3. If above threshold and idle, compact before sending the next prompt.
4. Persist compaction in the actor session file.
5. Update actor record `compactedAt`.
6. For Codex-style transports, prewarm content after open/compact before prompt when supported.

## F. Verification targets

### Unit

- actor key construction is deterministic;
- same lane/model/thinking returns existing actor;
- changed model/thinking/prompt hash returns new actor;
- self-fork lane refuses role model override;
- actor registry writes are atomic and scoped under the live JWC session.

### Task/subagent

- first actor call creates session file and record;
- second compatible call uses `runMode: resume|message`, not `initial`;
- fresh generic task behavior remains unchanged;
- parent without session file gets a safe durable path or a clear non-resumable fallback.

### Provider/cache

- cache-fork lane sends stable provider cache session id;
- incompatible model lane does not reuse the same provider cache key as a cacheable actor;
- OpenAI Codex request body contains expected `prompt_cache_key`.

### PABCD

- repeated P-stage planner revision resumes the same actor;
- A-stage audit rerun resumes compatible auditor actors;
- actor records survive stage command boundaries;
- reset clears or retires actors according to workflow reset semantics.

## G. Open questions before source patch

1. Exact cli-jaw parity: which actor lanes are already durable there, and what is the storage key?
2. Should PABCD role actors persist across rounds within a stage only, or across the whole orchestration session?
3. Should full-fork cache lane be exposed to the public `task` tool or kept internal until stable?
4. Do we share provider transport state maps for actors, or only share stable `prompt_cache_key` and let transports reconnect independently?
5. What is the role prompt version source: file hash, bundled agent frontmatter version, or build-time hash?

## H. Non-goals for first patch

- Do not remove existing `task` detached job behavior.
- Do not force all role agents onto the parent model.
- Do not promise cache for multi-provider roles.
- Do not rewrite PABCD prompts before the runtime actor lane exists.
- Do not make `.jwc` committed defaults; actor state remains runtime state.
