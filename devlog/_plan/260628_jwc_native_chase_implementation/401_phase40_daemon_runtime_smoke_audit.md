# 401 Phase 40 audit — runnable managed daemon (independent, read-only)

> Audits plan `400`. Verdict: **PASS, closeable:true** — closing 10.030 is justified.

## Confirmed
- `RunDaemonTickOptions` fields (agentDir/token/chatId/ownerId/pid/now/pollState?/pollTimeoutSec?/
  heartbeatTtlMs?/pidAlive?/fetchImpl? + default real I/O); `DaemonTickResult.nextPollState` carry.
- `RunDaemonLoopOptions` (tick/sleep/readControl/readOwner/clearControl/onStop?/baseIntervalMs?/maxTicks?).
- `markTransportOwnerStopped(owner, now)` + `readTransportOwner`/`writeTransportOwner` for `onStop`.
- `readDaemonControl`/`clearDaemonControl`/`writeDaemonControl` + request shape for the stop smoke.
- Smoke feasible (mocked fetch Response, injected sleep, temp agentDir, pre-written owner). No collisions.

## Closure ruling (all 6 done-gates met end-to-end)
| Gate | Met |
|---|---|
| one fresh owner per token/chat | ✅ runManagedDaemon scan+own; smoke |
| no second poller while owner live | ✅ decideOwnerClaim defer; two-daemon smoke |
| reload/stop owner-scoped, no newer clobber | ✅ decideDaemonControl; stop smoke |
| endpoint connect within scan interval | ✅ tick scans each loop |
| transient error survival, bounded backoff | ✅ engine backoff + loop |
| fingerprint, no secret logs | ✅ fingerprintSecret + token sanitize |

Phase 39 kept 10.030 open ONLY for lack of a runnable daemon — `runManagedDaemon` provides it; the
behavioral gates are demonstrable via the in-process daemon + mocked smoke. The literal OS-detached
launch / `jwc daemon` CLI binary is a deployment concern, not a behavioral done-gate → monitored
residual. **CLOSE 10.030.**
