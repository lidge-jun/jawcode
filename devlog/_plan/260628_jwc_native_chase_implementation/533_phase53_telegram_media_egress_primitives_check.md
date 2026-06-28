# 533 Phase 53 check — media egress primitives

Gates green for pass 1. Card 10.034 remains OPEN (phase 54 closes it).

## Tests
- `notifications-telegram-media-policy.test.ts` → 7 pass; `notifications-telegram-api.test.ts` media
  block → 3 pass (12 + media in that file).
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **224 pass / 0 fail / 621 expect()** across 33 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## 10.034 done-gate progress
| gate | status |
|---|---|
| outbound image/file frames → sendPhoto/sendDocument | network half DONE (senders); render mapper → ph54 |
| `telegram_send` only when Telegram connected | ph54 |
| absolute/relative/symlink path escape rejected | DONE (confinement, ph4) |
| directories/missing files rejected | DONE (confinement, ph4) |
| inbound media routing paired-chat/known-topic only | ph54 |
| size/MIME policy documented or deferred | DONE + now ENFORCED (`classifyTelegramMedia`) |

Next (phase 54): outbound frame render mapper (frame → policy → sender), connection-gated `telegram_send`
tool, inbound media classifier (paired-chat/known-topic, fail-closed) → close 10.034.
