# 452 Phase 45 build — Telegram callback ingestion + ack

> Boss-direct build after audit `451` PASS. Completes the end-to-end button decision path. Card OPEN.

## Changes
### MODIFY `packages/coding-agent/src/notifications/telegram-api.ts`
- `answerTelegramCallbackQuery({token, callbackQueryId, text?, fetchImpl?}) → TelegramCallOutcome<true>`
  — method `answerCallbackQuery`; token-safe via existing `sanitize`.

### NEW `packages/coding-agent/src/notifications/telegram-callback-ingest.ts` (~135 lines, pure)
- `extractTelegramCallbackQuery(update) → TelegramCallbackQuery | null` — safe structural read
  (id/data/fromId/chatId/messageThreadId); null for non-callback / malformed updates.
- `decideTelegramCallbackInbound({update, presentedToken, context}) → TelegramCallbackDecision`
  - no callback → `ignore:not_a_callback`; no data → `ignore:empty_callback_data`.
  - no context → `rejected:stale_action` (+callbackQueryId).
  - `resolveAskButtonAnswer` against `context.allowedValues`; failure → `rejected:invalid_button_value`.
  - else `decideRemoteAnswer` (token auth + session/action + idempotency, owned by remote-answer.ts) →
    `accepted{answer,contextPatch}` or `rejected{reason}`; always surfaces `callbackQueryId` for ack.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export telegram-callback-ingest.

## Verification handoff
C: callback-ingest suite + full notifications regression + check:types + biome + diff-check.
