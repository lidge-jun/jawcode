# 14 — UDS Phase 2 implementation log

## Changed files

### TypeScript runtime / CLI / tests

- `packages/coding-agent/src/cli/args.ts`
  - Added `rpcListenPath` and `--listen <path>` parsing/help.
- `packages/coding-agent/src/main.ts`
  - Rejects `--listen` unless `--mode rpc` before session creation.
  - Passes `{ listen }` to `runRpcMode` only for resolved `mode === "rpc"`.
- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
  - Added `assertRpcListenSupported()` and `isUnixSocketAlive()`.
  - Added persistent Unix socket server branch for `jwc --mode rpc --listen <path>`.
  - Keeps stdio as default transport.
  - Registers UDS owners as `transport: "socket"` + `endpoint`.
- `packages/coding-agent/test/cli-command-surface.test.ts`
  - Added parser coverage for `--listen` and refreshed current CLI surface expectations.
- `packages/coding-agent/test/rpc-listen-cli.test.ts`
  - Added invalid `--listen` mode/value and help smokes.
- `packages/coding-agent/test/rpc-listen-platform.test.ts`
  - Added unsupported-platform guard coverage.
- `packages/coding-agent/test/rpc-listen-socket-guard.test.ts`
  - Added live/stale socket guard tests.
- `packages/coding-agent/test/rpc-uds-listen.test.ts`
  - Added black-box UDS ready/get_state, malformed JSONL survival, reconnect, and registry discovery/reap coverage.
- `packages/coding-agent/test/rpc-session-registry.test.ts`
  - Added socket endpoint metadata coverage.

### Python `jwc_rpc`

- `python/jwc-rpc/src/jwc_rpc/client.py`
  - Changed default executable to `jwc`.
  - Added `RpcClient.connect_unix(...)` classmethod.
  - Added socket transport state/read/write path while preserving process-backed default behavior.
- `python/jwc-rpc/tests/test_client_uds.py`
  - Added fake Unix socket server roundtrip coverage.
- `python/jwc-rpc/tests/test_registry.py`
  - Added `transport: "socket"` + `endpoint` registry sample.
- `python/jwc-rpc/README.md`
  - Documented `jwc --mode rpc`, registry discovery, and `RpcClient.connect_unix(owner.endpoint)` attach flow.

### Chase/devlog

- `devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/02_issues_matrix_026.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/03_implementation_log.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/06_uds_phase2_p_plan.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/07_uds_phase2_decisions.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/08_uds_phase2_step1_cli_entrypoint.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/09_uds_phase2_step2_runtime_server.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/10_uds_phase2_step3_registry_python.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/11_uds_phase2_step4_verification.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/12_uds_phase2_step5_chase_closeout.md`
- `devlog/_plan/260614_chase_rpc_harness_bundle/13_uds_phase2_pabcd_execution_plan.md`
- `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`
- `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md`

## B evidence

- PABCD P critic: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-04-critic.md` = OKAY.
- PABCD A audits: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-03-planner.md` = PASS; `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-03-architect.md` = PASS.
- Executor lane: `agent://23-PythonUdsClient` implemented Python UDS attach and local py_compile check.

## C evidence

```bash
bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts packages/coding-agent/test/rpc-uds-listen.test.ts packages/coding-agent/test/rpc-listen-cli.test.ts packages/coding-agent/test/rpc-listen-platform.test.ts
# 8 pass, 0 fail
```

```bash
bun test packages/coding-agent/test/rpc-stdio-redteam.test.ts packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/test/harness-control-plane/receipts.test.ts packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts packages/coding-agent/test/rpc-session-registry.test.ts
# 32 pass, 0 fail
```

```bash
python3 -m pytest python/jwc-rpc/tests/test_registry.py python/jwc-rpc/tests/test_client.py python/jwc-rpc/tests/test_protocol.py python/jwc-rpc/tests/test_client_uds.py -q
# 53 passed, 7 subtests passed
```

```bash
bun test packages/coding-agent/test/cli-command-surface.test.ts packages/coding-agent/test/rpc-listen-cli.test.ts
# 14 pass, 0 fail
```

```bash
bun run check:ts
# pass
```

```bash
bun run check
# pass — check:ts + check:rs completed green
```

## Scope statement

- UDS server: landed for Unix-domain sockets via `jwc --mode rpc --listen <path>`.
- Python UDS client: landed via `RpcClient.connect_unix(owner.endpoint)`.
- Registry rediscovery: landed with existing `transport: "socket"` + `endpoint` record shape.
- 10.026 issue 09 verdict: fixed for single active UDS client / reconnect / registry rediscovery.
- 10.026 issues 02–05, 07–08 and 06 full client parity: unchanged.
- Multi-client fanout and Windows named pipe support: out of scope.

## Goal ledger checkpoint

Recorded:

```bash
jwc goal update "UDS Phase 2 implemented and verified" --evidence "devlog/_plan/260614_chase_rpc_harness_bundle/14_uds_phase2_implementation_log.md; bun UDS gates 8 pass; RPC/CLI regression bundle 46 pass; python RPC tests 53 passed; bun run check pass"
```
