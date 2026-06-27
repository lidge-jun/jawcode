# 87 Phase 8 audit — workflow, team, and packaging hardening

## Scope

Audit of Phase 8 docs-first plan and chase-card updates:

- `80_phase8_workflow_team_packaging_plan.md`
- `81_phase8_harness_rollup_split.md`
- `82_phase8_goal_interview_state_split.md`
- `83_phase8_plugin_extensibility_split.md`
- `84_phase8_computer_use_native_split.md`
- `85_phase8_release_packaging_split.md`
- `86_phase8_team_worktree_split.md`
- chase cards `10.039`, `10.042`, `10.044`, `10.045`, `10.048`, `10.050`

## Initial audit results

| Auditor | Verdict | Issues |
|---|---|---|
| Docs | NEEDS_FIX | Parent plan candidate slices drifted from split docs/cards; `_fin` overlap inventory lacked explicit paths; Phase 8 phase-map row lacked required split artifacts. |
| Backend | NEEDS_FIX | Parent plan omitted session-registry owners; `10.050` chase card omitted `packages/coding-agent/src/commands/session.ts` and session evidence. |

## Fixes applied

| Issue | Fix |
|---|---|
| Candidate slice drift | Aligned `80` candidate table with all `81-86` split docs and chase-card split results, including all `-C` slices. |
| Missing `_fin` paths | Added explicit overlap paths for `10.010`, `10.012` goal steering, `10.021`, `10.022`, `10.007`, plus the `20.015`/`51` release overlap evidence. |
| Phase map traceability | Added Phase 8 required split artifacts row for `81-86` in `02_phase_map.md`. |
| Session owner inventory | Added `packages/coding-agent/src/session/session-manager.ts`, `packages/coding-agent/src/commands/session.ts`, `packages/coding-agent/test/session-command.test.ts`, and launch-worktree evidence to the parent plan and `10.050` card. |

## Narrow re-audit results

| Auditor | Verdict | Evidence |
|---|---|---|
| Docs | PASS | Confirmed all 18 candidate slices align across `80`, `81-86`, and chase cards; all required `_fin` paths exist; Phase 8 phase-map row lists all required split artifacts. |
| Backend | PASS | Confirmed session registry owners/tests exist, `10.050` aligns with `86`, and no implementation closure is claimed. |

## Residual risk

This phase is docs-only. It does not implement harness, goal/interview, plugin, native computer-use, release, or team/worktree behavior. Those remain active future slices requiring dedicated PABCD cycles and focused tests.
