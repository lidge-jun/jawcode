# 362 Phase 36 build — notify pairing verification + onboarding docs

> Boss-direct build after audit `361` PASS. Closes the last 3 `10.029` done-gates.

## Changes

### NEW `packages/coding-agent/src/notifications/telegram-pairing.ts` (~70 lines)
`verifyTelegramPairing({token, chatId, fetchImpl?})` GETs Telegram `getChat`:
- `ok = chatType === "private"` (group/supergroup/channel rejected fail-closed);
- `threadedMode` from `is_forum` → verified / unverified / unknown;
- Telegram `{ok:false}` or fetch throw → `{ok:false, chatType:"unknown", threadedMode:"unknown", reason}`.
- **Token safety**: every text put in `reason` is sanitized (`token → ***`); token never logged/printed.

### MODIFY `packages/coding-agent/src/cli/notify-cli.ts` (~30 lines)
- `NotifyAction` += `"verify"`; `NotifyCommandArgs` += optional `fetchImpl`.
- `verify` branch requires `--token`+`--chat-id`, calls `verifyTelegramPairing`, prints
  `Pairing: accepted/rejected` + `Threaded Mode: <label>` (masked chatId, no token), throws on non-private.

### MODIFY `packages/coding-agent/src/commands/notify.ts`
`ACTIONS` += `"verify"`.

### MODIFY `packages/coding-agent/src/notifications/index.ts`
`export * from "./telegram-pairing"`.

### MODIFY `docs/telegram-onboarding.md`
Appended "Pairing verification (private chat only)" section: `jwc notify verify`, private-chat-only
rejection, Threaded Mode labels + runtime fallback, token-never-logged, `JWC_NOTIFICATIONS` precedence.

### Tests
- NEW `notifications-telegram-pairing.test.ts` (5): private accept; group/supergroup/channel reject
  without token leak; is_forum verified/unverified; Telegram error sanitizes token; fetch throw → unknown.
- `notify-cli.test.ts` (+2): verify accepts private + labels threaded mode (no token leak); rejects non-private.
- `notifications-docs.test.ts` (+1): doc documents private-chat-only pairing + Threaded Mode.

## Verification handoff
C: new + full notifications/notify/docs/ask suites + `check:types` + `check:schemas` + biome + diff-check.
D: close `10.029` to `_fin` (all 6 gates met).
