# 383 Phase 38 check — managed daemon engine

> All gates green. Card 10.030 remains OPEN (slice 2 of 3 done).

## Tests
- `notifications-daemon-engine.test.ts` → 6 pass / 21 expect().
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **95 pass / 0 fail / 341 expect()** across 18 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` (3 files) → clean (2 auto-formatted);
  `git diff --check` → exit 0.

## 10.030 progress
- ✅ slice 1 (phase 37): poll/send client + owner-claim.
- ✅ slice 2 (this): `runDaemonTick` engine — ownership + heartbeat + scan + poll + offset/backoff.
- ⬜ slice 3 (phase 39): OS process spawn + owner-scoped reload/stop + compiled smoke → closes 10.030.
