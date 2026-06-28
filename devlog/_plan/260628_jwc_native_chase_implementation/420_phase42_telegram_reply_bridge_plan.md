# 420 Phase 42 plan — Telegram→session reply bridge (10.031 gate #4)

> Work-phase 42 = close `10.031` gate #4 (in-topic free text injects only to the mapped session). The
> daemon acts as a notification WS client: connect to the mapped session's loopback endpoint, learn the
> pending `actionId` from the replayed `action_needed`, send a `reply`, and let the session's server
> resolve its ask (phase 35 ask-bridge). Gate #6 (shutdown topic delete) → phase 43. Card stays OPEN.
> Risk class: **C3** (WS client to a live session endpoint); end-to-end tested with a real server.

## Part 1 — plain explanation
A Telegram message inside a session's topic must answer ONLY that session's question. The session
already runs a loopback notification server (phase 33) that resolves its ask from a remote reply
(phase 35). This phase adds the daemon-side bridge: open the mapped session's endpoint, read the
pending question id from the replayed `action_needed`, send the user's text as a reply, and confirm the
ask resolved — so the text is injected to exactly the one mapped session.

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/reply-bridge.ts` (~70 lines, real-server tested)
```ts
export interface ForwardReplyResult { ok: boolean; actionId?: string; reason?: string; }
export async function forwardTelegramReplyToSession(opts: {
  stateRoot: string; sessionId: string; value: string;
  webSocketImpl?: typeof WebSocket; timeoutMs?: number;
  readRecord?: typeof readNotificationDiscoveryRecord;
}): Promise<ForwardReplyResult>;
```
- `readRecord(stateRoot, sessionId)`; null → `{ok:false, reason:"no-endpoint"}` (fail closed — only the
  mapped session's endpoint is targeted).
- connect `new WebSocketImpl(`${record.url}?token=${record.token}`)`; on `message` collect frames.
- first `action_needed` → its `actionId` (the session's pending ask). None within `timeoutMs` →
  `{ok:false, reason:"no-pending-action"}`, close.
- send `{type:"reply", actionId, value}`; await `action_resolved` (matching actionId) → `{ok:true,
  actionId}` or `reply_rejected` → `{ok:false, actionId, reason}`. Always close the socket.
- All failures fail-closed; never throws into the caller.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export reply-bridge.

### NEW `test/notifications-reply-bridge.test.ts` (real `NotificationLoopbackServer`, temp stateRoot):
- start server for `session-x`, `enqueueAction` (discovery written + pending ask) → forward a reply →
  `{ok:true, actionId}` and the server resolved it (only that session); token from the record.
- no discovery record → `{ok:false, reason:"no-endpoint"}` (injects nowhere — mapped-session-only).
- server with no pending action + short timeout → `{ok:false, reason:"no-pending-action"}`.

### NEW devlog `421_audit`, `422_build`, `423_check`.

## PABCD
- **A**: independent audit — server connect-replay carries `action_needed` (actionId), discovery
  record fields (url/token), bun global `WebSocket` client usable in tests, fail-closed on missing
  endpoint, no token logs. Rule: does this + classify route satisfy gate #4 "injects only to mapped
  session" (close-worthy for #4)? Confirm 10.031 still needs gate #6 (→ keep OPEN).
- **B**: Boss writes bridge + real-server test.
- **C**: bridge + full notifications regression + check:types + biome + diff-check.
- **D**: 10.031 stays OPEN (gate #6 shutdown topic delete = phase 43). Commit.

## Constraints
- Targets only the mapped session's endpoint (fail-closed otherwise). Token from record, never logged.
- bun global `WebSocket`. ES modules; file ≤400 lines.
