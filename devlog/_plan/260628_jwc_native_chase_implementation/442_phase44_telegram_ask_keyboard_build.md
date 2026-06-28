# 442 Phase 44 build — Telegram ask inline keyboard

> Boss-direct build after audit `441` PASS. Advances card 10.032 (gate 5 + button half of gate 1).
> Card stays OPEN.

## Changes
### NEW `packages/coding-agent/src/notifications/telegram-ask-keyboard.ts` (~150 lines)
- `TELEGRAM_CALLBACK_DATA_MAX_BYTES = 64`; prefix `jwc1`.
- `buildAskInlineKeyboard({options, nonce, columns?}) → InlineKeyboard`
  - button `text` = `stripTelegramOptionPrefix(label)` + 120-char clamp (gate 5, no double-numbering).
  - `callback_data = jwc1:<index>:<nonce>`; throws `callback_data_too_large` when >64 bytes
    (fail fast — never truncate routing identity), `ask_keyboard_empty_nonce` on empty nonce.
  - `columns` lays out N buttons per row (default 1).
- `decodeAskCallbackData(data) → {ok,decoded:{index,nonce}} | {ok:false,code:"invalid_callback"}`
  - validates prefix, numeric index, non-empty nonce, ≤64 bytes. Nonce may contain `:`.
- `resolveAskButtonAnswer({callbackData, allowedValues}) →
   {ok:true,value,index,nonce} | {ok:false,reason:"invalid_button_value"}`
  - decode → bounds-check index against `allowedValues` → canonical option value.
  - reason aligns with `RemoteAnswerRejectionReason` for direct `decideRemoteAnswer` feed.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export telegram-ask-keyboard.

## Verification handoff
C: ask-keyboard suite + full notifications regression + check:types + biome + diff-check.
