# 382 Phase 38 build — managed daemon engine

> Boss-direct build after audit `381` PASS. Pure single tick; injected I/O; no spawn/timers.

## Changes
### NEW `packages/coding-agent/src/notifications/daemon-engine.ts` (~135 lines)
`runDaemonTick(options)` performs one daemon iteration:
1. `fingerprintSecret(token/chatId)` + `readTransportOwner` → `decideOwnerClaim`.
2. `defer` → `{owned:false, scannedSessions:0, nextPollState:pollState}` (no write).
3. `claim`/`keep` → `writeTransportOwner` a `TransportOwnerState` (heartbeatAt=now; startedAt
   preserved on keep, else now).
4. `scanTransportSessions({agentDir})` → `scannedSessions`.
5. `getTelegramUpdates({token, offset, timeoutSec, fetchImpl})`:
   - ok → `nextOffset = max(update_id)+1` (unchanged if empty), attempt reset 0;
   - retryable error → `backoffMs = nextBackoffMs(attempt)`, attempt+1, offset unchanged;
   - fatal (409) → no backoff, attempt unchanged, owned stays true.
All I/O (`readOwner`/`writeOwner`/`scan`/`getUpdates`) injectable for tests.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export daemon-engine.

### NEW `test/notifications-daemon-engine.test.ts` (6): defer-no-write; claim writes heartbeat + scans
+ polls + offset advance; keep preserves startedAt; empty poll keeps offset + resets attempt;
retryable error backoff + attempt+1; 409 fatal no-backoff owned.

## Verification handoff
C: engine suite + full notifications regression + check:types + biome + diff-check.
D: 10.030 stays OPEN (process spawn/reload/stop = phase 39).
