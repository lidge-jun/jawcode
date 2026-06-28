# 403 Phase 40 check — runnable managed daemon + smoke

> All gates green. Card 10.030 CLOSED.

## Tests
- `notifications-daemon-runtime.test.ts` → 3 pass (single-owner, two-daemon-one-owner, stop).
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **108 pass / 0 fail / 367 expect()** across 21 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## 10.030 — CLOSED (slices: phase 2 + 37 + 38 + 39 + 40)
All 6 behavioral done-gates demonstrated end-to-end via `runManagedDaemon` + smoke. Monitored residual:
literal OS-detached launch / `jwc daemon` public-vs-internal CLI binary (deployment; NEW card if wanted).
