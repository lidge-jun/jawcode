# 82 — A-stage delta audit fail report

> Stage: A audit round 2 delta
> Plan audited: `80_pabcd_phase_execution_plan.md`
> Planner lens: PASS with low notes.
> Architect lens: FAIL.

## Planner delta

PASS

[low] 80 §5.5 vs 81 planner [low] — Phase 3 prompt parity is behavioral prose only; add a mechanical test/snapshot/grep gate for `Fresh spawn` removal in `orchestrate-p.md` and `orchestrate-a.md`.
[low] 80 §4.5 vs 10_execution_scaffold §F — provider/cache acceptance should explicitly point to the Codex `prompt_cache_key` request-body assertion.

## Architect delta

FAIL

[CRITICAL] 80 §3.3 — Phase 1 hidden routing has no concrete lane/key derivation module or file target; add Phase 1 `buildWorkflowActorLane`/actor-key helper and unit tests.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:426 — reset deletes only `pabcd-state.json`; specify ordered hook: read ctx → retireNamespaceActors → unlink.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts:211 — nextCtxFor copies ctx with no actor retirement; specify persist/fromPhase hook to retireStageActors on every inter-stage advance.
[HIGH] packages/coding-agent/src/jwc-runtime/orchestrate-state.ts:40 — add `actor_namespace_id` to strict write schema path, not only lenient read.
[HIGH] packages/coding-agent/src/task/index.ts:642 — add explicit test that self-fork/executor-cache path never consumes batch `frozenForkSeeds`.
[MEDIUM] packages/coding-agent/src/task/index.ts — define PABCD-active predicate and `getSessionId` undefined behavior.
[MEDIUM] packages/coding-agent/src/jwc-runtime/plan-writer.ts:316 — add Phase 1 invariant that workflow actor registry is sole resume authority for task routing.
[MEDIUM] packages/coding-agent/src/prompts/jaw/orchestrate-p.md:13 / orchestrate-a.md:9 — add Phase 1 minimal stub edits so operators are not misled before Phase 3.
[MEDIUM] 80 §5.5 — add named orchestrate-runtime transition+retirement test to final gate list.
[LOW] model UI target — tie Phase 2 routing doc to default executor self-fork ignoring configurable executor role.

Most likely break first: `packages/coding-agent/src/task/index.ts` — PABCD actor routing without namespace mint, lane key derivation, and busy-lane rules will keep fresh-spawning or resume the wrong `sessionFile` across stage/cycle boundaries.
