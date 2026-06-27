# 86 Phase 8 split — 10.050 session, tmux, team, and worktree

## Source card

`struct_har/chase/10.050_gjc_chase_session_tmux_team_worktree.md`

## JWC posture

Adapt only team/tmux/worktree hardening beyond already closed self-heal and process lifecycle work. JWC's owners live under `jwc-runtime`, commands, and task worktree modules; upstream `gjc-runtime/team*` is evidence only.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| team runtime | `packages/coding-agent/src/jwc-runtime/team-runtime.ts`; `packages/coding-agent/test/jwc-runtime/team-runtime.test.ts` |
| tmux sessions | `packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`; `packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts` |
| worktree launch and task worktrees | `packages/coding-agent/src/jwc-runtime/launch-worktree.ts`; `packages/coding-agent/src/task/worktree.ts`; `packages/coding-agent/test/task/worktree.test.ts` |
| commands | `packages/coding-agent/src/commands/team.ts`; `packages/coding-agent/src/commands/worktree.ts`; CLI command tests |
| session registry/list | `packages/coding-agent/src/session/session-manager.ts`; `packages/coding-agent/src/commands/session.ts`; session tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.050-A` | tmux exact-target/window qualification and provider-boundary tests. | `jwc-runtime/tmux-sessions.test.ts`, team runtime tests. |
| `10.050-B` | Worktree lifecycle, nested worktree, non-repo safety, and lock/GC checks. | `jwc-runtime/launch-worktree.test.ts`, `task/worktree.test.ts`, negative non-repo tests. |
| `10.050-C` | Session registry/list and adopted-leader diagnostics if JWC lacks observable recovery. | session command tests, team diagnostics tests, no stale `.jwc` state leakage. |

## Reject/defer

- Reopening `struct_har/chase/_fin/10/10.007_gjc_chase_team_profile_self_heal.md` unless new evidence shows a gap.
- Copying upstream `gjc-runtime/team*` names or `.gjc` state paths into JWC.
- Adding process-kill or cleanup behavior without negative tests.

## Done-gate status

No `10.050` done-gate is closed by this split. The card remains active.
