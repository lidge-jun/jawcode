# 440 Phase 44 plan — Telegram ask inline keyboard (card 10.032, split 2)

> Card `10.032` has 7 done-gates and 5 suggested splits. Phase 3 already built the **policy layer**
> (`remote-answer.ts` decide/idempotency/race + `transport-shell.ts` inbound mapping). Phase 42
> (`reply-bridge.ts`) covers the **free-text** forward path. This phase delivers **split 2: Telegram
> inline-keyboard rendering + callback decoding** — the button rendering half of done-gate 1 and all of
> done-gate 5 (no double-numbered labels). It does NOT close the card.

## Problem / correctness driver
Telegram `callback_data` is hard-limited to **1–64 bytes**. The existing `buildTelegramCallbackPayload`
(256-byte JSON, prefix `jwc:v1:`) is for the WS loopback protocol, NOT Telegram `callback_data` — it
would overflow the 64-byte API limit. So the button path needs a Telegram-correct compact encoding,
where the full option value is resolved server-side against the active action's `allowedValues`.

## Slice (pure, side-effect free)
NEW `packages/coding-agent/src/notifications/telegram-ask-keyboard.ts`:
- `TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64`, prefix `jwc1`.
- `buildAskInlineKeyboard({ options, nonce, columns? }) → InlineKeyboard`
  - one button per option; `text` = `stripTelegramOptionPrefix(label)` (avoids double-numbering, gate 5),
    display text clamped to a safe length.
  - `callback_data = jwc1:<index>:<nonce>` (compact); throws `callback_data_too_large` if a row's
    callback_data would exceed 64 bytes (i.e. nonce too long) — fail fast, never silently truncate
    routing identity.
  - default one button per row; `columns` lays out N per row.
- `decodeAskCallbackData(data) → { ok:true; index; nonce } | { ok:false; code:"invalid_callback" }`.
- `resolveAskButtonAnswer({ callbackData, allowedValues }) →
   { ok:true; value; index; nonce } | { ok:false; reason:"invalid_button_value" }`
  - decode → bounds-check index against `allowedValues` → return the canonical option value.
  - out-of-range / decode failure → `invalid_button_value` (matches `RemoteAnswerRejectionReason`).
- Barrel export from `index.ts`.

Caller wiring (LATER split, not this phase): inbound `callback_query` → `resolveAskButtonAnswer` →
build `RemoteAnswerInput{kind:"button"}` → `decideRemoteAnswer` → `forwardTelegramReplyToSession`.

## Tests — `notifications-telegram-ask-keyboard.test.ts`
1. builds one button per option; labels are stripped (no `1.`/`2)` prefixes) — gate 5.
2. callback_data round-trips through `decodeAskCallbackData` (index + nonce preserved).
3. every callback_data ≤ 64 bytes for a realistic option set.
4. oversized nonce → throws `callback_data_too_large` (fail fast).
5. `columns` layout groups buttons per row.
6. `resolveAskButtonAnswer` maps a valid callback to the canonical `allowedValues` entry.
7. out-of-range index / malformed callback → `invalid_button_value`.

## Verification
`bun test test/notifications-telegram-ask-keyboard.test.ts` + full notifications regression +
`bun run check:types` + biome + `git diff --check`.

## Scope guard (NOT in this phase, remain open on 10.032)
Live callback_query ingestion + answerCallbackQuery ack, assistant lead-in ordering, redaction policy
for ask question/options, verbosity/redact commands, activity/double-check acks, full remote ask
lifecycle. Card stays OPEN.
