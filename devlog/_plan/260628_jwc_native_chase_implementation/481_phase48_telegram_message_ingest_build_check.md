# 481 Phase 48 build+check — Telegram free-text message ingest (chase 10.032 gate 3)

> Audit `480` PASS (Backend employee process disconnected pre-verdict at exit=1; equivalent
> direct-evidence self-audit completed against the button-ingest precedent). Boss-direct build.

## Changes
### NEW `packages/coding-agent/src/notifications/telegram-message-ingest.ts` (~120 lines)
- `extractTelegramTextMessage(update) → TelegramTextMessage | null` — safe loose-typed extraction
  (`message.message_id` / `.text` / `.from.id` / `.chat.id` / `.message_thread_id`); null for
  non-message / no-text / missing id. Same `asRecord`/`readString`/`readNumber` helpers as the button path.
- `decideTelegramMessageInbound({update, presentedToken?, context?}) → TelegramMessageDecision`:
  `not_a_text_message` / `empty_text` / **`no_active_ask`** ignores, else
  `decideRemoteAnswer(kind:"free_text", idempotencyKey:`tg-msg:${messageId}`)` →
  `accepted` (ack messageId + answer + contextPatch) / `rejected` (ack messageId + reason).
- Pure / side-effect-free; token/chat/session never embedded or echoed.

### MODIFY `src/notifications/index.ts` — `export * from "./telegram-message-ingest"`.

### Tests `test/notifications-telegram-message-ingest.test.ts` (13)
extract: callback_query → null, no-text photo → null, missing id → null, well-formed extract.
decide: non-text ignore; whitespace → empty_text; no context → no_active_ask; allowFreeText accept
(ack 555, kind free_text, source telegram, trimmed value, idempotencyKey `tg-msg:555`); allowFreeText:false
→ free_text_not_allowed; unauthorized token → unauthorized; answeredBy set → already_answered; redelivered
identical message → idempotent accept; redelivered id w/ different value → idempotency_conflict.

## Verification (C)
- new suite → 13 pass / 0 fail.
- full `bun test test/notifications-*.test.ts test/notify-cli.test.ts` → **170 pass / 0 fail / 500 expect()**
  across 29 files.
- `bun run check:types` exit 0; `bunx biome check` clean; `git diff --check` exit 0.

## 10.032 status
Gate 3 (free-text/custom answer satisfies an active ask where allowed) → **met**; gate 7 idempotent
mapped-session ack extended to the free-text path. Card still OPEN: live daemon-loop dispatch of
callback/message decisions + `answerTelegramCallbackQuery` / `sendForumTopicMessage` ack side effects,
and local-vs-remote race resolution against a live ask gate, remain (later integration phase).
