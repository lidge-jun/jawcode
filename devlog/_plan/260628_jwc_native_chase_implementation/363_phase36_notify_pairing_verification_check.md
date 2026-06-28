# 363 Phase 36 check — notify pairing verification

> All gates green; `10.029` done-gates fully met.

## Tests
- `notifications-telegram-pairing.test.ts` → 5 pass.
- `notify-cli.test.ts` → 6 pass (incl. 2 new verify accept/reject).
- `notifications-docs.test.ts` → 5 pass (incl. private-chat-only + Threaded Mode).
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts test/tools/ask.test.ts`
  → **112 pass / 0 fail / 446 expect()** across 16 files.

## Static analysis
- `bun run check:types` → exit 0.
- `bun run check:schemas` → exit 0 (no schema change).
- `bunx biome check` on 7 changed files → clean.
- `git diff --check` → exit 0.

## 10.029 done-gate — ALL MET
| Gate | Evidence |
|---|---|
| `jwc notify status` masked output | phase 1 (status test) |
| `jwc notify setup --token --chat-id` writes + masks | phase 1 (setup test) |
| interactive setup rejects group/supergroup/channel | `verifyTelegramPairing` + `verify` reject test |
| Threaded Mode capability labeled verified/unverified/unknown | `verifyTelegramPairing` + verify label |
| `JWC_NOTIFICATIONS=0` hard opt-out | config.ts (notifications-config "hard opt-out wins") |
| docs: private-chat-only + Threaded Mode fallback | `docs/telegram-onboarding.md` + docs test |

→ Card `10.029` closes to `_fin/10`.
