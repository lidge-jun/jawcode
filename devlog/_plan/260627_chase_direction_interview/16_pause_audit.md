# Pause audit (agent gate 2/2) — remaining 8 cards are genuinely blocked

> Dev-skill audit for the agent-pause gate. Conclusion: every cleanly-closeable card has been
> closed; the 8 remaining goal-target cards are UNPROVEN-but-BLOCKED (no faithful autonomous
> closure without a user test-env / verification-standard decision). Two independent reviewers concur.

## 1. Requirement-by-requirement (goal = close each confirmed card to `_fin` with evidence)

**Closed this session (PROVEN):** reference 6 (WP2) · 10.013 coded (WP3) · 10.024 (WP4) · 10.005 (WP5)
= 9 cards in `_fin` with diff/tsc evidence. Directions for all 9 interview cards recorded (WP1).

**Remaining goal-target (UNPROVEN — BLOCKED, evidence below):**

| card | status | authoritative evidence it is blocked (not merely hard) |
|------|--------|--------------------------------------------------------|
| 10.002 ai_auth | UNPROVEN/BLOCKED | **C4 auth**; `diff auth-storage.ts` = 349 lines + new upstream providers (fugu, glm-zcode). Cannot certify benign tsc-only; needs tests (broken). |
| 10.003 cursor | UNPROVEN/BLOCKED | jwc genuinely lacks gjc `shellTimeoutSeconds` ms→s bugfix + F15 cache bound (triage: not conscious removals). Net-new code + tests. |
| 10.007 team self-heal | UNPROVEN/BLOCKED | Card: "Upstream self-heal retag ⬜ missing" in jwc. Net-new tmux code; done-gate = behavioral self-heal/reject tests (broken). |
| 10.012 goal steering | UNPROVEN/BLOCKED | jwc `goal-engine.ts` supports only `add_subgoal`; 6 steering commands + dispatcher net-new; done-gate #4 = "tests cover each kind" (broken). |
| 10.021 redteam | UNPROVEN/BLOCKED | Decision F: deferred until 10.012 (gated on a blocked card). |
| 10.023 task notif | UNPROVEN/BLOCKED | The 0.5.1 fix is 3 `it.skip` tests (behavior absent); needs net-new `agent-session.ts` code. |
| 20.005 steering delivery | UNPROVEN/BLOCKED | jwc lacks `lateSteering` re-poll (0 vs omp 3) + `drainStrandedQueuedMessages` (absent). Net-new code + new test. |
| 20.006 tui input | UNPROVEN/BLOCKED | No Esc draft-clear branch, no `resetDisplay` API at all; ast-edit 362-line forked divergence. Net-new code + tests. |

## 2. The binding blocker (capability + decision, out of scope)

Runtime tests are broadly broken: native version drift (node_modules loader `__piNativesV1_0_2`
vs crate `nV1_0_4` vs pkg 1.0.6) fails at `@jawcode-dev/natives` load via `packages/utils`, so
nearly all coding-agent tests cannot run (isolated `test/goals/goal-tool.test.ts` also fails at
native load). Fixing = native re-sync + `bun install` (lockfile/native side effects the 260626
refresh explicitly fenced) = **out-of-scope release infra requiring user authorization**. The
remaining cards' done-gates require runtime behavioral tests; tsc-only is unfaithful for net-new
behavioral subsystems and C4 auth. → genuine "cannot proceed without human judgment" stop condition.

## 3. Dev-skill compliance (this session)

- Fresh verification output: tsc 0 errors (10.013, coding-agent incl test); per-close link-checks
  `ok=N broken=0`; `git diff --check` clean each cycle.
- Import/export safety: 10.013 added `type Component` import + 2 private methods, no export removed; tsc clean.
- Static analysis: `tsc --noEmit -p packages/coding-agent` = 0 errors.
- 500-line limit: only source file touched (`assistant-message.ts`) ≈ 360 lines; all devlog/docs under limit.
- Atomic commits: ~17 commits, one logical change each, no batching, no push.

## 4. Documentation evidence

devlog `00`–`16` (research + 5 work-phase plans + assessments); changed paths in each commit;
fresh verification tails in each D attestation.

## 5. Independent reviewers (both PASS for pause)

1. Stop-audit reviewer: CONTINUE→(after 10.024)→remainder pause legitimate.
2. Diff-triage reviewer: of 5 undetermined adapt cards, only 10.005 closeable; other 4 net-new BLOCKED.
Both now satisfied: 10.024 + 10.005 closed; the 8 remaining have no faithful autonomous path.

## Decision surfaced to user

(a) authorize a test-env restoration pass (native re-sync) → close the 8 with real tests; or
(b) explicitly accept tsc/diff-only rigor for the non-C4 net-new cards; or (c) keep paused.
C4 auth (10.002) should not close without tests regardless.
