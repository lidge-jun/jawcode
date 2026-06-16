# 06 — P plan: RPC UDS Phase 2 (`--listen`)

> **상태**: draft P plan — implementation not started  
> **기준**: Phase 1 `_fin` admission complete (`10.008` / `10.011` / `10.018`), UDS remained deferred by design.  
> **upstream reference**: `devlog/_upstream_gjc/packages/coding-agent/src/modes/rpc/rpc-mode.ts` @ `269387b` (`options?.listen`, `isUnixSocketAlive`, `Bun.listen({ unix })`).  
> **naming contract**: [008](../../../struct_har/chase/008_gjc_jwc_naming_contract.md) — public surface stays `jwc`, Python package stays `jwc_rpc` / `python/jwc-rpc`.
> **expanded execution docs**: [07 decisions](./07_uds_phase2_decisions.md) · [08 CLI](./08_uds_phase2_step1_cli_entrypoint.md) · [09 runtime](./09_uds_phase2_step2_runtime_server.md) · [10 registry/Python](./10_uds_phase2_step3_registry_python.md) · [11 verification](./11_uds_phase2_step4_verification.md) · [12 closeout](./12_uds_phase2_step5_chase_closeout.md)

## Goal

Land **UDS Phase 2** as a narrow follow-up to the stdio Phase 1 RPC bundle:

1. Add persistent Unix-domain socket listening for `jwc --mode rpc --listen <socket-path>`.
2. Keep existing stdio RPC behavior byte-for-byte compatible for current harness and Python clients.
3. Extend registry/list-session behavior so a UDS-owned RPC session remains discoverable and attachable.
4. Close the UDS slice of `10.018` and the Phase-2 portion of `10.026` issue **09 detached persistent session** only when mechanical tests cover it.

## Non-goals

- Do **not** expand into all `10.026` rows.
- Do **not** close issues `02–05` unattended policy depth.
- Do **not** claim full client parity for `06–08` unless Python/TS clients are explicitly updated and tested.
- Do **not** change the existing stdio default transport or `JawcodeRpc` harness spawn contract (`jwc --mode rpc`).
- Do **not** port upstream `gjc` names verbatim; every public path/command/doc must remain `jwc`-first per 008.

## Current-state facts

### JWC landed in Phase 1

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts` has stdio-only `runRpcMode(session, setToolUIContext?)`.
- `handleInboundLine()` is already shared-shaped: comment says it is intended for stdio and persistent UDS, but there is no live `options?.listen` branch in jwc yet.
- `session-registry.ts` and `jwc_rpc.list_sessions` exist and are tested.
- Phase 1 gates: `bun test` five RPC files = **31 pass**; `python3 -m pytest python/jwc-rpc/tests/test_registry.py` = **3 passed**.

### Upstream reference shape

Upstream `gjc` has the missing pieces:

- `runRpcMode(session, setToolUIContext, options?: { listen?: string })`.
- Swappable `frameSink` so stdout remains stdio default and connected UDS clients receive JSONL frames.
- `isUnixSocketAlive(socketPath)` guard to refuse clobbering a live endpoint while permitting stale socket cleanup.
- `Bun.listen({ unix: socketPath, socket: { open, data, close, error } })` server branch.
- `rpc-listen-socket-guard.test.ts` covering live socket protection.

## Target files

### Expected implementation files

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts`
  - Add `fs` import if needed.
  - Add `isUnixSocketAlive()`.
  - Change `runRpcMode` signature to accept `{ listen?: string }`.
  - Add UDS server branch while preserving stdio output/read loop.
- `packages/coding-agent/src/cli/args.ts`
  - Parse `--listen <socket-path>` or a narrowly named `--rpc-listen <socket-path>` if product surface wants to avoid global flag ambiguity.
- `packages/coding-agent/src/commands/launch.ts`
  - Document flag if the primary CLI parser exposes it.
- `packages/coding-agent/src/main.ts`
  - Pass parsed listen option into `runRpcMode` only for `mode === "rpc"` (or also `rpc-ui` only if explicitly intended; default recommendation: rpc only).
- `packages/coding-agent/src/harness-control-plane/rpc-adapter.ts`
  - No default behavior change. Optional: add command override examples only if tests need UDS.
- `python/jwc-rpc/`
  - All-in Phase 2 includes Python `RpcClient.connect_unix(...)`; see [07](./07_uds_phase2_decisions.md) and [10](./10_uds_phase2_step3_registry_python.md).

### Expected tests

- `packages/coding-agent/test/rpc-listen-socket-guard.test.ts`
  - Port upstream live/stale socket guard assertions with jwc names.
- `packages/coding-agent/test/rpc-uds-listen.test.ts` or extend existing RPC redteam
  - Start `jwc --mode rpc --listen <tmp.sock>`.
  - Connect with `Bun.connect({ unix })`.
  - Assert per-client `ready` frame.
  - Send JSONL `get_state` and assert `success === true`.
  - Send one malformed JSONL line, assert parse error frame, then assert a later valid `get_state` still succeeds.
  - Verify registry record is discoverable with `transport: "socket"` and `endpoint`; after owner exit, assert record is reaped/removed or document residual cleanup in `14_uds_phase2_implementation_log.md`.
- Existing Phase 1 regressions must stay green:
  - `packages/coding-agent/test/rpc-stdio-redteam.test.ts`
  - `packages/coding-agent/test/rpc-get-state-payload.test.ts`
  - `packages/coding-agent/test/harness-control-plane/receipts.test.ts`
  - `packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts`
  - `packages/coding-agent/test/rpc-session-registry.test.ts`
  - `python3 -m pytest python/jwc-rpc/tests/test_registry.py -q`

## Implementation sequence

### B1 — Parser and entrypoint wiring

1. Add a parsed args field for RPC listen path.
2. Reject `--listen` unless `--mode rpc` is active, or silently ignore only if an existing parser convention requires it. Preferred: clear error to avoid accidental global semantics.
3. Pass `{ listen: parsedArgs.rpcListenPath }` into `runRpcMode` only when the resolved runtime `mode === "rpc"`; never wire `rpc-ui` to UDS in this cycle.
4. Update CLI help/examples minimally.

Acceptance:

- `jwc --mode rpc` still starts stdio exactly as before.
- `jwc --mode rpc --listen <sock>` reaches `runRpcMode(..., { listen })`.

### B2 — UDS server branch

1. Port upstream `frameSink` pattern.
2. For stdio mode, emit `ready` immediately and keep `readLines(process.stdin)` loop unchanged.
3. For listen mode:
   - `mkdir -p dirname(socketPath)`.
   - Use `isUnixSocketAlive` before unlink.
   - Refuse to unlink live endpoint with explicit error.
   - Remove stale socket path before bind.
   - `Bun.listen({ unix: socketPath })`.
   - Emit `ready` to each client connection.
   - Buffer client data by newline and feed each complete JSONL line to the same `handleInboundLine()`.
   - Route response/event frames to the active socket sink.
4. Ensure shutdown/unregister paths run for process exit and failed bind.

Acceptance:

- Existing stdio redteam remains green.
- UDS client can issue at least one read command and receive a correlated response.
- Live socket protection test passes.

### B3 — Registry and rediscovery contract

1. Use the all-in schema decision from [07](./07_uds_phase2_decisions.md): `transport: "socket"` plus `endpoint` for UDS `--listen`; older `transport: "uds"` / `listenPath` wording is superseded.
   - Minimum: keep existing registry schema if `sessionFile` is enough.
   - Preferred: add optional metadata without breaking Python parser.
2. If metadata is added, update TypeScript and Python registry parsers/tests.
3. Update `10.018` rediscovery docs: UDS owner can be discovered via `list_sessions`, then client attaches through socket path if present.

Acceptance:

- `jwc_rpc.list_sessions()` still parses every record.
- Stale PID cleanup still works.
- Existing registry tests remain green.

### B4 — Client surface decision

Superseded by [07](./07_uds_phase2_decisions.md): implement **Python client UDS** in the same all-in cycle via `RpcClient.connect_unix(...)`. Server-only remains historical context, not the active plan.

## C gates

Required before D:

```bash
bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts
bun test packages/coding-agent/test/rpc-uds-listen.test.ts
bun test packages/coding-agent/test/rpc-listen-cli.test.ts
bun test packages/coding-agent/test/rpc-listen-platform.test.ts
bun test packages/coding-agent/test/rpc-stdio-redteam.test.ts \
  packages/coding-agent/test/rpc-get-state-payload.test.ts \
  packages/coding-agent/test/harness-control-plane/receipts.test.ts \
  packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts \
  packages/coding-agent/test/rpc-session-registry.test.ts
python3 -m pytest python/jwc-rpc/tests/test_registry.py -q
python3 -m pytest python/jwc-rpc/tests/test_client_uds.py -q
```

Recommended broader check if parser/main CLI wiring changes are non-trivial:

```bash
bun test packages/coding-agent/test/cli-command-surface.test.ts
bun run check:ts
jwc --mode rpc --listen
jwc --listen /tmp/jwc-rpc.sock
jwc --help
```

## D / chase updates

Only after gates are green:

- Update `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`:
  - `UDS --listen` row from deferred to landed or partial, depending on client surface.
- Update `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md`:
  - Issue 09 from `defer` to `server fixed` / `partial` as appropriate.
  - Do not close 06–08 or 02–05 unless separately implemented.
- Update `devlog/_plan/260614_chase_rpc_harness_bundle/02_issues_matrix_026.md` with the same 09 verdict.
- Add `14_uds_phase2_implementation_log.md` with command outputs and exact commit hash.

## Risks

1. **Frame routing ambiguity**: multiple clients connected to one UDS owner can race for response frames. Keep Phase 2 acceptance to one active client unless multi-client fanout is explicitly designed.
2. **Live socket clobbering**: must refuse a live previous owner; stale cleanup must remain safe.
3. **stdio regression**: current harness and Python paths depend on stdio. The default must remain unchanged.
4. **Platform behavior**: UDS is Unix/macOS-first. Windows should produce a clear unsupported path if exposed there.
5. **Scope creep into unattended**: UDS should not silently absorb 10.026 issues 02–05. Keep those rows deferred.

## Recommended PABCD shape

- **P**: Approve this file as the narrow UDS Phase 2 plan.
- **A**: Architect checks transport contract and registry compatibility; Planner checks test coverage and non-goals.
- **B**: Implement B1–B4 all-in: CLI, UDS runtime, registry rediscovery, and Python `RpcClient.connect_unix(...)`.
- **C**: Run required C gates above.
- **D**: Update chase verdict rows and close the cycle. Do not move 10.026 to `_fin` unless all remaining rows are addressed.
