# 582 Phase 58 build — 10.038 RPC control plane v2 closure

> Boss-direct build after audit `581` PASS. Test-only; no production source change. Closes 10.038.

## Changes (1 new test file, 0 source changes)
### NEW `packages/coding-agent/test/rpc-listen-startup-guard.test.ts` (3 tests)
In-process regression guard for the `runRpcMode` `--listen` startup sequence (rpc-mode.ts:699-701),
independent of the subprocess integration test (which needs Bun ≥ 1.3.14):
1. stale socket file → `isUnixSocketAlive` false → `fs.rm(force)` + `Bun.listen` succeeds (recovery).
2. live socket → `isUnixSocketAlive` true AND file preserved (refuse-without-steal precondition).
3. missing path → not-alive, no file created.

## Sub-slice decisions recorded
- A unknown-cmd id → closed (phase 20). A token-cost fail-closed → closed (`unattended-budget-redteam.test.ts`).
- D fast-lane → closed (phase 27). C Python parity → reject (no drift; Python suite covers it).
- B UDS/listen duplicate-refusal + stale cleanup → adapt + in-process test; subprocess integration
  retained (env-blocked locally only).

## Verification handoff (C)
3 new pass; adjacent rpc suites pass; the only failure is the pre-existing subprocess clobber test
blocked by `Bun >= 1.3.14 (found v1.3.11)` — environment limit, not a code regression. check:types 0.
