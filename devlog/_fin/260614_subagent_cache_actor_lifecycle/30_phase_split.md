# 30 — Phase split: resume patch vs fork patch

> Status: scaffold.
> Decision: split the implementation into independent resume and fork slices. Do not mix them into one risky lifecycle rewrite.
> Interview update 2026-06-14: user confirmed this 5-phase topology as the working structure for the subagent actor lifecycle plan.

## 1. Why split

The lifecycle problem has two different axes:

1. **Resume patch** — repeated calls inside a workflow state/gate should reopen the same compatible actor session.
2. **Fork patch** — a new cache-sensitive actor should be created from a fresh parent snapshot at the actual fork moment.

Mixing them would hide two failure modes:

- resume bugs: wrong actor reused, stale stage state, wrong model/thinking lane;
- fork bugs: stale parent snapshot, replaced prompt prefix, cache identity mismatch.

## 2. Phase order

| Phase | Name | Goal | Source mutation scope |
|---|---|---|---|
| 1 | Resume actor registry | Stage/gate-compatible role actors resume instead of fresh-spawn | task runtime + PABCD actor registry |
| 2 | Cache-fork self-clone | Parent self-fork with same model/thinking/cache identity and append directive | fork seed + task/session creation path |
| 3 | PABCD wiring | P resumes within P, A fresh-starts then resumes within A gates, etc. | orchestrate prompts/runtime glue |
| 4 | Compaction/prewarm hardening | actor-local compact + post-open prewarm | session/prewarm integration |
| 5 | Public API cleanup | expose only stable policy knobs; keep cache lane separate from model presets | tool schema/settings/docs |

## 3. Non-negotiable fork rule

A fork must be built **at the fork moment**.

Do not reuse a previously frozen `ForkContextSeed` for a new fork request. The seed must snapshot the parent conversation, append-only prefix, cache identity, and current messages at the moment the actor is created.

Allowed reuse:

- Resume an already-created actor by reopening its actor session.

Disallowed reuse:

- Reusing an old fork seed to create a different new child later.
- Precomputing fork seeds for future actors before dispatch time.
- Treating a P-stage fork seed as valid after advancing to A/B/C.

## 4. Stage lifecycle rule

PABCD actor lanes are state-scoped:

- P creates P actors and resumes them while still in P.
- A creates fresh A actors and resumes them across A audit/gate retries.
- B creates fresh B actors and resumes them across B verification retries.
- C creates fresh C actors and resumes them across C check/review retries.
- D creates fresh D actors only if needed.

Cross-stage actor reuse is forbidden unless a future explicit design says otherwise.

## 5. Model-setting rule

- Resume actors: compatible only if role, model, thinking level, prompt hash, stage lane, cwd/worktree, and tool surface still match.
- Cache-fork self-clone: model/thinking are inherited from parent and cannot be configured through executor/planner/architect/critic model presets.
- Multi-provider role actors are valid orchestration lanes, but not parent-cache lanes.
- Add `executor_ext` as the explicit external-model executor lane: fresh-spawn by default, model configurable, parallelizable, and not parent-cache-guaranteed.
- Keep `executor` as the default self-fork/cache lane; ordinary work routes there unless the caller explicitly asks for external executor model/provider behavior.
