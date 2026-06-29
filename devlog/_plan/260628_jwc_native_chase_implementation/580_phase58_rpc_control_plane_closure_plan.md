# 580 Phase 58 plan — 10.038 RPC control plane v2 closure

> Work-phase 58. Goal P1 cluster. Closes **10.038** RPC control plane v2.
> Source: GJC `a791d72a` RPC hardening cluster (read-only evidence). JWC owners only.

## Current state of 10.038 (verified 2026-06-28)
- **10.038-A** unknown-command id preservation — CLOSED (phase 20,
  `test/rpc-get-state-payload.test.ts`, `command-dispatch.ts` `rpcError(id,...)`).
  Token-cost fail-closed metrics — **CLOSED** (already covered):
  `test/unattended-budget-redteam.test.ts` proves `unsupported_budget_metric` refusal (no controller
  constructed), cost breach via `reconcile({costUsd})` with metric/limit/observed/phase, preflight
  reserve-before-side-effects, and combined token+cost reconciliation. Enforcement in
  `src/modes/shared/agent-wire/unattended-run-controller.ts:280-348`.
- **10.038-D** fast-lane scheduler — CLOSED (phase 27, `test/rpc-fastlane.test.ts`).
- **10.038-C** Python client registry/listen parity — **no drift / already covered**:
  `python/jwc-rpc/tests/{test_registry.py,test_client_uds.py,test_client.py,test_protocol.py}` cover
  registry `list_sessions` + UDS client + protocol parity. No JS/Python drift found → reject (no work).
- **10.038-B** UDS/listen beyond closed 10.018 baseline — implemented:
  `runRpcMode` (rpc-mode.ts:695-702) refuses a live socket (`isUnixSocketAlive` → throw "already in
  use", does NOT unlink) and clears a stale socket file (`fs.rm(force)`) before `Bun.listen`.
  `assertRpcListenSupported` (platform guard) tested in `rpc-listen-platform.test.ts`;
  `isUnixSocketAlive` missing/live/stale tested in `rpc-listen-socket-guard.test.ts`; the
  clobber-refusal + uds-listen integration tests exist but run via `Bun.spawnSync` subprocess and are
  blocked on THIS machine by `Bun >= 1.3.14 (found 1.3.11)` — an environment limit, not a code/test gap.

## Gap to close (B only)
The listen-startup **recovery/preservation action** has no in-process (non-subprocess) regression guard:
1. a stale socket file is cleared and the path becomes listenable again (the `fs.rm` recovery path);
2. a live socket is detected and its file is preserved (the refuse-without-steal precondition).

## JWC owner files (this phase)
- `packages/coding-agent/src/modes/rpc/rpc-mode.ts` (`isUnixSocketAlive`, listen guard — test target, no change)
- NEW `packages/coding-agent/test/rpc-listen-startup-guard.test.ts`

## Import / adapt / reject / split decisions
| sub-feature | decision |
|---|---|
| unknown-command id (A) | **closed** (phase 20) |
| token-cost fail-closed metrics (A) | **closed** — covered by `unattended-budget-redteam.test.ts` |
| fast-lane scheduler (D) | **closed** (phase 27) |
| Python registry/listen parity (C) | **reject (no drift)** — Python suite already covers it |
| UDS/listen duplicate-refusal + stale cleanup (B) | **adapt + test** — add in-process recovery/preservation guard; subprocess integration remains (env-blocked locally) |

## Build (B) — Boss writes
`test/rpc-listen-startup-guard.test.ts`, importing `isUnixSocketAlive` from rpc-mode:
1. stale socket file (dead listener) → `isUnixSocketAlive` false → `fs.rm(force)` + `Bun.listen`
   succeeds at the same path (recovery).
2. live `Bun.listen` socket → `isUnixSocketAlive` true AND socket file still present (refuse-without-steal
   precondition; production throws before any `fs.rm`).
No production source change.

## Check (C)
- `bun test test/rpc-listen-startup-guard.test.ts test/rpc-listen-socket-guard.test.ts
  test/rpc-listen-platform.test.ts test/rpc-fastlane.test.ts test/rpc-get-state-payload.test.ts`
- `bun run check:types` (exit 0); `git diff --check`.

## Done (D) → close 10.038
Move card → `_fin/10/`; fix MOC/008 links + inbound (follow-index/MOC/gap-inventory); `_fin/INDEX`
+= row, bump 39→40. Record final-close with all sub-slice decisions + the bun-version env note.

## Verification tier
LIGHT (test-only, 1 new file, no production change) + independent plan audit (goal gate).
