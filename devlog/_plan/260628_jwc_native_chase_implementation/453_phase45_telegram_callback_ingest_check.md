# 453 Phase 45 check — Telegram callback ingestion + ack

> All gates green. Card 10.032 advanced (end-to-end button path + button ack); stays OPEN.

## Tests
- `notifications-telegram-callback-ingest.test.ts` → **13 pass / 0 fail / 21 expect()**: extract
  null/malformed/well-formed; ignore non-callback + empty-data; accept valid button → canonical value
  + callbackQueryId; reject out-of-range (`invalid_button_value`); no-context (`stale_action`); wrong
  token (`unauthorized`); replay conflict (`idempotency_conflict`); already-answered; answerCallbackQuery
  method/query + token sanitize.
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **144 pass / 0 fail / 443 expect()** across 26 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## Card 10.032 status — OPEN (advanced)
Done across phases 44+45: gate 5 (no double-numbering), full button path (render → ingest → resolve →
decideRemoteAnswer) and button ack. Still open: live daemon-loop wiring (poll→ingest→forward→ack),
assistant lead-in ordering, redaction policy for ask question/options, verbosity/redact commands,
free-text activity/double-check acks. Card remains OPEN.
