# 60 — PABCD actor lifecycle map

> Status: scaffold.
> Purpose: pin the intended stage-scoped actor semantics before implementation.

## 1. Core rule

PABCD actors are **fresh per state, resume within state**.
> Interview update 2026-06-14: resume is scoped to the current PABCD cycle/stage/lane only. A new PABCD cycle, even if it enters the same stage name (`p` after a prior completed/reset cycle), must not select old actors as compatible. Use a distinct actor namespace/resume slot per live PABCD run to make this mechanically true.
> Follow-up check 2026-06-14: cli-jaw's employee resume and session buckets support a strict namespace/bucket model. JWC should persist a fresh `actor_namespace_id` on new PABCD entry/reset/complete and include it in every workflow actor key.
> Interview update 2026-06-14: concurrency is lane-type-specific. Planner/Architect/Critic/verifier role actors are single-lane/non-concurrent inside a stage. Default `executor` uses separate cache-fork actors and may run in parallel when file/task scopes are independent. `executor_ext` keeps existing fresh-spawn parallel behavior.

This avoids two bad extremes:

- fresh-spawning every Planner/Architect/Critic call inside a stage;
- carrying stale role context across semantically different PABCD states.

## 2. Stage map

### I — Interview

No implementation actor lane required for this slice.

If scoring/review helpers later need caching, they should use a separate interview scorer lane with explicit cache identity. Do not reuse P-stage actors.

### P — Plan

Actors:

- `p:planner`
- `p:architect` if the P loop uses architecture review before finalization
- `p:critic`

Lifecycle:

1. On P entry, create fresh P actor lanes as needed.
2. Planner draft/revision resumes `p:planner`.
3. Critic iterations resume `p:critic` if compatible.
4. Architect checks resume `p:architect` if compatible.
5. Auto compact is actor-local.
6. On P exit, P actors become inactive for future lookup.

### A — Audit

Actors:

- `a:planner-auditor`
- `a:architect-auditor`

Lifecycle:

1. A starts fresh lanes even if P had planner/architect actors.
2. Audit round retries resume A actors.
3. Gate retry within A uses same compatible A actor lane.
4. On A exit, A actors become inactive for future lookup.

### B — Build

Actors:

- Main session owns implementation unless explicitly delegated.
- `b:verifier` for read-only verification lane.
- Optional `b:executor-self-fork` only for cache-fork delegated slices when policy allows.

Lifecycle:

1. B starts fresh B lanes.
2. Verifier retry resumes `b:verifier`.
3. Self-fork executor lane, if used, follows fork-time snapshot rule on creation and resume after creation.
4. On B exit, B actors become inactive.

### C — Check

Actors:

- `c:mechanical-check-reviewer`
- `c:adversarial-reviewer`

Lifecycle:

1. C starts fresh C lanes.
2. Re-check/review retry resumes compatible C actors.
3. Routing back to B/P/I retires C active lookup and returns to the target stage lifecycle.

### D — Done

Actors:

- Optional `d:summary` or no actor.

Lifecycle:

1. Fresh if needed.
2. No cross-cycle reuse.

## 3. Gate lane rule

A gate lane is narrower than a whole stage when needed.

Example:

- `a:architect-auditor:round-1` can resume while resolving one audit round.
- A new round may either resume the broader `a:architect-auditor` actor or create `round-2` depending on final implementation choice.

Default recommendation:

- Resume by stage+role, not by round, unless round-specific contamination appears in testing.

## 4. Append injection rule

Every resumed actor receives new work as an appended message/task directive. Do not rebuild or replace its system prompt on every call.

Every fresh fork actor receives a fork-time parent snapshot plus appended directive. Do not use stale fork seeds.

## 5. Compaction rule

Compaction is actor-local:

- P planner compaction affects only `p:planner`.
- A auditor compaction affects only that A auditor lane.
- Parent/main compaction does not mutate existing actor histories.
- New fork after parent compaction snapshots the parent at that post-compaction moment.

## 6. Reset rule

`jwc orchestrate reset` should retire active actor lookup for the orchestration session. Historical actor records may remain for debugging until normal cleanup, but no reset actor may be selected as compatible for a new orchestration.
