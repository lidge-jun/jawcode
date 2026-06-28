# 360 Phase 36 plan — notify pairing verification + onboarding docs (closes 10.029)

> Work-phase 36 = the remaining `10.029` done-gates: (3) reject non-private Telegram pairing,
> (4) label Threaded Mode capability verified/unverified/unknown, (6) onboarding docs. Phase 1 already
> shipped `jwc notify status/setup`, masked config, schema, and `JWC_NOTIFICATIONS=0` opt-out.
> Risk class: **C3** with security review (token handling) — token must stay masked / never logged.

## Part 1 — plain explanation

`jwc notify setup` currently stores Telegram settings without checking that the chat is a private DM
or whether forum topics (Threaded Mode) are available. This phase adds a fetch-based verification
(mockable, no live token needed) that confirms the paired chat is private and labels Threaded Mode
capability, exposes it via `jwc notify verify`, and adds the onboarding doc explaining
private-chat-only pairing and the BotFather Threaded Mode fallback.

## Part 2 — diff-level plan

### 1. NEW `packages/coding-agent/src/notifications/telegram-pairing.ts` (~60 lines, unit-tested)
```ts
export type ThreadedModeCapability = "verified" | "unverified" | "unknown";
export interface TelegramPairingResult {
  ok: boolean;                 // accepted only when chatType === "private"
  chatType: string;            // "private" | "group" | "supergroup" | "channel" | "unknown"
  threadedMode: ThreadedModeCapability;
  reason?: string;             // rejection / error explanation (token never included)
}
export async function verifyTelegramPairing(opts: {
  token: string; chatId: string; fetchImpl?: typeof fetch;
}): Promise<TelegramPairingResult>;
```
- GETs `https://api.telegram.org/bot<token>/getChat?chat_id=<chatId>` via injected `fetchImpl`.
- `chatType = result.type ?? "unknown"`; `ok = chatType === "private"`.
- `threadedMode`: `result.is_forum === true` → verified; `=== false` → unverified; else unknown.
- Telegram `{ok:false,...}` or network/throw → `{ok:false, chatType:"unknown", threadedMode:"unknown",
  reason}` (reason text must NOT contain the token).

### 2. MODIFY `packages/coding-agent/src/cli/notify-cli.ts` (~30 lines)
- Add `"verify"` to `NotifyAction`; in `runNotifyCommand`, a `verify` action requires `--token` +
  `--chat-id`, calls `verifyTelegramPairing`, prints chat-type acceptance + `Threaded Mode: <label>`,
  and exits non-zero / throws when `!ok` (rejecting group/supergroup/channel). Token masked in output.
- `fetchImpl` injectable through `NotifyCommandArgs` for tests (default global `fetch`).
- Existing `status`/`setup` paths unchanged.

### 3. MODIFY `packages/coding-agent/src/commands/notify.ts`
Register the `verify` subcommand mapping (mirror `setup`). (Re-read exact shape in B.)

### 4. NEW `docs/telegram-onboarding.md` (gate 6)
Explains: private-chat-only pairing (group/supergroup/channel rejected), BotFather token setup,
`jwc notify setup`/`verify`, Threaded Mode capability labels + runtime fallback, `JWC_NOTIFICATIONS`
precedence. JWC names; `GJC_*` only as a compatibility citation.

### 5. NEW export in `notifications/index.ts` for telegram-pairing.

### Tests
- NEW `test/notifications-telegram-pairing.test.ts`: private → ok + threadedMode from is_forum;
  supergroup/channel/group → !ok with reason (no token leak); Telegram `{ok:false}` and fetch throw →
  unknown; threadedMode verified/unverified/unknown branches.
- `test/notify-cli.test.ts` (+): `verify` action prints acceptance + Threaded Mode label and rejects
  non-private (mock `fetchImpl`); token never appears in output.
- NEW `test/telegram-onboarding-docs.test.ts`: doc exists, uses `jwc` names, no raw token/secret,
  mentions private-chat-only + Threaded Mode fallback.

## PABCD
- **A**: independent audit (security-focused) — confirm commands/notify.ts wiring shape, Settings/CLI
  arg flow, token never logged in verify output or reason, fetch injection testable, getChat field
  names (`type`, `is_forum`).
- **B**: Boss writes pairing module + CLI verify + docs + tests; re-read commands/notify.ts first.
- **C**: pairing + notify-cli + docs tests + full notifications suite + `check:types` + `check:schemas`
  (if schema untouched, still run) + biome + diff-check.
- **D**: close `10.029` to `_fin` (all 6 gates met) — move card, update follow-index/MOC/gap-inventory/
  INDEX (30→31).

## Constraints
- Token: masked in all output; never in logs or `reason`. Private-chat-only fail-closed.
- Fetch injected for tests; no live token. JWC names; ES modules; files ≤400 lines.
