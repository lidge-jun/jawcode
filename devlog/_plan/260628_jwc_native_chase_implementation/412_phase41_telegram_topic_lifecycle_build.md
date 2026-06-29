# 412 Phase 41 build — Telegram topic lifecycle

> Boss-direct build after audit `411` NARROW. Card 10.031 stays OPEN (gates #4/#6 runtime = phase 42).

## Changes
### MODIFY `packages/coding-agent/src/notifications/telegram-api.ts` (+~25 lines)
`createForumTopic({token,chatId,name,fetchImpl?}) → {message_thread_id}` and
`deleteForumTopic({token,chatId,messageThreadId,fetchImpl?}) → true`, both via the private
token-sanitized `telegramCall`; delete failure is non-fatal (best-effort caller).

### NEW `packages/coding-agent/src/notifications/threaded-lifecycle.ts` (~30 lines)
`decideTopicAction({threadedSupported, existing?})` → `reuse` / `create` / `flat-fallback`;
`needsIdentity = !existing.identitySent` so the identity header is emitted exactly once per topic.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export threaded-lifecycle.

### Tests
- `notifications-telegram-api.test.ts` (+2): createForumTopic message_thread_id + URL; deleteForumTopic
  true + best-effort failure tolerance.
- NEW `notifications-threaded-lifecycle.test.ts` (3): flat-fallback / reuse + identity-once / create.

## Verification handoff
C: telegram-api + threaded-lifecycle + full notifications regression + check:types + biome + diff-check.
D: 10.031 stays OPEN; residual (phase 42) = route→ask-bridge injection + shutdown delete hook.
