# 572 Phase 57 build — 10.037 runtime lifecycle closure

> Boss-direct build after audit `571` PASS. Test-only; no production source change. Closes 10.037.

## Changes (2 new test files, 0 source changes)
### NEW `packages/coding-agent/test/idle-timeout-watchdog.test.ts` (9 tests)
Covers the `IdleTimeoutWatchdog` public lifecycle primitive: idle-timeout abort + `onAbort` reason;
`touch()` defers the abort; external-signal abort + `abortedBySignal`; constructed-with-aborted-signal
immediate abort; `hardTimeoutPromise` resolves after the grace window; `dispose()` cancels the idle
timer and detaches the signal listener (no late abort); onAbort fires once (idle timer cleared by a
signal abort). Plus `formatIdleTimeoutMessage` generic/seconds formatting.

### NEW `packages/coding-agent/test/dap-client-dispose.test.ts` (4 tests)
Constructs `DapClient` with a fake proc (kill spy + resolved `exited`), injected write-sink + readable.
Covers `dispose()`: rejects in-flight `sendRequest` with a "disposed" error; kills proc + awaits exit
exactly once (idempotent second dispose is a no-op); ends an injected socket; rejects new requests
after disposal ("not running").

## Import/adapt/reject/split decisions recorded
- bash-executor idle/timeout path → **reject re-wire** (proven inline path, C4 churn risk).
- `IdleTimeoutWatchdog` → **adapt + test** (public primitive, now regression-guarded).
- DAP `dispose()` → **adapt + test**. LSP cleanup → **already closed**. env scrub (10.037-B) → phase 17.

## Verification handoff (C)
13 new pass; adjacent runtime regression (bash-executor, js-executor, lsp-lifecycle-cleanup) green;
check:types 0; diff-check clean.
