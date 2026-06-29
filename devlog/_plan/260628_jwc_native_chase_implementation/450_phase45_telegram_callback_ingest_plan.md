# 450 Phase 45 plan — Telegram callback ingestion + ack (card 10.032, split 2/3 cont.)

> Builds on phase 44 (`telegram-ask-keyboard.ts` render + `resolveAskButtonAnswer`) and the phase-3
> policy layer (`decideRemoteAnswer`, `decideTransportInbound`). This phase bridges an inbound Telegram
> `callback_query` through decode → resolve → `decideRemoteAnswer`, and adds the `answerCallbackQuery`
> ack API. Completes the **end-to-end button decision path** (gate 1 button half + the button ack of
> gate 7). Card 10.032 stays OPEN.

## Existing pieces reused
- `resolveAskButtonAnswer({callbackData, allowedValues})` (phase 44) → canonical value + index + nonce.
- `decideRemoteAnswer(input, context)` (phase 3) → accepted/rejected with idempotency + race.
- `RemoteActionContext.allowedValues` / `expectedToken`; `RemoteAnswerInput{kind:"button"}`.
- `telegramCall` + token sanitize pattern; `TelegramCallOutcome<T>`.

## Slice
### `packages/coding-agent/src/notifications/telegram-api.ts`
- `answerTelegramCallbackQuery({token, callbackQueryId, text?, fetchImpl?}) → TelegramCallOutcome<true>`
  - method `answerCallbackQuery`, query `callback_query_id` (+ optional `text`). Token never logged
    (existing `sanitize`).

### NEW `packages/coding-agent/src/notifications/telegram-callback-ingest.ts` (pure)
- `TelegramCallbackQuery` shape (`id`, `data?`, `from.id`, `message.chat.id?`, `message.message_thread_id?`).
- `extractTelegramCallbackQuery(update) → TelegramCallbackQuery | null` — safe structural read of
  `update.callback_query`; returns null for non-callback updates or malformed shapes.
- `decideTelegramCallbackInbound({update, presentedToken, context}) → TelegramCallbackDecision`
  - no callback_query → `{mode:"ignore", reason:"not_a_callback"}`.
  - missing data → `{mode:"ignore", reason:"empty_callback_data"}`.
  - `resolveAskButtonAnswer` fails → `{mode:"rejected", reason:"invalid_button_value", callbackQueryId}`.
  - else build `RemoteAnswerInput{kind:"button", sessionId/actionId from context, idempotencyKey:nonce,
    value, presentedToken}` → `decideRemoteAnswer` → `{mode:"accepted", answer, contextPatch,
    callbackQueryId}` or `{mode:"rejected", reason, callbackQueryId}`.
  - decision always surfaces `callbackQueryId` so the caller can `answerTelegramCallbackQuery` to clear
    the button spinner (the token/chat secrets never appear in the decision).

## Tests — `notifications-telegram-callback-ingest.test.ts`
1. `extractTelegramCallbackQuery` returns null for a plain message update / malformed callback.
2. non-callback update → ignore `not_a_callback`.
3. callback without data → ignore `empty_callback_data`.
4. valid button callback (built by `buildAskInlineKeyboard`) → accepted, value resolved to
   `allowedValues`, callbackQueryId surfaced.
5. out-of-range/garbage callback_data → rejected `invalid_button_value` + callbackQueryId.
6. wrong presentedToken → rejected `unauthorized` (via decideRemoteAnswer) + callbackQueryId.
7. duplicate idempotency key replay → rejected `idempotency_conflict`/`already_answered`.
8. `answerTelegramCallbackQuery` issues the right method/query and sanitizes token on error.

## Verification
`bun test test/notifications-telegram-callback-ingest.test.ts` + full notifications regression +
`bun run check:types` + biome + `git diff --check`.

## Scope guard (still open on 10.032)
Live daemon-loop wiring (poll → ingest → forward to session → ack), assistant lead-in ordering,
redaction policy for ask question/options, verbosity/redact commands, free-text activity/double-check
acks. Card stays OPEN.
