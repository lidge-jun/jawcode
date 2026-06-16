# 50 — Phase 2: cache-fork self-clone patch

> Status: planned scaffold.
> Goal: add an explicit self-clone fork lane that maximizes prompt-cache affinity without corrupting role-agent routing.
> Interview update 2026-06-14: cache-fork failure may fall back to `executor_ext`/fresh-spawn behavior when the caller policy allows it, but the fallback must be explicit and must not claim parent-cache affinity.
> Interview update 2026-06-14: `executor` self-fork should use a purpose-built appended directive for investigation + implementation work. It must be injected after the inherited parent prefix/snapshot, must preserve read-first/source-grounded behavior, and must not replace the parent system prompt. Exact "read command"/injection mechanics remain a follow-up implementation detail.
> Interview update 2026-06-14: resolve the "read command" ambiguity as a new static prompt fragment, not a public slash command/tool. Add an `executor-self-fork` style prompt fragment that is appended at fork creation and instructs the child to investigate with read/search/find/ast/lsp before editing.
> Interview update 2026-06-14: self-fork `executor` uses the full coding executor tool surface, including read/search/find/ast/lsp plus edit/write/bash verification tools as allowed by normal task safety rules.

## 1. Scope

Phase 2 implements cache-fork actor creation. It depends on the Phase 1 actor registry only for lifecycle bookkeeping, but it has a separate correctness contract.

Targets:

- parent `buildForkContextSeed()` call site;
- subagent session creation path;
- actor policy for self-clone executor/cache lane;
- tests proving fork seed freshness and model/thinking inheritance.

Non-targets:

- changing generic role-agent model presets;
- promising cache for multi-provider role agents;
- reusing fork seeds across actor creations;
- cross-stage actor reuse.

## 2. Non-negotiable fork-time snapshot rule

A new fork must call `buildForkContextSeed()` **at the actual fork dispatch moment**.

Reason:

- The parent prompt prefix, append-only snapshot, messages, tool outputs, compaction state, and cache identity may have changed since planning/scheduling.
- Reusing an earlier seed is a stale fork and can inject wrong context or miss cacheable prefix alignment.

Therefore:

- Do not prebuild fork seeds during batch planning for future cache-fork actors.
- Do not store `ForkContextSeed` as a reusable actor template.
- Do not carry a fork seed across PABCD stage transitions.
- Store only the resulting actor session identity after the forked actor exists.

Allowed:

- Build one seed immediately before creating the forked actor.
- Resume that actor later via its session file, not by re-forking from the old seed.

## 3. Self-clone cache lane contract

The cache-fork child is the parent agent cloned for a delegated task.

Rules:

- Child model = parent active model.
- Child thinking level = parent active thinking level.
- Role model overrides are ignored/rejected for this lane.
- System prompt prefix must remain parent-compatible.
- Task directive is appended after inherited context.
- Provider cache identity is inherited from the parent/fork seed.
- The fork is created fresh per actor creation; later same-lane work resumes the created actor.

This is why the lane is not equivalent to `executor` model preset routing.

## 4. Prompt append shape

Bad:

```text
[new subagent system prompt]
[parent messages]
```

Good:

```text
[parent system/developer prefix]
[parent conversation snapshot]
--- appended directive ---
[delegated task / role boundary / output contract]
```

The appended directive may say that the child is operating as a delegated self-clone executor, but it must not replace the prefix that provider caching depends on.

## 5. Actor interaction

### New cache-fork actor

1. Resolve actor key for self-fork lane.
2. If no compatible actor exists, build fork seed at that moment.
3. Create child session with parent model/thinking and inherited cache identity.
4. Append directive/task.
5. Persist actor record with resulting session file/cache identity.

### Existing compatible cache-fork actor

1. Do not fork again.
2. Resume existing actor session.
3. Send next task as appended message.

### Explicit reset/new stage

1. Retire old actor lane.
2. When a new actor is needed, build a new fork seed at that new moment.

## 6. Tests

Fork seed freshness:

- Parent receives message A.
- Build actor fork and assert seed contains A.
- Parent receives message B.
- Create another fresh fork lane and assert seed contains A+B, proving fork-time rebuild.
- Existing actor resume must not rebuild from stale or fresh seed; it resumes its own session.

Model/thinking inheritance:

- Parent model/thinking set to X.
- Executor override set to Y.
- Cache-fork actor uses X, not Y.

Prompt append:

- Forked child retains inherited messages.
- Directive appears after inherited content, not before/replacing parent system prefix.

Provider cache identity:

- Forked actor provider cache id equals fork seed cache identity.
- Fresh incompatible lane gets a new actor record.

## 7. Failure behavior

- If parent cannot build a fork seed, fail the cache-fork actor creation loudly or fall back only when caller policy explicitly permits fresh spawn.
- If requested model override conflicts with self-fork policy, reject as incompatible rather than silently weakening cache semantics.
- If prompt hash changes mid-stage, create a new actor lane.

## 8. Verification candidates

```bash
bun test packages/coding-agent/test/*fork*.test.ts
bun test packages/coding-agent/test/task*.test.ts
bun test packages/coding-agent/test/agent-session*.test.ts
bun x biome check packages/coding-agent/src/session packages/coding-agent/src/task
```

Exact test names should be narrowed after implementation files are chosen.
