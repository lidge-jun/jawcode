# 20 A audit — plan verification

## Round 1

Auditor: Backend employee, read-only.

Verdict: FAIL.

Findings:

1. `20.003` move was stale because the closeout had already landed in commit `64cd241f`.
2. Push authorization needed to be explicit in the plan.
3. Settle drain wording was too broad and could invite a copy into `#resetInFlight()`.

Compatible items confirmed:

- `packages/agent/src/agent-loop.ts` supports yield-boundary re-poll after `onBeforeYield`.
- `packages/agent/src/types.ts` signatures match `getSteeringMessages`, `getFollowUpMessages`, and `onBeforeYield`.
- `packages/coding-agent/src/session/agent-session.ts` already has compatible `#scheduleAgentContinue`, `#canAutoContinueForFollowUp`, and `agent.hasQueuedMessages()` gates.
- `packages/coding-agent/test/agent-session-queued-prompts.test.ts` is the correct focused regression-test home.
- Existing jaw-interview dirty work is unrelated and should remain a separate commit.

## Plan Corrections

- Marked `20.003` closeout as already complete.
- Scoped stranded followUp drain to normal `#endInFlight()` settle only.
- Documented that final `git push origin dev` is authorized by the current user goal hint.

## Round 2

Auditor: Backend employee, read-only.

Verdict: PASS.

Evidence:

- The revised plan represents `20.003` as already complete in commit `64cd241f`.
- The stranded followUp drain is scoped to normal `#endInFlight()` and explicitly excluded from `#resetInFlight()`.
- Push is documented as authorized by the current `/goal plan` user hint.
- The agent-loop insertion point, callback signatures, `Agent` queue APIs, `#scheduleAgentContinue()`, and `#canAutoContinueForFollowUp()` all match the plan.
- `packages/coding-agent/test/agent-session-queued-prompts.test.ts` is a compatible regression-test home.
