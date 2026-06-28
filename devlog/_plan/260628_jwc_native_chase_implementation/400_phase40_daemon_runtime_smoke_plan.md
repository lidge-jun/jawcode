# 400 Phase 40 plan — runnable managed daemon + smoke (closes 10.030)

> Final slice of card 10.030. The behavioral core (owner-claim 37, engine tick 38, control+loop 39) is
> complete and tested. This phase wires it into a **runnable managed daemon** (`runManagedDaemon`) with
> real transport/control I/O + carried poll state + real-sleep default, and an **end-to-end smoke test**
> (mocked Telegram fetch, no live token): single-owner run, two-daemons-one-owner, clean stop.
> Then closes 10.030. Risk class: **C3** (runtime composition); injectable sleep/fetch/clock → testable.

## Part 1 — plain explanation
Everything the daemon needs already exists and is tested in pieces. This phase assembles them into one
function you can actually run — it claims the owner slot, refreshes the heartbeat, scans sessions,
polls Telegram, and obeys stop/reload — and proves it end to end with a mocked Telegram so no live bot
is needed. The literal OS-detached launch from a CLI binary stays a documented follow-up (not a
behavioral done-gate).

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/daemon-runtime.ts` (~70 lines, smoke-tested)
```ts
export interface RunManagedDaemonOptions {
  agentDir: string; token: string; chatId: string; ownerId: string;
  pid?: number; now?: () => number; sleep?: (ms: number) => Promise<void>;
  baseIntervalMs?: number; pollTimeoutSec?: number; maxTicks?: number;
  fetchImpl?: typeof fetch; heartbeatTtlMs?: number; pidAlive?: (pid: number) => boolean;
}
export async function runManagedDaemon(options): Promise<DaemonLoopResult>;
```
Wires `runDaemonLoop` with real I/O:
- `tick`: a closure carrying `let pollState` → `runDaemonTick({agentDir, token, chatId, ownerId, pid,
  now, pollState, pollTimeoutSec, heartbeatTtlMs, pidAlive, fetchImpl})`; updates `pollState = nextPollState`.
- `readControl`/`readOwner`/`clearControl` → `readDaemonControl`/`readTransportOwner`/`clearDaemonControl`(agentDir).
- `onStop` → read current owner; if present, `writeTransportOwner(agentDir, markTransportOwnerStopped(owner, now))`.
- `sleep` default `(ms) => new Promise(r => setTimeout(r, ms))`; `pid` default `process.pid`; `now` default `Date.now`.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export daemon-runtime.

### NEW `test/notifications-daemon-runtime.test.ts` (mocked fetch + injected no-op sleep + temp agentDir):
- single daemon: `maxTicks:2`, fetch returns updates → outcome `max-ticks`, owner.json written for ownerId, polled.
- two-daemons-one-owner: pre-write a fresh live owner (d1, pidAlive→true); run `runManagedDaemon` as d2
  (`maxTicks:1`, pidAlive→true) → d2 defers (tick `owned:false`), owner.json still belongs to d1.
- clean stop: write a stop control targeting the owner → outcome `stopped`, owner.json `stoppedAt` set.

### NEW devlog `401_audit`, `402_build`, `403_check`.

## PABCD
- **A**: independent audit — runDaemonTick option wiring + pollState carry, onStop mark-stopped via
  markTransportOwnerStopped/writeTransportOwner, smoke covers the card Verification (daemon smoke +
  two-session-one-owner), and CLOSURE re-assessment: does `runManagedDaemon` + smoke now make all 6
  done-gates demonstrably met end-to-end (so closing 10.030 is justified)? If a gate still genuinely
  needs an OS-spawned process, say NARROW.
- **B**: Boss writes runtime + smoke test.
- **C**: smoke + full notifications regression + check:types + biome + diff-check.
- **D**: **close `10.030` to `_fin`** if A confirms; document the literal detached-OS-process/CLI binary
  launch (`jwc daemon` public vs internal) as a monitored residual / NEW card. Else keep open.

## Constraints
- Injectable sleep/fetch/clock; smoke uses mocked Telegram (no live token). Token never logged.
- `.jwc` paths. ES modules; file ≤400 lines.
