# 570 Phase 57 plan — 10.037 runtime lifecycle closure (watchdog + DAP dispose tests)

> Work-phase 57. Goal P1 cluster. Closes **10.037** runtime process lifecycle hardening.
> Source: GJC `a791d72a` runtime lifecycle cluster (read-only evidence). JWC owners only.

## Current state of 10.037 (verified 2026-06-28)
- **10.037-B** env scrub — CLOSED, tested (phase 17, `bash-executor.test.ts`).
- **10.037-A** abort/timeout — partial (phase 18 `js-executor` signal test). Remaining: the
  `IdleTimeoutWatchdog` primitive (`src/exec/idle-timeout-watchdog.ts`) is fully implemented
  (idle-timeout abort, signal abort, hard-timeout grace, `touch()` reset, idempotent `#abort`,
  `dispose()` cleanup, pre-aborted-signal path) but has **zero focused tests** and no `src/` callsite.
- **10.037-C** DAP/LSP cleanup — LSP tested (`lsp-lifecycle-cleanup.test.ts`, `shutdownAll`,
  signal-unload handlers). DAP `client.dispose()` (idempotent disposed guard, rejects pending
  requests, ends socket, kills proc, awaits `proc.exited`) has **no focused dispose test**
  (only `dap-write-sink-flush.typecheck.ts`).

## JWC owner files (this phase)
- `packages/coding-agent/src/exec/idle-timeout-watchdog.ts` (test target, no source change)
- `packages/coding-agent/src/dap/client.ts` `dispose()` (test target, no source change)
- NEW `packages/coding-agent/test/idle-timeout-watchdog.test.ts`
- NEW `packages/coding-agent/test/dap-client-dispose.test.ts`

## Import / adapt / reject / split decisions (per sub-feature)
| sub-feature | decision | rationale |
|---|---|---|
| bash-executor idle/timeout path | **reject re-wire** | bash-executor already has a proven, tested inline timeout/abort path (`baseTimeoutMs`/`timeoutDeferred`/`runAbortController`, covered by `bash-executor.test.ts`). Re-routing it through `IdleTimeoutWatchdog` is churn + regression risk on a C4 runtime surface with no behavioral gain. |
| `IdleTimeoutWatchdog` primitive | **adapt + test** | Exported public lifecycle primitive with no regression guard. Add focused behavioral test; keep available for future adopters. |
| DAP `client.dispose()` | **adapt + test** | Implemented cleanup with no focused test. Prove idempotency + pending-request rejection + proc kill + exit await. |
| LSP cleanup | **already closed** | `lsp-lifecycle-cleanup.test.ts` + `shutdownAll` + signal-unload handlers exist. No new work. |
| env scrub (10.037-B) | **already closed** | phase 17. |

## Build (B) — Boss writes
1. `test/idle-timeout-watchdog.test.ts` — fake timers / manual clock via `AbortController` + real
   `setTimeout` with small ms; cover: (a) idle-timeout fires abort + `onAbort("idle-timeout")` +
   `timedOut`; (b) `touch()` resets the idle timer; (c) external `signal` abort → `abortedBySignal`,
   reason "signal"; (d) pre-aborted signal in constructor aborts immediately; (e) hard-timeout grace
   resolves `hardTimeoutPromise`; (f) `dispose()` clears timers + removes signal listener (no abort
   after dispose); (g) idempotent `#abort` (second trigger no-ops, `onAbort` once).
2. `test/dap-client-dispose.test.ts` — construct a `DapClient` with a fake child proc (kill spy +
   `exited` promise) + in-memory streams; cover: (a) `dispose()` rejects in-flight `sendRequest`
   with "disposed"; (b) `proc.kill()` called + awaits `exited`; (c) second `dispose()` is a no-op
   (idempotent, kill not called twice); (d) `isAlive`/disposed guard reflects disposed.

No production source changes. Token-safe; injected proc/streams/timers; no real sockets.

## Check (C)
- `bun test test/idle-timeout-watchdog.test.ts test/dap-client-dispose.test.ts`
- regression: `bun test test/bash-executor.test.ts test/core/js-executor.test.ts test/lsp-lifecycle-cleanup.test.ts`
- `bun run check:types` (exit 0); `git diff --check`.

## Done (D) → close 10.037
Move `10.037` → `_fin/10/`; fix MOC/follow-index/gap-inventory; `_fin/INDEX` += row, bump count
38→39. Record final-close with all 3 sub-slice decisions + evidence.

## Verification tier
LIGHT (test-only, 2 new files, no production change) + independent plan audit (goal gate).
