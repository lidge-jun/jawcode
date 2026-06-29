# 500 Phase 50 plan — live pending-action snapshot bridge + inbound execution layer (chase 10.032)

> Work-phase outcome: give the managed daemon a way to (a) obtain a per-session `RemoteActionContext`
> across the process boundary (needed to decode compact button callbacks) and (b) execute a router
> `InboundDispatchPlan` against real Telegram/forward effects. Does NOT touch `runDaemonTick` (phase 51
> integration). Independent slice, atomic commit.

## Why

The phase-49 router (`routeTelegramInboundUpdate`) is fully tested but its `resolveActionContext` is a
caller-supplied seam. In the live daemon two cross-process facts hold:

1. The **session** (`NotificationLoopbackServer` / `NotificationSessionRegistry`) is the authority for ask
   resolution — its `reply` handler already classifies `button` vs `free_text` by matching the value
   against the action's `options`, and `resolveRemote`/`resolveLocal` enforce the local-vs-remote race and
   idempotency. Free-text inbound therefore already works live via `forwardTelegramReplyToSession` (no
   bridge needed: unknown context -> `forward_reply` -> session resolves authoritatively).
2. **Buttons** use a compact `callback_data` that must be decoded against the active ask's `options`
   (`resolveAskButtonAnswer`). The daemon does not hold the session's in-memory options, so it cannot turn
   a button press into a value to forward. It needs the session to publish `{actionId, options,
   allowFreeText}`.

Authorization model (unchanged): Telegram->daemon authorized by chat-id fingerprint match; daemon->session
authorized by the per-session connect token read from the local discovery record. So the daemon-side
preliminary decision presents `record.token` as `presentedToken`; the session re-validates as final
authority.

## Slice scope (phase 50)

### 1. `discovery.ts` — publish active ask snapshot
Add OPTIONAL, backward-compatible field to `NotificationEndpointRecord`:
```ts
pendingAction?: { actionId: string; options?: string[]; allowFreeText?: boolean };
```
No token/prompt-body/secret. Existing readers ignore it (optional). `NotificationEndpointDisplay` left as-is
(snapshot is operational routing data, not an operator display field).

### 2. `server.ts` — maintain the snapshot
- Store the base `NotificationEndpointRecord` on the instance at `start()`.
- `enqueueAction(draft)` -> after enqueue, `#publishPendingAction({actionId, options, allowFreeText})`
  (rewrites the record with `updatedAt` bumped + `pendingAction` set).
- `resolveLocal(actionId)` and remote-resolved path -> if it resolved the *active* action, clear
  `pendingAction` (publish with field omitted). Best-effort: wrap the write in try/catch so an ask is never
  blocked by a discovery write failure; never log the token.
- Single active-ask model: the registry replays all unanswered actions, but the snapshot tracks the most
  recently enqueued unanswered action (sufficient for single-ask gate; multi-ask is out of scope here).

### 3. `daemon-inbound.ts` (NEW, < 120 lines)
- `buildRemoteActionContextFromRecord(record: NotificationEndpointRecord): RemoteActionContext | undefined`
  - undefined when `record.pendingAction` absent OR `record.stale`.
  - else `{ sessionId, actionId, expectedToken: record.token, allowedValues: options, allowFreeText,
    answeredBy: undefined, idempotencyRecords: [] }`. Preliminary only; session is authority.
- `executeInboundDispatchPlan(plan, effects): Promise<ExecuteInboundResult>`
  - `effects`: `{ answerCallback({callbackQueryId, ok, text?}); forwardToSession({sessionId, value}) }`
  - maps `answer_callback` -> answerCallback; `deliver_answer` + `forward_reply` -> forwardToSession;
    `drop` -> recorded no-op.
  - each action isolated in try/catch (never throws); returns `{ executed[], forwarded, acked, dropped,
    failed }`. Token never logged.

### 4. Tests
- `notifications-daemon-inbound.test.ts`:
  - context: absent pendingAction -> undefined; stale record -> undefined; present -> full context fields.
  - execute: accepted callback -> ack(ok) + forward; rejected callback -> ack(not ok), no forward;
    forward_reply -> forward only; drop -> nothing; a throwing effect is swallowed and tallied `failed`.
- `notifications-server.test.ts` (+): enqueueAction publishes pendingAction to the discovery record;
  resolveLocal clears it; a failing discovery write does not throw out of enqueue/resolve.

## Done gate (this slice)
- [ ] discovery record carries optional pendingAction; existing record readers unaffected (types compile,
      existing server/discovery tests pass).
- [ ] server publishes on enqueue, clears on resolve, best-effort (never blocks an ask).
- [ ] `buildRemoteActionContextFromRecord` correct for absent/stale/present.
- [ ] `executeInboundDispatchPlan` maps every action kind, never throws, token-safe, accurate tally.
- [ ] focused tests + full notifications regression + check:types green.

## Verification
`bun test test/notifications-daemon-inbound.test.ts test/notifications-server.test.ts test/notifications-discovery.test.ts`;
full `bun test test/notifications-*.test.ts`; `bun run check:types`; `bunx biome check`.

## Out of scope (phase 51)
Wire `routeTelegramInboundUpdate` + this bridge + executor into `runDaemonTick` (pre-load contexts for
the tick's session set, route each polled update, execute). Then close 10.032.
