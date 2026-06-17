# 30 B build — implementation

## Runtime Changes

Modified:

- `packages/agent/src/agent-loop.ts`
  - Re-polls `getSteeringMessages()` after `onBeforeYield()` and before followUp drain.
  - Late steering is assigned to `pendingMessages` and processed by the existing inner loop.

- `packages/coding-agent/src/session/agent-session.ts`
  - Adds `#drainStrandedFollowUpMessages()`.
  - Invokes it only from normal `#endInFlight()` after `#promptInFlightCount` reaches zero.
  - Reuses `#canAutoContinueForFollowUp()` and `agent.hasQueuedMessages()` to avoid duplicate or non-resumable continues.
  - Leaves `#resetInFlight()` unchanged so abort/reset cleanup does not spawn followUp turns.

## Regression Tests

Modified:

- `packages/coding-agent/test/agent-session-queued-prompts.test.ts`

Added coverage:

- steering queued inside `Agent.setOnBeforeYield()` is delivered before session end;
- followUp queued by an internal extension `agent_end` event while wire-level `agent_end` is still deferred is drained after normal prompt settle.

## Focused Verification

```bash
bun test packages/coding-agent/test/agent-session-queued-prompts.test.ts
```

Result:

```text
4 pass
0 fail
17 expect() calls
```
