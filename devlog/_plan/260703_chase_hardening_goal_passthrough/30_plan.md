# 30_plan — P-stage draft: `20.037` session async / plan integrity

Status: draft-for-critic
Cycle: PABCD phase 30 of `devlog/_plan/260703_chase_hardening_goal_passthrough/00_moc.md`
Source chase card: `struct_har/chase/20.037_omp_chase_session_async_plan_integrity.md`
Work class: C3, cross-surface session/async/plan/goal integrity hardening

## Loop-spec header

- Loop archetype: verifier defines done. This phase imports only deterministic lifecycle/gate behaviors that can be proven by local tests.
- Trigger: OMP chase card `20.037` groups delayed session termination for pending async jobs, session fence/atomic rewrite integrity, dynamic model/goal recovery behavior, task/agent discovery ordering, and plan/goal convergence tests.
- Goal: close the JWC-safe subset of session async/data-integrity and plan/goal gate hardening without weakening `.jwc` goal/orchestrate approval semantics.
- Non-goals: no new workflow skill; no new task role; no broad task/agent discovery reorder; no plugin ordering change; no provider model catalog policy change; no bypass of plan approval / ask / resolve / PABCD gates; no adoption of OMP state names or package paths.
- Verifier: focused tests for async job delivery/lifecycle drains, session close/rewrite integrity, plan approval/convergence gates, and goal recovery/model-switch boundaries; then `git diff --check`, `bun run check:tools`, `bun run check:ts`, and C-stage `bun run check`.
- Stop condition: every adopted slice has direct regression coverage or an explicit noop receipt proving JWC already satisfies it; Critic OKAY; A audit pass; B verifier DONE; C gates pass.
- Memory artifact: this plan, P/A/B/C/D receipts beside it, and implementation commit hashes in the MOC.
- Expected terminal states: done (selected slices implemented/tested and deferred slices recorded), noop (JWC already satisfies a selected slice with direct test evidence), blocked (selected slice requires live external daemon/provider semantics), needs-human (selected slice changes public goal/plan behavior), budget-exhausted (partial selected slices with explicit remaining gap).
- Escalation condition: if a selected slice changes public `/goal`, `/plan`, ask/resolve, PABCD approval, session file format, or subagent lifecycle semantics, return to P/A before coding and do not silently patch.

Previous D-stage pessimist to carry forward: Phase 20 proved broad chase cards must be split by subsystem ownership; if this phase repeatedly needs cross-card edits to task/plugin lifecycle boundaries, replan around subsystem ownership rather than source-card numbering.

## Current-state evidence

- `struct_har/chase/20.037_omp_chase_session_async_plan_integrity.md` requires proof that async job termination does not drop retained background work, session atomic rewrites preserve newer data, and plan/goal convergence does not bypass JWC approval gates.
- `packages/coding-agent/src/async/job-manager.ts` owns async jobs, retained output, delivery queues, owner scoping, and subagent lifecycle state. Its delivery state (`AsyncJobDeliveryState`) can expose queued/delivering/pending job ids.
- `packages/coding-agent/src/session/agent-session.ts` owns lifecycle cleanup and currently exposes `dispose()`, `waitForIdle()`, and `drainAsyncJobDeliveriesForAcp()`. It also owns post-prompt recovery (`#postPromptTasks`), goal runtime hooks, plan/goal state, and pending model switches.
- `packages/coding-agent/src/session/session-manager.ts` already has `NdjsonFileWriter.isOpen()`, close/flush ordering, sync persistence fast path, and a deterministic close/append regression test.
- `packages/coding-agent/test/session-manager-close-race.test.ts` already locks the close-vs-append race. This phase should not re-solve that bug; it should add only missing current-state receipts or narrower regression cases.
- `packages/coding-agent/test/interactive-mode-plan-review.test.ts` already covers plan approval menu paths, keep-context vs clear-context execution, and compact-before-execute behavior.
- `packages/coding-agent/test/goals/goal-mode-integration.test.ts` already covers `/goal` state replacement, paused goal replacement, and `/plan` refusal while goal mode is active.

## Implementation plan

### Cluster A — async job delivery/lifecycle drain before session teardown

MODIFY `packages/coding-agent/src/session/agent-session.ts` only if inspection shows a gap:

- Add or reuse a bounded drain point before top-level session lifecycle teardown (`dispose()` / close-like paths) so pending async job deliveries owned by the session are attempted before session cleanup completes.
- Preserve current owner isolation: a subagent/session teardown must not cancel or drain unrelated parent/global jobs.
- Use existing `AsyncJobManager` delivery state APIs where possible. Do not invent a second job registry.
- Keep the drain bounded; timeout should return a boolean/receipt rather than hang shutdown indefinitely.

MODIFY/NEW tests:

- Prefer existing `packages/coding-agent/test/async-job-manager.test.ts` and `packages/coding-agent/test/agent-session-bash-detach.test.ts` only if the behavior belongs there; otherwise add `packages/coding-agent/test/agent-session-async-delivery.test.ts`.
- Cover: pending delivery is attempted before top-level session disposal completes; pending delivery timeout does not hang disposal; owner-scoped teardown does not drain/cancel another owner’s job.

Acceptance:

- Retained async/background output is not silently dropped by normal session teardown when local delivery is available.
- The test proves owner scoping and bounded shutdown behavior.

### Cluster B — session persistence fence / atomic rewrite receipts

MODIFY `packages/coding-agent/src/session/session-manager.ts` only if a missing fence is found:

- Inspect `#rewriteFile`, `#persist`, flush/close ordering, and writer reopen behavior around `NdjsonFileWriter.isOpen()`.
- If the existing cold rewrite / hot append / close path is already safe, add receipt tests rather than changing code.
- Any code change must keep the append-only tree semantics and existing session file format.

MODIFY tests:

- Extend `packages/coding-agent/test/session-manager-close-race.test.ts` or `packages/coding-agent/test/session-storage.test.ts`.
- Cover: a rewrite/close race preserves the newest appended entry; failed writer state does not poison later cold rewrite when a writer is mid-close; no duplicate or lost leaf entry after flush.

Acceptance:

- Newest session data wins across close/rewrite race windows.
- Existing close/append regression remains green.

### Cluster C — plan-mode convergence cannot bypass approval gates

MODIFY `packages/coding-agent/src/modes/interactive-mode.ts` only if test evidence shows a bypass:

- Preserve plan approval menu semantics: execution requires `handlePlanApproval()` and the approved plan path; synthetic plan execution remains distinguishable by `{ synthetic: true }`.
- Ensure queued/deferred model switches cannot cause an approved plan to execute after plan mode is exited or paused.
- Do not allow plan-mode convergence through `/goal`, `/plan`, or continuation paths to bypass ask/resolve or PABCD approval.

MODIFY tests:

- Extend `packages/coding-agent/test/interactive-mode-plan-review.test.ts`.
- Cover: refine/cancel/no-selection never dispatches synthetic plan-approved prompt; approve-and-compact cancellation/failure does not dispatch; deferred plan model switch is cleared when leaving plan mode and cannot later re-enter plan execution.

Acceptance:

- Plan execution only occurs through explicit approve options and never through refine/cancel/failure paths.
- Deferred model-switch recovery cannot resurrect plan-mode execution after exit.

### Cluster D — goal recovery/model switching stays within JWC goal semantics

MODIFY `packages/coding-agent/src/modes/interactive-mode.ts` or `packages/coding-agent/src/session/agent-session.ts` only if inspection shows a mismatch:

- Preserve Phase 80 rule: `/goal <input>` and `/goalplan <input>` force replacement/new goal state regardless of current goal state.
- Preserve `/plan` refusal while goal mode is active.
- Ensure goal recovery/thread-resume does not switch to an unintended model or weaken goal/orchestrate state; model restoration should use the same pending-switch guard as plan mode.

MODIFY tests:

- Extend `packages/coding-agent/test/goals/goal-mode-integration.test.ts` and/or `packages/coding-agent/test/agent-session-goal-reminder.test.ts`.
- Cover: goal resume/recovery keeps active goal tools/state and does not unblock `/plan`; pending model switch from plan mode does not override resumed goal state; goal replacement remains allowed from paused/active state.

Acceptance:

- Goal recovery stays compatible with Phase 80 and does not bypass PABCD/goal gates.
- Model switching is explicitly tested where it intersects plan/goal recovery.

### Cluster E — explicit deferrals from `20.037`

This phase explicitly defers:

- broad task/agent discovery ordering and disabled plugin ordering (`285d384ca`, `cff8f22d6`, `b3cda0d92` cluster) unless a direct session-integrity bug is found in A/B;
- provider dynamic model resolution policy (`d82b9bdc5`) beyond plan/goal recovery guard tests;
- any live external-daemon async job shutdown test requiring SSH/DAP/real provider services.

B/C/D receipts must record these deferrals as not closed.

## Verification plan

Focused tests (exact file list can narrow if B inspection proves a cluster noop):

```bash
bun test packages/coding-agent/test/async-job-manager.test.ts packages/coding-agent/test/agent-session-async-delivery.test.ts packages/coding-agent/test/session-manager-close-race.test.ts packages/coding-agent/test/interactive-mode-plan-review.test.ts packages/coding-agent/test/goals/goal-mode-integration.test.ts
```

If no new `agent-session-async-delivery.test.ts` is created, replace it with the exact existing affected test and record why.

Gates:

```bash
git diff --check
bun run check:tools
bun run check:ts
```

C-stage will run affected focused tests plus `bun run check`.

## Acceptance criteria

- Async job/session teardown handling either drains pending local deliveries safely or records a noop receipt proving current behavior, with owner scoping and bounded timeout tests.
- Session persistence race coverage proves newest data survives close/rewrite windows without poisoning future writes.
- Plan-mode execution remains gated by explicit approval; refine/cancel/compact-failure/deferred-switch paths cannot execute a plan.
- Goal recovery/model-switch behavior preserves Phase 80 goal replacement semantics and does not unblock `/plan` or weaken PABCD/goal gates.
- Deferred task/agent discovery ordering, provider dynamic model policy, and live external-daemon lifecycle hardening are explicitly recorded as not closed by this phase.
