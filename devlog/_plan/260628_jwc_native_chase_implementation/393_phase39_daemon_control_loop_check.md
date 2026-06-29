# 393 Phase 39 check — daemon control + loop driver

> All gates green. Card 10.030 remains OPEN (behavioral core complete; spawn entrypoint = phase 40).

## Tests
- `notifications-daemon-control.test.ts` → 6 pass; `notifications-daemon-loop.test.ts` → 4 pass (10 total).
- Full regression `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **105 pass / 0 fail / 359 expect()** across 20 files.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` (5 files) → clean (3 auto-formatted);
  `git diff --check` → exit 0.

## 10.030 behavioral done-gates (all met in tested logic)
| Gate | Phase |
|---|---|
| one fresh owner per token/chat | 2 roots + 37 claim + 38/39 loop |
| no second poller while owner pid live | 37 `decideOwnerClaim` defer |
| reload/stop owner-scoped, no newer-owner clobber | 39 `decideDaemonControl` |
| endpoint connect within scan interval | 38 tick scan each loop |
| poller survives transient errors, bounded backoff | 38 backoff + 39 loop |
| fingerprinting, no secret logs | 2 `fingerprintSecret` |

## Residual (phase 40, card stays open)
- Detached OS-process launch / hidden `jwc notify daemon-internal` (or public `jwc daemon`) entrypoint
  that wires `runDaemonLoop` to real I/O + `setTimeout` sleep, plus a compiled daemon smoke test.
- Open product decision: public `jwc daemon` CLI vs internal-only.
