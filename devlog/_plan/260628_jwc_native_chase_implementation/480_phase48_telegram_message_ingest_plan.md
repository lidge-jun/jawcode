# 480 Phase 48 plan — Telegram free-text message ingest (chase 10.032 gate 3)

> Work-phase 48 of the 10.032 stack. Closes the **free-text answer** done-gate by wiring inbound
> Telegram text messages into the already-tested `decideRemoteAnswer(kind:"free_text")` race/idempotency
> layer — the exact mirror of phase 45's button path (`telegram-callback-ingest.ts`).

## Gap
`decideRemoteAnswer` already decides `free_text` answers (allowFreeText gate, `empty_free_text`,
idempotency, race) and is unit-tested. The **button** inbound path has a pure ingest decider
(`decideTelegramCallbackInbound` + `extractTelegramCallbackQuery`). The **free-text** inbound path has
no equivalent: `forwardTelegramReplyToSession` (phase 42) injects raw text as a session turn message
but never routes it through the remote-answer race/idempotency/ack layer. So an in-topic free-text
reply cannot *answer a pending ask* with dedupe + ack. Gate 3 + free-text ack remain open.

## Slice (C2 — single new pure module + tests, mirrors tested precedent)
### NEW `src/notifications/telegram-message-ingest.ts`
- `TelegramTextMessage { messageId, text, fromId?, chatId?, messageThreadId? }`.
- `extractTelegramTextMessage(update): TelegramTextMessage | null` — safe loose-typed extraction
  (`update.message.text`, `from.id`, `chat.id`, `message_thread_id`, `message_id`); null for non-text.
- `decideTelegramMessageInbound({update, presentedToken?, context?}): TelegramMessageDecision`:
  - no text message → `{mode:"ignore", reason:"not_a_text_message"}`
  - empty/whitespace text → `{mode:"ignore", reason:"empty_text"}`
  - **no active ask context → `{mode:"ignore", reason:"no_active_ask"}`** (free text without a pending
    ask is an ordinary reply for the caller to forward via reply-bridge — NOT an answer; this is the
    deliberate divergence from the button path, where a tap always implies an ask → `stale_action`).
  - else `decideRemoteAnswer({kind:"free_text", idempotencyKey:`tg-msg:${messageId}`, value:text, ...},
    context)` → `accepted` (ack `messageId` + answer + contextPatch) / `rejected` (ack `messageId` +
    reason). Per-message idempotency key makes a redelivered Telegram update a safe no-op.
- Pure / side-effect-free; token/chat/session never embedded or echoed. ≤120 lines.

### `src/notifications/index.ts` — `export * from "./telegram-message-ingest"`.

### Tests `test/notifications-telegram-message-ingest.test.ts`
non-text (callback_query) → ignore; whitespace → empty_text; text + no context → no_active_ask;
allowFreeText accepted (ack id, kind free_text, normalized value); allowFreeText:false →
free_text_not_allowed; redelivered same messageId+value → accepted again (idempotency replay); context
answeredBy set → already_answered; bad token → unauthorized.

## Done-gate mapping (10.032)
Closes **gate 3** (free-text/custom answer satisfies an active ask where allowed) and extends **gate 7**
(idempotent, mapped-session-scoped acks) to the free-text path. Does NOT yet close the card: live
daemon-loop dispatch of callback/message decisions + `answerTelegramCallbackQuery`/sendMessage acks
remain a later integration phase.

## Verification
`bun test` the new suite + full `test/notifications-*.test.ts test/notify-cli.test.ts`;
`bun run check:types`; biome; `git diff --check`. Independent CLI sub-agent audit before B.
