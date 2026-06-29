# 422 Phase 42 build — Telegram→session reply bridge

> Boss-direct build after audit `421` PASS. Closes 10.031 gate #4; card stays OPEN (gate #6 = phase 43).

## Changes
### NEW `packages/coding-agent/src/notifications/reply-bridge.ts` (~85 lines)
`forwardTelegramReplyToSession({stateRoot, sessionId, value, webSocketImpl?, timeoutMs?, readRecord?})`
→ `{ok, actionId?, reason?}`: reads the mapped session's discovery record (fail-closed `no-endpoint`),
connects a WS client to its loopback endpoint, learns the pending `actionId` from the replayed
`action_needed`, sends a `reply`, and resolves on `action_resolved` (`ok:true`) /`reply_rejected`/timeout
(`no-pending-action`/`no-resolution`). Token from the record, never logged.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export reply-bridge.

### NEW `test/notifications-reply-bridge.test.ts` (3, real `NotificationLoopbackServer`):
inject reply → resolves the mapped session's ask (`{ok:true,actionId:"a1"}`); no endpoint → `no-endpoint`;
no pending ask → `no-pending-action`.

## Verification handoff
C: bridge + full notifications regression + check:types + biome + diff-check.
D: 10.031 OPEN; gate #6 (shutdown topic delete) = phase 43.
