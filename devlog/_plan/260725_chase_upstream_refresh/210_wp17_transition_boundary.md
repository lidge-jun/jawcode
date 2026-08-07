# 210 — wp17: a fresh session could open with an answer to what you just cleared

Anchor: OMP `4d685bf76` *"made /new an atomic boundary against queued steers"* (oh-my-pi #5800). One of the
follow-ups named in the wp12 closeout rather than a new discovery.

| phase | evidence |
|---|---|
| P | live reproduction against a real `AgentSession` |
| A | **pass**, after two corrections to my own work |
| B | `2ce279e` |
| C | gates green; ablation with a control |

## Not a port of upstream's patch

Upstream's root cause was `abort()`'s `finally` calling `#drainStrandedQueuedMessages()` while disconnected.
**JWC already excludes that**: `#resetInFlight` (the abort path) deliberately does not drain, and says so in
a comment. Copying upstream's guard would have added a check where the bug cannot occur.

The remaining door is different: `#promptQueuedHiddenNextTurnMessages` runs from a scheduled post-prompt
task with no disconnection check. A triggering hidden message queued while `clearContext()` is in flight
starts a turn against the still-old context, races `agent.reset()`, and once the session reconnects its
output lands in the fresh session.

## Two corrections the audit forced

**My first reproduction was fake.** It queued the steer *before* the transition, so the turn ran normally
and the test failed for an unrelated reason. Instrumenting the call count showed both provider calls landing
*before* `clearContext()` even started — the transition was never involved. A red test is not evidence of
the bug you think you are testing.

**I shipped one guard, not two.** My first patch guarded both `#canAutoContinueForFollowUp` and
`#promptQueuedHiddenNextTurnMessages`. Removing the former left all 186 session tests and both new tests
green, so it was unproven — an unfalsifiable "defensive" check in a hot gate. It was removed. The final diff
is 12 lines in one place.

## The control matters

A guard that returns early is trivially "correct" if it just disables the feature. The suite pairs the
mid-transition assertion with a normal-operation one: a hidden steer queued outside a transition must still
start its turn. Under ablation the first goes red and the second stays green, which is what makes the guard
meaningful rather than a mute button.
