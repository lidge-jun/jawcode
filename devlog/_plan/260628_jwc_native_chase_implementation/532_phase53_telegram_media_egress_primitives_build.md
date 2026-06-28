# 532 Phase 53 build — media egress primitives

Built after audit `531` PASS. 10.034 pass 1 of 2 (does NOT close the card).

## Changes
### NEW `src/notifications/telegram-media-policy.ts` (~60 ln)
`classifyTelegramMedia({fileName, sizeBytes, declaredMime?})` → `{ok, method:"sendPhoto"|"sendDocument"}`
| `{ok:false, reason:"empty_file"|"too_large"}`. Caps `TELEGRAM_PHOTO_MAX_BYTES` (10 MB) /
`TELEGRAM_DOCUMENT_MAX_BYTES` (50 MB). Photo exts {jpg,jpeg,png,webp}; extension-only routing; declared
MIME advisory.

### MODIFY `src/notifications/telegram-api.ts`
- `telegramMultipartCall<T>()` — POST `FormData` variant of `telegramCall`, same token sanitization and
  `classifyTelegramError` handling.
- `sendTelegramPhoto` / `sendTelegramDocument` (`SendTelegramFileOptions`: token, chatId, data:Uint8Array,
  fileName, caption?, messageThreadId?, fetchImpl?, signal?) — build multipart form (chat_id, optional
  message_thread_id, optional caption, file Blob+filename) and upload. Token-safe.

### MODIFY `src/notifications/index.ts` — export telegram-media-policy.

### Tests
- NEW `test/notifications-telegram-media-policy.test.ts` (7): png→photo, uppercase ext, oversize
  photo→document, pdf→document, >cap→too_large, 0 bytes→empty_file, declared-MIME-not-trusted.
- EXTEND `test/notifications-telegram-api.test.ts` (3): document multipart POST shape (chat/thread/
  caption/file fields), photo omits unset optionals, error reason sanitizes the bot token.

## Verification handoff
C: telegram suite + full notifications regression + check:types + biome + diff-check. Card stays open;
phase 54 adds render mapper + connection-gated tool + inbound routing, then closes 10.034.
