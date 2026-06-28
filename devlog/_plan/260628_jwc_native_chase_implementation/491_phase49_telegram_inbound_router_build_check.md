# 491 Phase 49 build+check — Telegram inbound dispatch router (chase 10.032 gates 1/2)

> Audit `490` PASS (independent Backend employee, persisted to auditStatus) with 2 non-blocking notes,
> both folded in: explicit callback wrong-chat fingerprint guard + `recordUpdateId` after callback dedupe.

## Changes
### NEW `packages/coding-agent/src/notifications/telegram-inbound-router.ts` (~150 lines)
`routeTelegramInboundUpdate(update, ctx) → InboundDispatchPlan` — pure composition of the tested deciders:
- **callback_query** → derive chat/thread from the callback, fingerprint-guard the chat, resolve the
  topic via `registry.findByThread`, `recordUpdateId`, `resolveActionContext`, then
  `decideTelegramCallbackInbound`. accepted ⇒ `[answer_callback accepted, deliver_answer button]`;
  rejected ⇒ `[answer_callback rejected <reason>]`.
- **text message** → adapt to `ThreadInboundUpdate`, `classifyThreadInboundUpdate` (thread→session,
  fail-closed), then `decideTelegramMessageInbound`. accepted ⇒ `[deliver_answer free_text ackMessageId]`;
  no active ask ⇒ `[forward_reply]`; rejected ⇒ `[drop <reason>]`.
- Fail-closed: foreign/missing chat or topic ⇒ silent `drop` (no ack); legit chat w/ unmapped-or-stale
  topic / no active ask ⇒ ack `rejected` (clears the spinner). No token/chat/session secret echoed.

### MODIFY `src/notifications/index.ts` — `export * from "./telegram-inbound-router"`.

### Tests `test/notifications-telegram-inbound-router.test.ts` (12)
callback: accept→ack+deliver; already_answered→ack reject; foreign chat→silent drop; unmapped topic→ack
stale_action; no context→ack stale_action; duplicate→ack duplicate_update; recordUpdateId fires once.
text: free-text accept→deliver+ackMessageId; no-context→forward_reply; allowFreeText:false→drop
free_text_not_allowed; foreign chat→drop wrong_chat; unknown topic→drop unknown_topic.

## Verification (C)
- new suite → 12 pass / 0 fail.
- full `bun test test/notifications-*.test.ts test/notify-cli.test.ts` → **182 pass / 0 fail / 512 expect()**
  across 30 files.
- `bun run check:types` exit 0; biome clean; `git diff --check` exit 0.

## 10.032 status
The deterministic live-routing seam for **gates 1 & 2** now exists (remote answer → resolve mapped ask;
duplicate/late/already-answered → rejected, never injected). Remaining for card closure: wire
`routeTelegramInboundUpdate` into `runDaemonTick` and execute the plan
(`answerTelegramCallbackQuery` + `forwardTelegramReplyToSession`), plus the live pending-action →
`RemoteActionContext` bridge (a `resolveActionContext` backed by the WS server's pending action). Next phase.
