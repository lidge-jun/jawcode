# 82 Phase 8 split — 10.042 deep interview, ask, and goal state

## Source card

`struct_har/chase/10.042_gjc_chase_deep_interview_ask_goal_state.md`

## JWC posture

Adapt only JWC-native state and ask behavior that preserves the existing `goal`, `jaw-interview`, and `skill-state` contracts. Upstream `deep-interview-*` files are source evidence, not implementation templates.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| goal runtime and state | `packages/coding-agent/src/goals/**`; `packages/coding-agent/src/jwc-runtime/goal-cli.ts`; `packages/coding-agent/src/jwc-runtime/goal-engine.ts`; `packages/coding-agent/src/jwc-runtime/goal-guard.ts` |
| jaw interview runtime | `packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts`; `packages/coding-agent/src/jaw-interview/structured-renderer.ts`; interview tests |
| skill-state workflow | `packages/coding-agent/src/skill-state/**`; workflow-state and mutation-guard tests |
| ask/UI request gates | `packages/coding-agent/test/tools/ask.test.ts`; `packages/coding-agent/test/tools/ask-unattended-gate.test.ts`; selector/controller tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.042-A` | Persisted round metadata, active-state/HUD sync, and workflow revision reconciliation. | `workflow-state-command.test.ts`, `status-line-goal-segment.test.ts`, `jwc-runtime/jaw-interview-runtime.test.ts`. |
| `10.042-B` | Goal continuation active flag and busy-loop stop behavior if JWC still has a loop gap. | `goals/goal-runtime.test.ts`, `goals/goal-mode-integration.test.ts`, retry/busy tests. |
| `10.042-C` | Ask inline "Other" and selector-scroll ergonomics after confirming existing TUI behavior. | `tools/ask.test.ts`, selector/controller tests, Frontend review if TUI files change. |

## Reject/defer

- Replacing JWC's `jaw-interview` runtime with upstream `deep-interview-*`.
- Reopening goal steering, red-team, or busy-loop fixes already closed by `struct_har/chase/_fin/10/10.012_gjc_chase_goal_steering.md`, `struct_har/chase/_fin/10/10.021_gjc_chase_goal_redteam_review.md`, or `struct_har/chase/_fin/10/10.022_gjc_chase_goal_agent_busy_loop.md` unless fresh regression evidence exists.
- Korean- or GJC-specific public prompts in JWC product surfaces.
- Treating goal state changes as docs-only closure.

## Done-gate status

No `10.042` done-gate is closed by this split. The card remains active.
