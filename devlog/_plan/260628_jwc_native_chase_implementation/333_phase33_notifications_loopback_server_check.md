# 333 Phase 33 check — notifications loopback server verification

> All gates green.

## Tests

- New transport suite: `bun test test/notifications-server.test.ts` → **7 pass / 0 fail / 27 expect()**.
- Full notifications regression: `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **60 pass / 0 fail / 233 expect()** across 12 files (no regression from prior 53).

## Static analysis

- `bun run check:types` (`tsgo -p tsconfig.json --noEmit`) → **exit 0**.
- `bunx biome check src/notifications/server.ts src/notifications/index.ts test/notifications-server.test.ts`
  → clean (1 import auto-formatted).
- `git diff --check` → exit 0.

## Done-gate coverage (card 10.028)

| Gate | Status at transport level |
|---|---|
| equivalent module with protocol + loopback server | ✅ `server.ts` (`Bun.serve` WS) |
| writes `.jwc/state/notifications/<id>.json`, masked/no-log token | ✅ `0600` record; token never logged |
| missing/wrong token rejected at connect | ✅ 401 at upgrade (test) |
| `action_needed` answered remotely → `action_resolved` | ✅ test |
| local answer wins race; later remote reply rejected | ✅ test (`already_answered`) |
| discovery files removed on shutdown | ✅ `stop()` removes file (test) |

Remaining before `10.028` _fin: wire `start()`/`stop()` into the live `sdk.ts` session
lifecycle (next work-phase). Transport unit is complete and verified.
