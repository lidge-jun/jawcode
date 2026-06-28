# 443 Phase 44 check — Telegram ask inline keyboard

> All gates green. Card 10.032 advanced (gate 5 + button-render half of gate 1); stays OPEN.

## Tests
- `notifications-telegram-ask-keyboard.test.ts` → **10 pass / 0 fail / 35 expect()**: strip numbering;
  index+nonce round-trip; all callback_data ≤64 bytes for a 36-char UUID nonce over 12 options;
  fail-fast overflow throw; empty-nonce throw; column layout; decode rejections; resolve→canonical
  value; out-of-range + malformed → `invalid_button_value`.
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **131 pass / 0 fail / 422 expect()** across 25 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## Card 10.032 status — OPEN (advanced, not closed)
Done this phase: gate 5 (no double-numbered labels), button-render half of gate 1. Still open: live
`callback_query` ingestion + `answerCallbackQuery` ack, local-vs-remote race wiring, assistant lead-in
ordering, redaction policy for ask question/options, verbosity/redact commands, activity/double-check
acks, full remote ask lifecycle. Card remains OPEN.
