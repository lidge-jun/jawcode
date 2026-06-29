# 373 Phase 37 check — Telegram poll client + owner-claim

> All gates green. Card 10.030 remains OPEN (slice 1 of 3).

## Tests
- `notifications-telegram-api.test.ts` → 7 pass; `notifications-daemon-owner.test.ts` → 6 pass (13 total).
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **89 pass / 0 fail / 320 expect()** across 17 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` (5 files) → clean (2 auto-formatted);
  `git diff --check` → exit 0.

## 10.030 progress
- ✅ slice 1 (this): Telegram poll/send client + owner-claim decision (testable cores).
- ⬜ phase 38: managed daemon engine (scan roots → connect endpoints → poll loop via client + owner-claim), in-process testable.
- ⬜ phase 39: process spawn + reload/stop owner-scoped control + compiled smoke → closes 10.030.
