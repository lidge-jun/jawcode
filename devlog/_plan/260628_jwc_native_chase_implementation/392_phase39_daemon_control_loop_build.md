# 392 Phase 39 build — daemon control + loop driver

> Boss-direct build after audit `391` NARROW/PASS. Card 10.030 stays OPEN (spawn entrypoint = phase 40).

## Changes
### NEW `packages/coding-agent/src/notifications/daemon-control.ts` (~80 lines)
- `DaemonControlRequest {version:1, kind:'stop'|'reload', targetOwnerId, requestedAt}`;
  `daemonControlPath` (`<agentDir>/notifications/telegram/control.json`); `read/write/clear` (0600
  atomic write+rename+chmod, ENOENT-safe clear; mirrors the private transport-state pattern).
- `decideDaemonControl({current, request})`: no-request / no-owner / owner-mismatch / stale-request →
  ignore; else honor stop/reload. Owner-scoped — never clears a newer owner.

### NEW `packages/coding-agent/src/notifications/daemon-loop.ts` (~55 lines)
- `runDaemonLoop({tick, sleep, readControl, readOwner, clearControl, onStop?, baseIntervalMs?,
  maxTicks?})`: read control+owner before each tick → honor-stop (`onStop`, return `stopped`) /
  honor-reload (return `reloaded`) / else `tick()` + sleep `poll.backoffMs ?? baseInterval`. Injectable;
  `maxTicks` bounds finite runs. No real timers/spawn.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export both.

### Tests
- `notifications-daemon-control.test.ts` (6): decide branches + file I/O round-trip/0600/idempotent clear.
- `notifications-daemon-loop.test.ts` (4): max-ticks + base sleep; stop-before-tick + onStop; reload; poll backoff sleep.

## Verification handoff
C: both suites + full notifications regression + check:types + biome + diff-check.
D: 10.030 stays OPEN; residual recorded for phase 40 (CLI spawn entrypoint + live smoke).
