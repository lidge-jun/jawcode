# PABCD-5 — prompt, skill, UI, API, and routing cleanup

Status: planning artifact; depends on PABCD-2 through PABCD-4.

## Goal

Remove user-facing legacy routing and prose after core contracts can accept `plan`/`goal` canonical ids.

## Patch shape

- `jaw-interview` execution bridge says `/skill:goal` / `jwc goal`, not `/skill:ultragoal`.
- `team` follow-up and handoff prose says goal, not ultragoal, except explicit legacy storage notes.
- `ralplan` skill doc is either removed from public docs or reframed as legacy compatibility for public `plan`.
- `ultragoal` skill doc is retitled/reworded as Goal workflow.
- `ai-slop-cleaner` parent skill becomes `goal`.
- skill keyword routing maps `$goal` to `goal`; `$ultragoal` is compatibility alias to `goal`; `$ralplan` routes to `plan` or `orchestrate p`.
- UI/HUD no longer needs display-name hacks for `ralplan`/`ultragoal` once state ids are canonical.
- RPC/approval gate stages use canonical values or explicit v2 compatibility layer.

## Affected files

- `packages/coding-agent/src/prompts/system/system-prompt.md`
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/ai-slop-cleaner.md`
- `packages/coding-agent/src/hooks/skill-keywords.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/approval-gate.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/workflow-gate-broker.ts`
- `packages/coding-agent/src/modes/rpc/rpc-types.ts`

## Verification

- Prompt/system template tests.
- Default JWC definition tests.
- Skill keyword routing tests.
- RPC/approval gate compatibility tests.


## Jaw Interview Round 4 semantic decisions — 2026-06-14T14:29:13.078234+00:00

Decisions:

1. Legacy names are **fully deprecated**.
   - `ralplan` / `ultragoal` appearing in user-facing prose, prompts, help, docs, or normal command recommendations is a bug after migration.
   - Internal aliases may remain only for compatibility reads and deprecated command/wire handling.

2. Migration conflict/failure posture is **best effort with warnings**.
   - Move what can be safely moved.
   - Preserve evidence and warnings for anything skipped or conflicting.
   - Do not silently discard old artifacts.
   - Do not fail the whole migration solely because one legacy artifact cannot be migrated, unless corruption would make continued operation unsafe.

3. RPC/API naming should also fully flip, but through phased PABCD cycles.
   - No permanent legacy wire-value doctrine.
   - Existing legacy RPC values may be accepted during compatibility phases.
   - New write/event/output contracts should converge to canonical `planphase` / `goal` values across subsequent PABCD cycles.

Derived implementation doctrine:

- Public/default prose after the migration should not advertise `/skill:ralplan`, `/skill:ultragoal`, `$ralplan`, `$ultragoal`, `jwc ralplan`, or `jwc ultragoal` except in explicit deprecation/migration diagnostics.
- Compatibility aliases should produce warnings or migration guidance where user-visible.
- PABCD cycles should progressively remove legacy wire values after compatibility tests and migration tooling exist.


## Jaw Interview Round 5 naming decision — 2026-06-14T14:30:28.850926+00:00

Decision:

- Public workflow name remains **`plan`**.
- Internal P-stage artifact/storage/writer contract becomes **`planphase`**.

Meaning:

- User-facing workflow surface: `/skill:plan` and `jwc orchestrate p`.
- Internal artifact writer: `jwc planphase --write`.
- Physical plan artifacts: `.jwc/plans/planphase/`.
- Runtime/state identifiers should use `plan` for the workflow concept where the public workflow is being represented, and `planphase` for P-stage artifact writer/storage contracts where disambiguation is needed.
- Legacy `ralplan` should be accepted only through deprecation/read-compat paths and should not appear in normal user-facing guidance.
