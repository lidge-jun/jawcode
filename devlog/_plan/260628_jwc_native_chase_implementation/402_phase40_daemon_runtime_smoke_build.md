# 402 Phase 40 build — runnable managed daemon + smoke

> Boss-direct build after audit `401` PASS (closeable). Closes 10.030.

## Changes
### NEW `packages/coding-agent/src/notifications/daemon-runtime.ts` (~70 lines)
`runManagedDaemon(options)` wires `runDaemonLoop` with real I/O: a `tick` closure carrying `pollState`
→ `runDaemonTick` (identity + fetchImpl, default real owner/scan/poll), `readControl`/`readOwner`/
`clearControl` bound to the daemon-control/transport-state readers, `onStop` →
`markTransportOwnerStopped` + `writeTransportOwner`. Defaults: `setTimeout` sleep, `process.pid`,
`Date.now`. `sleep`/`fetchImpl`/`now`/`maxTicks` injectable.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export daemon-runtime.

### NEW `test/notifications-daemon-runtime.test.ts` (3 smoke, mocked fetch + no-op sleep + temp agentDir):
single-owner bounded run (owner written, heartbeat); two-daemons-one-owner (d2 defers, owner stays d1);
owner-scoped stop control → outcome `stopped`, owner `stoppedAt` set.

## Verification handoff
C: smoke + full notifications regression + check:types + biome + diff-check. D: close 10.030 to _fin.
