# 583 Phase 58 check — 10.038 RPC control plane v2 closure

> All actionable gates green. Card 10.038 CLOSED.

## Tests
- `bun test test/rpc-listen-startup-guard.test.ts` → **3 pass / 0 fail**.
- `bun test test/rpc-listen-startup-guard.test.ts test/rpc-listen-socket-guard.test.ts
  test/rpc-listen-platform.test.ts test/rpc-fastlane.test.ts test/rpc-get-state-payload.test.ts`
  → **15 pass / 1 fail / 80 expect()** across 5 files.
  - The single failure is the pre-existing subprocess clobber test
    `rpc-listen-socket-guard.test.ts > refuses to clobber a live listen socket`, which aborts with
    `Bun runtime must be >= 1.3.14 (found v1.3.11)` **before** exercising any RPC behavior. This is an
    environment limit on this machine, not a code regression (the test + production guard exist in
    source). The new in-process guard covers the same contract independent of Bun version.

## Static analysis
- `bun run check:types` → exit 0; `bunx biome check` → clean; `git diff --check` → exit 0.

## 10.038 — CLOSED (phases 7, 20, 27, 58)
| sub-slice | resolution |
|---|---|
| A unknown-command id | closed phase 20 (`rpc-get-state-payload.test.ts`) |
| A token-cost fail-closed metrics | closed — `unattended-budget-redteam.test.ts` (unsupported metric + cost breach) |
| B UDS/listen duplicate-refusal + stale cleanup | implemented (`rpc-mode.ts:699-701`) + in-process guard (`rpc-listen-startup-guard.test.ts`); subprocess integration env-blocked only |
| C Python registry/listen parity | reject (no drift; `python/jwc-rpc/tests/test_registry.py` + `test_client_uds.py`) |
| D fast-lane scheduler | closed phase 27 (`rpc-fastlane.test.ts`) |

Residual (monitored, NOT blocking): the subprocess clobber-refusal + uds-listen integration tests
will execute once the local Bun runtime is upgraded to ≥ 1.3.14; behavior + source already present.
