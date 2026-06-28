# 380 Phase 38 plan — managed Telegram daemon engine (10.030 slice 2)

> Work-phase 38 = the in-process daemon **engine tick** that composes the phase-37 cores
> (`decideOwnerClaim`, `getTelegramUpdates`/`nextBackoffMs`) with the existing transport-state owner
> I/O and the transport-shell scanner. NO OS process spawn (that is phase 39). Fully unit-testable.
> Risk class: **C3** (composition of network + ownership + scan); injected I/O + fake clock/client.

## Part 1 — plain explanation
The daemon will eventually loop forever. This phase builds one deterministic **tick** of that loop:
read the owner record, decide claim/keep/defer, refresh the heartbeat when we own it, scan registered
sessions, poll Telegram once, and advance the offset (or back off on a transient error). The long-lived
process wrapper and reload/stop are phase 39.

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/daemon-engine.ts` (~90 lines, unit-tested)
```ts
export interface DaemonPollState { offset?: number; attempt: number; }
export interface DaemonTickResult {
  decision: OwnerClaimDecision; owned: boolean; scannedSessions: number;
  poll?: { ok: boolean; updateCount: number; nextOffset?: number; retryable?: boolean;
           backoffMs?: number; status?: number; reason?: string };
  nextPollState: DaemonPollState;
}
export interface RunDaemonTickOptions {
  agentDir: string; token: string; chatId: string; ownerId: string; pid: number;
  now: () => number; pollState?: DaemonPollState; pollTimeoutSec?: number;
  heartbeatTtlMs?: number; pidAlive?: (pid: number) => boolean;
  readOwner?: ...; writeOwner?: ...; scan?: ...; getUpdates?: typeof getTelegramUpdates; fetchImpl?: typeof fetch;
}
export async function runDaemonTick(options: RunDaemonTickOptions): Promise<DaemonTickResult>;
```
Logic:
1. fingerprints via `fingerprintSecret(token)`/`fingerprintSecret(chatId)`; `readOwner(agentDir)`.
2. `decideOwnerClaim({current, candidate:{...fingerprints,pid}, now(), heartbeatTtlMs, pidAlive})`.
3. `defer` → return `{owned:false, scannedSessions:0, nextPollState:pollState}` (no write).
4. `claim`/`keep` → write `TransportOwnerState` (heartbeatAt=now; startedAt preserved on keep, else now).
5. `scan({agentDir})` → `scannedSessions = observations.length` (endpoint connect within interval).
6. `getUpdates({token, offset, timeoutSec, fetchImpl})` once:
   - ok → `updateCount`, `nextOffset = max(update_id)+1` (or unchanged when empty), attempt reset 0.
   - !ok retryable → `backoffMs = nextBackoffMs(attempt)`, attempt+1, offset unchanged.
   - !ok fatal (409) → no backoff, attempt unchanged, owned stays true (we hold the lock; surfaced).
   Inbound routing stays fail-closed (phase-2 `decideTransportInbound` unchanged) — not this slice.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export daemon-engine.

### NEW `test/notifications-daemon-engine.test.ts` (in-memory owner I/O + fake scan + fake getUpdates + fake clock):
defer (live other owner) → no write; claim (no owner) → owner written w/ heartbeat + poll ok +
nextOffset; keep (self) → startedAt preserved; updates advance offset, empty keeps offset + resets
attempt; retryable error → backoffMs + attempt+1; 409 fatal → no backoff, owned true.

### NEW devlog `381_audit`, `382_build`, `383_check`.

## PABCD
- **A**: light independent audit — owner-record write shape (version/ownerId/pid/startedAt/heartbeatAt/
  fingerprints), scan/getUpdates/readOwner signatures, offset advancement + backoff correctness, no
  real timers/spawn, no token in logs.
- **B**: Boss writes engine + test; reuse confirmed signatures.
- **C**: engine suite + full notifications regression + check:types + biome + diff-check.
- **D**: commit; 10.030 stays OPEN (process spawn/reload/stop = phase 39).

## Constraints
- No OS process spawn, no real timers — pure single tick with injected I/O. Token never logged.
- `.jwc` roots via existing transport-state. ES modules; file ≤400 lines. Do NOT close 10.030.
