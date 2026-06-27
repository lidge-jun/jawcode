# 89 Phase 8 check — workflow, team, and packaging hardening

## Local checks

| Check | Result |
|---|---|
| `git diff --check` on Phase 8 intended docs/cards | PASS |
| Harness/goal/interview focused tests | PASS — `59 pass / 0 fail` |
| Plugin schema, computer-use, team/tmux/worktree/session focused tests excluding known unrelated plugin-loader failure | PASS — `73 pass / 0 fail` |

## Focused test evidence

Harness, goal, and interview command:

```sh
bun test packages/coding-agent/test/harness-control-plane/phase-rollup.test.ts packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts
```

Result:

```text
59 pass
0 fail
Ran 59 tests across 4 files.
```

Plugin schema, computer-use, team, tmux, launch-worktree, session, and worktree command:

```sh
bun test packages/coding-agent/test/jwc-plugin-schema.test.ts packages/coding-agent/test/tools/computer-use.test.ts packages/coding-agent/test/jwc-runtime/team-runtime.test.ts packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts packages/coding-agent/test/jwc-runtime/launch-worktree.test.ts packages/coding-agent/test/session-command.test.ts packages/coding-agent/test/task/worktree.test.ts
```

Result:

```text
73 pass
0 fail
Ran 73 tests across 7 files.
```

## Known unrelated failure observed

The broader Phase 8 smoke command that included `packages/coding-agent/test/jwc-plugin-loader.test.ts` failed two tests:

```text
2 tests failed:
(fail) GJC plugin loader > loads valid skill and agent plugin fixtures
(fail) GJC plugin loader > rejects invalid fixtures with stable error codes
```

The failure is not introduced by Phase 8 because the current diff does not touch plugin loader code, plugin fixtures, or plugin loader tests. The observed error is an existing mismatch around `JwcPluginLoadError` code `invalid_parent` vs expected fixture behavior for parent `ralplan`. Phase 8 remains docs-only and records plugin loader as a future implementation owner, not a closed behavior.

## Employee verification

Backend read-only build verification returned DONE:

- Files `80-88` exist with expected content.
- `02_phase_map.md` contains the Phase 8 required split artifacts row.
- All six chase cards contain Phase 8 evidence and remain active.
- No source implementation files, workflows, scripts, native Rust, plugin runtime files, or upstream clones are modified by Phase 8.
- Unrelated `devlog/.gitignore` and `devlog/_tmp/` remain separate.

## Commit scope

Stage only:

- `devlog/_plan/260628_jwc_native_chase_implementation/02_phase_map.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/80_phase8_workflow_team_packaging_plan.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/81_phase8_harness_rollup_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/82_phase8_goal_interview_state_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/83_phase8_plugin_extensibility_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/84_phase8_computer_use_native_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/85_phase8_release_packaging_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/86_phase8_team_worktree_split.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/87_phase8_workflow_team_packaging_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/88_phase8_workflow_team_packaging_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/89_phase8_workflow_team_packaging_check.md`
- six active chase cards updated in Phase 8

Do not stage `devlog/.gitignore` or `devlog/_tmp/`.
