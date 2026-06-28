# 511 Phase 51 build+check — wire inbound routing into runDaemonTick (chase 10.032)

> Plan `510`. Independent plan audit PASS (no blocking; presentedToken=session-token correctness + safety
> confirmed, runDaemonTick optional field backward-compatible, resolveTargetSession mirrors router).

## Changes
### `src/notifications/daemon-inbound.ts`
- `resolveTargetSession(update, registry, chatFp)` — read-only chat/topic resolution (no dedupe side
  effect) for callback + message updates; picks the session whose token/context the daemon presents.
- `processInboundUpdates(opts)` — pre-loads each mapped session's discovery record once per tick
  (`buildRemoteActionContextFromRecord` resolves the router's sync `resolveActionContext` seam), then
  routes every update with a per-update `presentedToken` = that session's connect token, and executes via
  injected effects. Never throws.

### `src/notifications/daemon-engine.ts`
- `RunDaemonTickOptions.inbound?: DaemonInboundConfig` (registry/effects/dedupe/optional loadRecord) and
  `DaemonTickResult.inbound?`. On a successful poll WITH updates AND inbound config, runs
  `processInboundUpdates` (loadRecord defaults to `readNotificationDiscoveryRecord(agentDir, sid)`).
  Backward-compatible: absent config => offset-only polling, unchanged.

### `src/notifications/daemon-runtime.ts`
- `RunManagedDaemonOptions.inbound?` threaded into every `runDaemonTick` call (no dead code).

## Verification
- `bun test` daemon-inbound + daemon-engine + daemon-runtime + telegram-inbound-router → **42 pass / 0 fail**
  (new: 4 resolveTargetSession, 4 processInboundUpdates, 2 runDaemonTick inbound/backward-compat).
- Full `bun test test/notifications-*.test.ts test/notify-cli.test.ts` → **205 pass / 0 fail / 566 expect()**
  across 31 files.
- `bun run check:types` exit 0; `bunx biome check` clean; `git diff --check` clean.

## Result
The daemon's remote-answer inbound path is live end-to-end through `runDaemonTick`: poll -> route (phase 49)
-> decode button via published options (phase 50 bridge) / forward free-text -> execute (ack + forward to
the mapped session) -> session resolves authoritatively (phases 44-48). 10.032 done-gates met pending an
independent closure audit.
