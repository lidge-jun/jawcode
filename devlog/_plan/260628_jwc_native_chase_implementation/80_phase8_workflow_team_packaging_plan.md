# 80 Phase 8 plan — workflow, team, and packaging hardening

## Scope

Split and harden evidence for cards `10.039`, `10.042`, `10.044`, `10.045`, `10.048`, and `10.050`.

This phase is docs-first because these cards span harness control, persistent workflow state, plugin loading, native desktop control, release/CI, and tmux/team worktree behavior. Several surfaces are C4-adjacent: native input control, release packaging, plugin execution, and process/session control. Phase 8 records exact JWC owners and future implementation slices before any source code change.

## Source anchors

| Card | Source | Local head |
|---|---|---|
| `10.039` | GJC harness receipt and phase-rollup cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.042` | GJC deep-interview, ask, and goal-state cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.044` | GJC plugin extensibility and bundle cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.045` | GJC computer-use native-control cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.048` | GJC dev, CI, release, and packaging cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.050` | GJC session, tmux, team, and worktree cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |

## Existing JWC evidence

| Surface | Evidence |
|---|---|
| harness receipts and rollups | `packages/coding-agent/src/harness-control-plane/**`; `packages/coding-agent/test/harness-control-plane/**` |
| goal, interview, ask, and workflow state | `packages/coding-agent/src/goals/**`; `packages/coding-agent/src/jwc-runtime/goal-*`; `packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts`; `packages/coding-agent/src/skill-state/**`; `packages/coding-agent/test/goals/**`; `packages/coding-agent/test/jwc-runtime/**`; `packages/coding-agent/test/jaw-interview-*.test.ts` |
| plugin and extensibility boundaries | `packages/coding-agent/src/extensibility/**`; `packages/coding-agent/src/commands/plugin.ts`; `packages/coding-agent/src/cli/plugin-cli.ts`; `packages/coding-agent/test/jwc-plugin-*.test.ts`; `packages/coding-agent/test/extensibility/**`; `packages/coding-agent/test/marketplace/**` |
| computer-use control | `packages/coding-agent/src/tools/computer-use.ts`; `packages/coding-agent/src/tools/computer-use-backend.ts`; `packages/coding-agent/src/prompts/tools/computer-use.md`; `packages/coding-agent/test/tools/computer-use.test.ts`; `crates/pi-natives/src/*` currently has no `computer/` module in JWC |
| release and CI | `.github/workflows/**`; `scripts/jwc-release-validation.ts`; `scripts/ci-dev-affected.ts`; `scripts/ci-build-native.ts`; `scripts/ci-release-build-binaries.ts`; `scripts/release-publish-order.test.ts`; `scripts/check-*.ts`; package manifests |
| session, tmux, team, and worktree | `packages/coding-agent/src/jwc-runtime/team-runtime.ts`; `packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`; `packages/coding-agent/src/jwc-runtime/launch-worktree.ts`; `packages/coding-agent/src/commands/team.ts`; `packages/coding-agent/src/commands/worktree.ts`; `packages/coding-agent/src/commands/session.ts`; `packages/coding-agent/src/session/session-manager.ts`; `packages/coding-agent/test/jwc-runtime/team-runtime.test.ts`; `packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts`; `packages/coding-agent/test/jwc-runtime/launch-worktree.test.ts`; `packages/coding-agent/test/session-command.test.ts`; `packages/coding-agent/test/task/worktree.test.ts` |

## Upstream diff evidence

The Phase 8 source scan found these GJC change families in the reviewed range:

| Family | Evidence |
|---|---|
| harness | `671e20d5`, `7495682b`, `f8144130`, `75d103f4`, `22cbc7a0` |
| deep-interview/goal/skill-state | `2724108d`, `18db6df8`, `39229246`, `a78a1de8`, `616bfa60`, `5bd59525`, `babb4a97` |
| plugin | `c401f526`, `3155f038`, `419f2058` plus plugin bundle files under upstream `plugins/gajae-code/**` |
| computer-use | `a3967ff3`, `a7be3da1`, `581cf61a` with upstream native files under `crates/pi-natives/src/computer/**` |
| release/CI | `f6fbd957`, `0464f0f9`, `f183440a`, `d7bce535`, `14137324`, `beddd221`, `641e9294`, `195d7f04`, `7d390005`, `1e258255`, `ee966a25` |
| team/tmux/worktree | `c558504e`, `050aa173`, `310a8fda`, `5865991c`, `8cde8822`, `f747565f`, `2bf9e72c` |

## `_fin` overlap inventory

| Active card | `_fin` overlap | Phase 8 posture |
|---|---|---|
| `10.039` | `struct_har/chase/_fin/10/10.010_gjc_chase_harness_submit_readiness.md`; prior harness lifecycle/RPC cards may also cover baseline owner routing. | Keep active for receipt, spool, rollup, and owner-live classification only; do not reopen closed submit-readiness or RPC lifecycle work without a new gap. |
| `10.042` | `struct_har/chase/_fin/10/10.012_gjc_chase_goal_steering.md`; `struct_har/chase/_fin/10/10.021_gjc_chase_goal_redteam_review.md`; `struct_har/chase/_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md`. | Keep active for deep-interview ask/round metadata and skill-state persistence gaps beyond closed goal steering, red-team, and busy-loop slices. |
| `10.044` | Existing JWC plugin schema/loader tests cover core plugin safety. | Keep active for bundle/distribution/bridge boundaries; do not import upstream GJC plugin bundles wholesale. |
| `10.045` | No closed JWC native computer-use card was found in this Phase 8 scan. | Treat as security-sensitive split only; native input/capture code needs a dedicated C4 implementation loop. |
| `10.048` | `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md`; `devlog/_plan/260628_jwc_native_chase_implementation/51_phase5_release_test_leak_overlap.md`. | Keep `10.048` as release/CI owner; use `20.015` only as reference evidence. |
| `10.050` | `struct_har/chase/_fin/10/10.007_gjc_chase_team_profile_self_heal.md`; Phase 6 process-lifecycle context docs. | Keep active for tmux provider boundaries, worktree lifecycle, registry/list surface, and non-repo safety beyond closed self-heal. |

## New artifacts

| File | Purpose |
|---|---|
| `80_phase8_workflow_team_packaging_plan.md` | This plan. |
| `81_phase8_harness_rollup_split.md` | Split `10.039` into harness receipt/rollup candidates. |
| `82_phase8_goal_interview_state_split.md` | Split `10.042` into goal/interview/ask candidates. |
| `83_phase8_plugin_extensibility_split.md` | Split `10.044` into plugin boundary candidates. |
| `84_phase8_computer_use_native_split.md` | Split `10.045` into native-control candidates. |
| `85_phase8_release_packaging_split.md` | Split `10.048` into release/CI candidates. |
| `86_phase8_team_worktree_split.md` | Split `10.050` into team/tmux/worktree candidates. |
| `87_phase8_workflow_team_packaging_audit.md` | Record employee audit and fixes. |
| `88_phase8_workflow_team_packaging_build.md` | Record docs-only build output. |
| `89_phase8_workflow_team_packaging_check.md` | Record verification and commit evidence. |

## Chase docs to update

| File | Planned change |
|---|---|
| `struct_har/chase/10.039_gjc_chase_harness_receipts_phase_rollup.md` | Add Phase 8 split evidence, keep active. |
| `struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md` | Add Phase 8 split evidence, keep active. |
| `struct_har/chase/10.044_gjc_chase_plugin_extensibility_bundle.md` | Add Phase 8 split evidence, keep active. |
| `struct_har/chase/10.045_gjc_chase_computer_use_native_control.md` | Add Phase 8 split evidence, keep active. |
| `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md` | Add Phase 8 split evidence and Phase 5 overlap link, keep active. |
| `struct_har/chase/10.050_gjc_chase_session_tmux_team_worktree.md` | Add Phase 8 split evidence, keep active. |

## Candidate slices after this phase

Each future slice requires its own PABCD cycle. `10.045`, `10.048`, `10.050`, and plugin execution changes require security/release review if source code changes.

| Candidate | Owner card | Scope |
|---|---|---|
| `10.039-A` | `10.039` | JSONL spool export, receipt ingestion, and phase-rollup compatibility tests. |
| `10.039-B` | `10.039` | Submit readiness and live/manual owner classification gaps beyond already closed lifecycle work. |
| `10.039-C` | `10.039` | Finalize verdict derivation from assistant text only if current JWC behavior is weaker. |
| `10.042-A` | `10.042` | Persisted round metadata, active-state/HUD sync, and workflow revision reconciliation. |
| `10.042-B` | `10.042` | Goal continuation active flag and busy-loop stop behavior if JWC still has a loop gap. |
| `10.042-C` | `10.042` | Ask inline "Other" and selector-scroll ergonomics after confirming existing TUI behavior. |
| `10.044-A` | `10.044` | Generated plugin-bundle quarantine and manifest-name validation with `jwc`/`@jawcode-dev/*` names. |
| `10.044-B` | `10.044` | Delegatable plugin surface only as a JWC-native contract, not GJC session payload copy. |
| `10.044-C` | `10.044` | Custom command/MCP bridge tests for allowed roots, command args, and forbidden surface rejection. |
| `10.045-A` | `10.045` | Computer-use coordinate/screenshot contract tests around the existing JS tool surface. |
| `10.045-B` | `10.045` | Native module design doc and permission-gate tests before any Rust implementation. |
| `10.045-C` | `10.045` | Rust native capture/input implementation only after design approval in a later C4 PABCD loop. |
| `10.048-A` | `10.048` | CI affected-path and workflow YAML validation hardening. |
| `10.048-B` | `10.048` | Release publish order, changelog, package manifest, and native build guard tests. |
| `10.048-C` | `10.048` | Platform support warnings and native binary lane adjustments only after current hosted runner support is checked. |
| `10.050-A` | `10.050` | tmux exact-target/window qualification and provider-boundary tests. |
| `10.050-B` | `10.050` | Worktree lifecycle, nested worktree, non-repo safety, and lock/GC checks. |
| `10.050-C` | `10.050` | Session registry/list and adopted-leader diagnostics if JWC lacks observable recovery. |

## Explicit non-changes

- Do not patch GJC source under `devlog/_gjc_chase`.
- Do not add native computer-control Rust modules in this docs-first phase.
- Do not alter plugin execution, marketplace install, MCP bridge, or custom command behavior in this phase.
- Do not change CI workflows or release scripts in this phase.
- Do not modify tmux, team runtime, worktree, or session manager behavior in this phase.
- Do not close any of the six cards.
- Do not document upstream `gjc`/`.gjc` commands as JWC product instructions.

## Verification plan

Docs and smoke checks:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/80_phase8_workflow_team_packaging_plan.md devlog/_plan/260628_jwc_native_chase_implementation/81_phase8_harness_rollup_split.md devlog/_plan/260628_jwc_native_chase_implementation/82_phase8_goal_interview_state_split.md devlog/_plan/260628_jwc_native_chase_implementation/83_phase8_plugin_extensibility_split.md devlog/_plan/260628_jwc_native_chase_implementation/84_phase8_computer_use_native_split.md devlog/_plan/260628_jwc_native_chase_implementation/85_phase8_release_packaging_split.md devlog/_plan/260628_jwc_native_chase_implementation/86_phase8_team_worktree_split.md struct_har/chase/10.039_gjc_chase_harness_receipts_phase_rollup.md struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md struct_har/chase/10.044_gjc_chase_plugin_extensibility_bundle.md struct_har/chase/10.045_gjc_chase_computer_use_native_control.md struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md struct_har/chase/10.050_gjc_chase_session_tmux_team_worktree.md
```

Focused existing tests:

```sh
bun test packages/coding-agent/test/harness-control-plane/phase-rollup.test.ts packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts packages/coding-agent/test/goals/goal-runtime.test.ts packages/coding-agent/test/jwc-runtime/jaw-interview-runtime.test.ts
```

```sh
bun test packages/coding-agent/test/jwc-plugin-schema.test.ts packages/coding-agent/test/jwc-plugin-loader.test.ts packages/coding-agent/test/tools/computer-use.test.ts packages/coding-agent/test/jwc-runtime/team-runtime.test.ts packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts packages/coding-agent/test/task/worktree.test.ts
```

Release script checks may be docs-only in this phase. If a release code slice follows, run `bun test scripts/release-publish-order.test.ts` and the relevant `scripts/check-*.ts` gates under the supported Bun runtime.
