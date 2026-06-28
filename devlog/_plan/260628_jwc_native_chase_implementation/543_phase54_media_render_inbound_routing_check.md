# 543 Phase 54 check — media render + inbound media routing

Gates 1 + 5 green. Card 10.034 remains OPEN (phase 55 closes via gate 2 tool).

## Tests
- `notifications-telegram-media-render.test.ts` → 5 pass; `notifications-threaded-surface.test.ts`
  media block → 5 new pass.
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **234 pass / 0 fail / 637 expect()** across 34 files.

## Static analysis
- `bun run check:types` → exit 0 (fixed a downstream union-narrow in telegram-inbound-router.ts);
  `bunx biome check` → clean; `git diff --check` → exit 0.

## 10.034 done-gate status
| gate | status |
|---|---|
| outbound image/file frames → sendPhoto/sendDocument | DONE (`renderAndSendTelegramMedia` + senders) |
| `telegram_send` only when Telegram connected | phase 55 |
| absolute/relative/symlink path escape rejected | DONE (confinement, ph4) |
| directories/missing files rejected | DONE (confinement, ph4) |
| inbound media routing paired-chat/known-topic only | DONE (`route_media`, fail-closed) |
| size/MIME policy documented or deferred | DONE + ENFORCED (ph53) |

Only gate 2 remains: a connection-gated, workspace-confined `telegram_send` tool that composes the
confinement helper + `renderAndSendTelegramMedia`. Phase 55 builds it and closes 10.034.
