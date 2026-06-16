# 70 — executor vs executor_ext lanes

> Status: scaffold.
> User decision captured: fork directives must be append-style, and a configurable external executor lane (`executor_ext`) should exist alongside the default cache-oriented executor lane.

## 1. Naming decision

Split executor behavior into two lanes:

| Lane | Default? | Model configurable? | Spawn mode | Cache goal | Parallel? |
|---|---:|---:|---|---|---:|
| `executor` | yes | no | cache-fork self-clone first, then resume within compatible actor lane | strong parent-cache affinity | yes, with normal task safety rules |
| `executor_ext` | explicit only | yes | existing fresh-spawn role-agent/task logic | no parent-cache guarantee | yes |

## 1.1 Concurrency decision

Interview update 2026-06-14:

- `executor` parallelism is allowed because each parallel unit is a separate fork actor created at its own fork moment.
- `executor` must not mean "multiple concurrent prompts into the same actor session"; parallel work requires distinct fork actor lanes with non-overlap safety checks.
- Planner/Architect/Critic/verifier actors are not parallel within the same compatible lane. They resume serially or the workflow reports/queues busy.
- `executor_ext` remains the existing fresh-spawn external lane and can run in parallel like current task fanout.
- This is intentionally asymmetric: executor lanes optimize parallel implementation throughput, while role review/planning lanes optimize continuity and avoid session-state races.
- `executor` uses a full coding tool surface; its distinction from `executor_ext` is model/cache/session lifecycle, not read-only vs write-capable authority.
## 2. `executor` lane contract

`executor` becomes the normal/default implementation lane for ordinary work.

Rules:

- It is a self-clone fork lane.
- It inherits the parent model and thinking level.
- It is not affected by `task.agentModelOverrides.executor` or model profile executor settings.
- It must append the work directive after the inherited parent prefix/context.
- It should be prompt-shaped for common implementation work: compact, boring, file-focused, verification-aware.
- After initial fork actor creation, compatible repeated calls resume the actor rather than re-forking.

Rationale:

- Most work benefits more from parent-context cache continuity than from switching to a separate executor model.
- This matches the intended “clone myself to do bounded work” behavior.

## 3. `executor_ext` lane contract

`executor_ext` is the escape hatch for users who intentionally want a separate executor model/provider.

Rules:

- It uses the existing role-agent model routing logic.
- It is model configurable through the normal model/profile override surface.
- It fresh-spawns by default.
- It can be invoked in parallel like existing executor tasks.
- It does not claim parent prompt-cache affinity.
- It may later gain durable actor resume, but only as an external role actor lane keyed by model/thinking/prompt hash; it must not share the self-fork cache lane.

Rationale:

- Some users will want a cheaper/faster/different provider executor for parallel fanout.
- That should remain possible without weakening the default cache-fork executor semantics.

## 4. Public-surface caution

Current Jawcode repo contract says the bundled source-defined task role agents are exactly:

- `executor`
- `architect`
- `planner`
- `critic`

Adding `executor_ext` as a fifth public bundled role agent needs a gate/product-surface update. Safer implementation options:

1. Internal task policy alias: expose `executor_ext` only as a model hint/policy that resolves to the existing executor prompt with external model routing.
2. Public fifth role agent: update role-agent gates/docs/tests deliberately.
3. Slash/model UI option only: “External executor” toggles fresh-spawn model-configurable executor without adding a new bundled role name.

Recommended first implementation: **internal policy alias**. It satisfies the user behavior while avoiding accidental public-surface drift.

## 5. Append rule for both fork and resume

### Fork creation

Fork prompt shape must be append-style:

```text
[parent stable prefix]
[parent conversation/fork snapshot]

--- appended executor directive ---
[task]
[constraints]
[output contract]
```

Forbidden:

```text
[new executor system prompt]
[parent fork snapshot]
```

Reason: prefix replacement breaks the cache lane and violates the self-clone contract.

### Resume

Resume prompt shape is also append-style:

```text
[existing actor session]

--- new appended work directive ---
[next task / feedback / gate retry]
```

Do not rebuild the actor system prompt on every resume.

## 6. Routing rules

Default routing:
Interview update 2026-06-14:

- Main-session prompting should frame default `executor` as the caller's self-fork subagent, not as an externally model-configurable role.
- If the user asks for a different executor model/provider, route the work to `executor_ext` and use the existing model-override/model-change resolution path for that external fresh-spawn executor lane.
- Any explicit "use model X for executor" request maps to `executor_ext`; it must not mutate the default self-fork `executor` lane.

- Clear ordinary implementation slice → `executor`.
- Bounded parallel implementation where parent model is acceptable → multiple `executor` lanes, each forked at its own creation moment, with non-overlap checks.
- User explicitly asks for a different executor model/provider → `executor_ext`.
- Cost-sensitive fanout where cache is less valuable than cheap parallelism → `executor_ext`.
- Planner/Architect/Critic remain their role lanes and resume within stage/gate scope.

Ambiguity rule:

- If the caller does not explicitly ask for external model/provider routing, prefer `executor`.

## 7. Interaction with model selector

Model selector implications:

- `executor` badge/profile should not imply the cache-fork executor lane can be changed.
- If model UI continues showing an “EXECUTOR” role override, that should map to `executor_ext` or legacy fresh executor routing, not the self-fork cache lane.
> Interview update 2026-06-14: model UI should remove the misleading configurable `EXECUTOR` role badge for the default self-fork lane and introduce an explicit `EXTERNAL EXECUTOR` / `EXECUTOR_EXT` surface for the configurable fresh-spawn lane.
- The UI wording may need to distinguish:
  - `EXECUTOR` / default self-fork lane; and
  - `EXECUTOR_EXT` / external fresh executor lane.

Potential naming alternatives for UI:

- `EXECUTOR` = self-fork default, no model selector badge.
- `EXECUTOR_EXT` = configurable model role badge.
- Or `EXTERNAL EXECUTOR` in prose while the internal key is `executor_ext`.

## 8. Tests to add later

- Default implementation task resolves to `executor` self-fork lane.
- Setting executor model override does not affect cache-fork `executor`.
- Explicit `executor_ext` uses the override/fresh-spawn path.
- `executor_ext` can run in parallel with multiple tasks.
- Forked `executor` appends directive after inherited context.
- Resume of `executor` appends next task and does not rebuild/re-fork.
- UI/model profile tests do not misleadingly show self-fork executor as externally configurable.
