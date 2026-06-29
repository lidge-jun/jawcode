# 88 Phase 8 build — workflow, team, and packaging hardening

## Build output

Docs-only build completed for Phase 8. No source code, tests, CI workflows, release scripts, native Rust code, plugin runtime code, tmux/team runtime, or upstream clone files were modified.

## Files added

| File | Purpose |
|---|---|
| `80_phase8_workflow_team_packaging_plan.md` | Parent Phase 8 plan with source anchors, JWC owners, overlap inventory, candidate slices, explicit non-changes, and verification plan. |
| `81_phase8_harness_rollup_split.md` | Split `10.039` into harness receipt/rollup candidates. |
| `82_phase8_goal_interview_state_split.md` | Split `10.042` into goal/interview/ask candidates. |
| `83_phase8_plugin_extensibility_split.md` | Split `10.044` into plugin/extensibility candidates. |
| `84_phase8_computer_use_native_split.md` | Split `10.045` into JS-contract vs native-control candidates. |
| `85_phase8_release_packaging_split.md` | Split `10.048` into release/CI/package candidates. |
| `86_phase8_team_worktree_split.md` | Split `10.050` into team/tmux/worktree/session candidates. |
| `87_phase8_workflow_team_packaging_audit.md` | Audit results and fixes. |

## Files modified

| File | Change |
|---|---|
| `02_phase_map.md` | Added Phase 8 required split artifacts row for `81-86`. |
| `struct_har/chase/10.039_gjc_chase_harness_receipts_phase_rollup.md` | Added Phase 8 owner/split evidence; card remains active. |
| `struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md` | Added Phase 8 owner/split evidence; card remains active. |
| `struct_har/chase/10.044_gjc_chase_plugin_extensibility_bundle.md` | Added Phase 8 owner/split evidence; card remains active. |
| `struct_har/chase/10.045_gjc_chase_computer_use_native_control.md` | Added Phase 8 owner/split evidence; card remains active. |
| `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md` | Added Phase 8 owner/split evidence and kept Phase 5 overlap as reference evidence; card remains active. |
| `struct_har/chase/10.050_gjc_chase_session_tmux_team_worktree.md` | Added Phase 8 owner/split evidence including session command and session tests; card remains active. |

## Verification plan for C

Run docs and smoke verification:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/02_phase_map.md devlog/_plan/260628_jwc_native_chase_implementation/80_phase8_workflow_team_packaging_plan.md devlog/_plan/260628_jwc_native_chase_implementation/81_phase8_harness_rollup_split.md devlog/_plan/260628_jwc_native_chase_implementation/82_phase8_goal_interview_state_split.md devlog/_plan/260628_jwc_native_chase_implementation/83_phase8_plugin_extensibility_split.md devlog/_plan/260628_jwc_native_chase_implementation/84_phase8_computer_use_native_split.md devlog/_plan/260628_jwc_native_chase_implementation/85_phase8_release_packaging_split.md devlog/_plan/260628_jwc_native_chase_implementation/86_phase8_team_worktree_split.md devlog/_plan/260628_jwc_native_chase_implementation/87_phase8_workflow_team_packaging_audit.md devlog/_plan/260628_jwc_native_chase_implementation/88_phase8_workflow_team_packaging_build.md struct_har/chase/10.039_gjc_chase_harness_receipts_phase_rollup.md struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md struct_har/chase/10.044_gjc_chase_plugin_extensibility_bundle.md struct_har/chase/10.045_gjc_chase_computer_use_native_control.md struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md struct_har/chase/10.050_gjc_chase_session_tmux_team_worktree.md
```

Focused existing tests:

```sh
bun test packages/coding-agent/test/harness-control-plane/phase-rollup.test.ts packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts
```

```sh
bun test packages/coding-agent/test/jwc-plugin-schema.test.ts packages/coding-agent/test/jwc-plugin-loader.test.ts packages/coding-agent/test/tools/computer-use.test.ts packages/coding-agent/test/jwc-runtime/team-runtime.test.ts packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts packages/coding-agent/test/jwc-runtime/launch-worktree.test.ts packages/coding-agent/test/session-command.test.ts packages/coding-agent/test/task/worktree.test.ts
```
