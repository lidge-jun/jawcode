# 571 Phase 57 audit — 10.037 runtime lifecycle closure (independent)

> Independent read-only sub-agent audit of plan `570`. Verdict: **closeable:true**.

## Confirmed (file:line evidence)
- `src/exec/idle-timeout-watchdog.ts:1–105` — `IdleTimeoutWatchdog` implemented + exported; idle abort,
  signal abort, hard-timeout grace, `touch()` reset, idempotent `#abort`, `dispose()`, pre-aborted path.
  `grep -rn IdleTimeoutWatchdog src` → **zero callsites** outside its own file: public primitive, untested.
- `src/dap/client.ts:407–424` — `dispose()` idempotent guard, rejects pending requests, ends socket,
  kills proc, awaits `proc.exited`. Only existing DAP test is `dap-write-sink-flush.typecheck.ts`
  (type-level) → no focused dispose test.
- `src/exec/bash-executor.ts:171–257` — own `runAbortController`/`timeoutDeferred`/`baseTimeoutMs`
  inline timeout path; `test/bash-executor.test.ts:234–263` covers timeout cancellation, signal abort,
  quarantine on stalled cleanup → reject-re-wire is sound (no behavioral gain, churn risk on C4 surface).
- `test/lsp-lifecycle-cleanup.test.ts` exists, imports `shutdownAll`/`setIdleTimeout`/`getActiveClients`,
  tests shutdown → LSP cleanup already closed.

## Done-gate mapping
All 7 card done-gate items satisfied by the plan (source facts ✓, owners listed ✓, naming N/A test-only ✓,
import/adapt/reject/split table ✓, focused tests ✓, diff-check ✓, MOC/index update in D ✓).

## Risk
Reject-re-wire risk **LOW**: watchdog stays exported + now regression-guarded for future adopters; the
only residual is it remains dead code, mitigated by the new contract tests. No regression vector.
