# 13 — PABCD execution plan: UDS Phase 2 all-in

> **Stage**: P draft for direct `jwc orchestrate` cycle.  
> **Owner objective**: implement UDS Phase 2 end-to-end, actively use executor lanes during B, verify C gates, and update `_fin`/chase state exactly to landed scope.  
> **Prereqs**: Phase 1 `_fin` admission complete for `10.008`, `10.011`, `10.018`; UDS remained deferred until this cycle.  
> **Input docs**: [06](./06_uds_phase2_p_plan.md), [07](./07_uds_phase2_decisions.md), [08](./08_uds_phase2_step1_cli_entrypoint.md), [09](./09_uds_phase2_step2_runtime_server.md), [10](./10_uds_phase2_step3_registry_python.md), [11](./11_uds_phase2_step4_verification.md), [12](./12_uds_phase2_step5_chase_closeout.md).

## 1. Concrete deliverables

1. `jwc --mode rpc --listen <socket-path>` starts a persistent Unix-domain socket RPC owner on macOS/Linux.
2. `jwc --mode rpc` stdio behavior remains unchanged: ready frame on stdout, JSONL stdin, existing Phase 1 tests green.
3. Live socket clobber is rejected; stale socket paths can be removed before bind.
4. UDS client receives per-connection `ready`, can send JSONL commands, and receives correlated `response` frames.
5. Registry exposes the UDS owner as a live session with attach endpoint metadata while preserving old record parsing.
6. Python `jwc_rpc` keeps process-backed stdio default and adds explicit Unix socket attach support.
7. Tests cover parser/entrypoint, socket guard, UDS black-box smoke, stdio regression, registry compatibility, and Python UDS client behavior.
8. Chase docs are updated: `10.018` `_fin` row reflects UDS Phase 2; `10.026` issue 09 reflects exact landed scope; unrelated `10.026` rows stay open/deferred.

## 2. Non-goals / residual scope

- No TCP listener.
- No Windows named pipe support; `--listen` is a Unix-domain socket feature and must fail clearly on unsupported platforms.
- No multi-client fanout guarantee; Phase 2 supports one active UDS client at a time and must not crash on reconnect.
- No migration of harness default transport from stdio to UDS.
- No `harness-control-plane/rpc-adapter.ts` default transport migration; it remains stdio-backed unless later product work explicitly changes harness ownership.
- No closure of `10.026` issues `02–05` unattended policy depth or `06–08` client parity/real-binary rows unless directly implemented and tested in this cycle.

## 3. Current-state evidence to preserve

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts` already has a shared `handleInboundLine()` and stdio registry record, but no live `options?.listen` branch.
- `packages/coding-agent/src/modes/shared/agent-wire/session-registry.ts` already supports `transport: "stdio" | "bridge" | "socket"` and optional `endpoint?: string`.
- `python/jwc-rpc/src/jwc_rpc/registry.py` already parses optional `endpoint` and preserves old records.
- `python/jwc-rpc/src/jwc_rpc/client.py` is process/stdin/stdout backed and currently defaults `executable="gjc"`; this cycle may document or preserve that compatibility, but UDS attach must not disturb process startup.
- Upstream reference for UDS lives at `devlog/_upstream_gjc/packages/coding-agent/src/modes/rpc/rpc-mode.ts` and uses `isUnixSocketAlive`, swappable `frameSink`, `Bun.listen({ unix })`, `transport: "socket"`, and `endpoint`.

## 4. File-level patch plan

### 4.1 `packages/coding-agent/src/cli/args.ts` — MODIFY

Before:

- `Args` has no listen-path field.
- `parseArgs()` handles `--mode`, but `--listen` is ignored as an unknown flag-shaped token.
- Help text has no RPC listen entry.

After:

- Add `rpcListenPath?: string` to `Args`.
- Parse both `--listen <path>` and `--listen=<path>` through the existing `--flag=value` normalization.
- Missing value should throw a direct parser error rather than silently becoming a prompt.
- Keep mode validation in main, because parse order allows `--listen` before `--mode`.
- Add a concise help line: `--listen <path> - Run --mode rpc over a Unix-domain socket`.

Acceptance:

- `parseArgs(["--mode", "rpc", "--listen", "/tmp/jwc.sock"]).rpcListenPath === "/tmp/jwc.sock"`.
- `parseArgs(["--mode=rpc", "--listen=/tmp/jwc.sock"])` works.
- `parseArgs(["--mode", "rpc", "--listen"])` throws `--listen requires a socket path`.

### 4.2 `packages/coding-agent/src/main.ts` — MODIFY

Before:

```ts
if (mode === "rpc" || mode === "rpc-ui") {
	await runRpcMode(session, mode === "rpc-ui" ? setToolUIContext : undefined);
}
```

After:

```ts
if (parsedArgs.rpcListenPath && parsedArgs.mode !== "rpc") {
	process.stderr.write(`${chalk.red("Error: --listen is only supported with --mode rpc")}\n`);
	process.exit(1);
}
...
if (mode === "rpc" || mode === "rpc-ui") {
	await runRpcMode(
		session,
		mode === "rpc-ui" ? setToolUIContext : undefined,
		mode === "rpc" && parsedArgs.rpcListenPath ? { listen: parsedArgs.rpcListenPath } : undefined,
	);
}
```

Details:

- Preserve existing `@file` rejection for RPC/bridge modes.
- Reject `--listen` in `text`, `json`, `acp`, `bridge`, and `rpc-ui` modes.
- Do not change interactive/TUI startup.
- Place this guard in `main.ts` before session creation: immediately after the current `@file` RPC/bridge rejection block (`main.ts` around lines 775–779) and before `const cwd = getProjectDir()` / `createSessionManager`, so invalid `--listen` usage exits before settings/session work.
- Required invalid-combo behavior: stderr contains `Error: --listen is only supported with --mode rpc`, exit code is non-zero, and `rpc-ui --listen` is rejected by test.

### 4.3 `packages/coding-agent/src/commands/launch.ts` — MODIFY only if help owns global options

Before:

- Launch/help surface does not mention `--listen`.

After:

- Do not edit `launch.ts` for this cycle unless implementation discovery shows it renders the primary `jwc --help` global option list. The current planned help owner is `args.ts` via `getExtraHelpText()`, so `launch.ts` is expected unchanged.
- Do not change launch policy, tmux behavior, or command execution.
Acceptance: after B, a help smoke must prove `jwc --help` includes `--listen <path>` from the `args.ts` help owner, or the implementation log must name the actual help owner changed.

### 4.4 `packages/coding-agent/src/modes/rpc/rpc-mode.ts` — MODIFY

Before:

- Imports `path`, not `fs`.
- `runRpcMode(session, setToolUIContext?)` always writes frames to `process.stdout`.
- Always emits `{ type: "ready" }` immediately.
- Always registers `transport: "stdio"` and exits when stdin closes.

After:

- Add `import * as fs from "node:fs/promises"`.
- Export:

```ts
export async function isUnixSocketAlive(socketPath: string): Promise<boolean>;
```

- Change signature:

```ts
export async function runRpcMode(
	session: AgentSession,
	setToolUIContext?: (uiContext: ExtensionUIContext, hasUI: boolean) => void,
	options?: { listen?: string },
): Promise<never>;
```

- Introduce a swappable `frameSink(line: string)` used by `output()`.
- Emit ready immediately only when `!options?.listen`.
- Keep all dispatch, scheduler, host-tool, host-URI, extension UI, event sequencing, unattended, and shutdown logic on the same code paths.
- Insert UDS branch after `handleInboundLine()` and before stdio registration:
  1. reject `process.platform === "win32"` with `RPC --listen requires Unix-domain socket support`;
  2. `await fs.mkdir(path.dirname(socketPath), { recursive: true }).catch(() => {})`;
  3. `if (await isUnixSocketAlive(socketPath)) throw new Error("rpc listen socket already in use: <path>")`; tests must assert the stable substring `rpc listen socket already in use`;
  4. `await fs.rm(socketPath, { force: true }).catch(() => {})`;
  4a. bind/path failures must include the socket path and original error message;
  5. register session with `transport: "socket"`, `endpoint: socketPath`, and existing metadata;
  6. `Bun.listen({ unix: socketPath, socket: { open, data, close, error } })`;
  7. on open, route `frameSink` to that socket and emit ready;
  8. on data, buffer by newline and call `void handleInboundLine(text)` for each non-empty line;
  9. on close, drop sink to a noop only if the current active socket closed;
  10. client close only clears that client sink and must not terminate the owner process;
  11. signal handlers call `shutdown(0, "RPC socket server signal")` and terminate the owner process cleanly;
  11a. owner process exit must unregister the RPC session record for listen mode;
  12. block forever until shutdown exits.
- Stdio branch remains byte-compatible except for `output()` using `frameSink`.

### 4.5 `packages/coding-agent/test/cli-command-surface.test.ts` — MODIFY

Add parser coverage:

- accepts `--mode rpc --listen <path>`;
- accepts equals forms;
- rejects missing `--listen` value.

Add main-level CLI smoke coverage in a new `packages/coding-agent/test/rpc-listen-cli.test.ts` using the existing black-box harness shape from `rpc-stdio-redteam.test.ts`: derive `cliEntry`, isolate cwd/env, include `createHarnessCliEnv` provider/model setup, apply a bounded process timeout, and assert exit code plus stderr for:
- `jwc --mode text --listen /tmp/x.sock` exits non-zero with the supported-mode error;
- `jwc --mode rpc-ui --listen /tmp/x.sock` exits non-zero with the supported-mode error;
- `jwc --mode rpc --listen` exits non-zero with the missing-value error.
- `jwc --listen /tmp/x.sock` without `--mode rpc` exits non-zero with the supported-mode error.
Add unsupported-platform coverage in a new `packages/coding-agent/test/rpc-listen-platform.test.ts`: exercise the exported platform guard helper or an injected-platform wrapper without mutating global `process.platform`, and assert the runnable test observes the exact error text `RPC --listen requires Unix-domain socket support`.
Add one malformed JSONL assertion to `rpc-uds-listen.test.ts`: sending a non-JSON line on an active socket returns a parse error frame and the server remains alive for a subsequent valid `get_state`.

### 4.6 `packages/coding-agent/test/rpc-listen-socket-guard.test.ts` — NEW

Content outline:

- import `isUnixSocketAlive`.
- create temp socket path under `tmpdir()`.
- assert missing path returns false.
- start dummy `Bun.listen({ unix })`, assert true.
- close dummy server, assert stale path is false or can be removed.
- assert starting real `jwc --mode rpc --listen <same-path>` rejects live socket with the stable error substring `rpc listen socket already in use`.

### 4.7 `packages/coding-agent/test/rpc-uds-listen.test.ts` — NEW

Black-box test outline:

- spawn the repo CLI entry with `bun <entry> --mode rpc --listen <tmp.sock>` in isolated cwd/env.
- wait for socket path to accept connections.
- connect using `Bun.connect({ unix })`.
- read JSONL frames from socket.
- assert first frame is `{ type: "ready" }`.
- write `{"id":"req_1","type":"get_state"}\n`.
- assert correlated successful response with `id === "req_1"`, `type === "response"`, and `success === true`.
- disconnect, reconnect, assert another client receives ready and a second `get_state` response with `success === true`.
- assert the spawned listen owner writes a registry record discoverable through `listRpcSessions`/Python `list_sessions()` with `transport === "socket"` and the expected `endpoint`.
- after owner termination, assert the registry record is reaped or removed; socket-file cleanup may be either asserted absent or documented as residual in `14_uds_phase2_implementation_log.md`.
- terminate process and clean temp directory.

### 4.8 `packages/coding-agent/src/modes/shared/agent-wire/session-registry.ts` — MODIFY only if needed

Preferred minimal patch:

- Keep existing `transport: "socket"` and `endpoint?: string` because both TS and Python already parse this shape.
- Add comments/docs clarifying `socket` means Unix-domain socket endpoint for `--listen`.
- Do not rename to `listenPath` in this cycle; `socket` + `endpoint` is the canonical Jawcode-compatible registry shape.

### 4.9 `packages/coding-agent/test/rpc-session-registry.test.ts` — MODIFY

Add/confirm coverage that:

- records with `transport: "socket"` and `endpoint` list correctly;
- legacy records without endpoint still parse;
- stale PID cleanup remains unchanged.

### 4.10 `python/jwc-rpc/src/jwc_rpc/client.py` — MODIFY

Before:

- `RpcClient` owns a process, writes commands to `process.stdin`, reads from `process.stdout`, and stops by terminating the process.

After:

- Add `import socket`.
- Add only the classmethod attach API for this cycle:

```py
@classmethod
def connect_unix(
    cls,
    socket_path: str | Path,
    *,
    startup_timeout: float = 30.0,
    request_timeout: float = 30.0,
    max_event_history: int | None = 10_000,
) -> "RpcClient": ...
```

- Constructor overloading with a public `socket_path=` parameter is out of scope for this pass.
- Add socket state fields: `_socket`, `_socket_file`, `_socket_thread` (or equivalent).
- `start()` branches internally:
  - process path remains existing behavior;
  - socket path opens `socket.socket(AF_UNIX, SOCK_STREAM)`, connects, creates a text file wrapper, starts the same line reader over socket frames, and waits for ready.
- Refactor `_read_stdout_loop()` into a shared `_read_jsonl_loop(lines, source_name)` helper, or add a parallel `_read_socket_loop()` that feeds the same payload handling methods.
- Refactor `_require_process()` / `_write_json()` into transport-neutral `_write_json(payload)` so `_request()` and `_send_notification()` work for both process and socket.
- `stop()` closes socket without terminating a subprocess when in socket mode.
- Existing `RpcClient(command=...)` behavior must remain unchanged.

### 4.11 `python/jwc-rpc/tests/test_client_uds.py` — NEW

Fake UDS server test outline:

- skip on platforms without `AF_UNIX`.
- create local Unix socket server thread.
- server accepts one client, sends `{"type":"ready"}\n`, reads one request, sends a correlated `get_state` success response.
- client uses `RpcClient.connect_unix(socket_path, startup_timeout=..., request_timeout=...)`.
- assert `client.get_state()` returns parsed session state data.
- `client.stop()` must close socket and not expect a process.

### 4.12 `python/jwc-rpc/tests/test_registry.py` — MODIFY

Add metadata sample with:

```json
{"sessionId":"uds","pid":<current>,"transport":"socket","endpoint":"/tmp/jwc.sock","cwd":"/repo","startedAt":"..."}
```

Assert `SessionHandle.endpoint == "/tmp/jwc.sock"`.

### 4.13 `python/jwc-rpc/README.md` — MODIFY

Add a short section:

```py
from jwc_rpc import RpcClient, list_sessions

sessions = list_sessions()
owner = next(s for s in sessions if s.transport == "socket" and s.endpoint)
client = RpcClient.connect_unix(owner.endpoint)
```

State clearly that process-backed `RpcClient()` remains the default.

### 4.14 Chase/devlog docs — MODIFY / NEW after green C

- `devlog/_plan/260614_chase_rpc_harness_bundle/000_moc.md`: mark UDS Phase 2 implemented and link the implementation log.
- `devlog/_plan/260614_chase_rpc_harness_bundle/02_issues_matrix_026.md`: update issue 09 only.
- `devlog/_plan/260614_chase_rpc_harness_bundle/14_uds_phase2_implementation_log.md`: create the canonical new evidence log with changed files, command outputs, residual scope, and goal-ledger checkpoint evidence; update `000_moc.md` to link it after C.
- `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`: update UDS row from deferred to Phase 2 landed with test evidence.
- `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md`: update issue 09 appendix/verdict; archived after user-directed `_fin` closeout despite residual rows.
- `struct_har/chase/_fin/INDEX.md`: update only if new `_fin` files are added or metadata changes; avoid duplicating already-archived Phase 1 rows.

## 5. Executor lane plan for B

Use executor subagents after A passes and B starts. Parent owns integration and final verification.
B implements B1–B4 all-in: CLI/parser/main wiring, UDS runtime, registry rediscovery, and Python `RpcClient.connect_unix(...)`.

1. **Runtime lane**: `rpc-mode.ts` + TS UDS tests. No Python/docs edits.
2. **Python lane**: `python/jwc-rpc/src/jwc_rpc/client.py`, registry tests, README, Python UDS tests. Coordinate with runtime lane only on registry endpoint shape (`transport: "socket"`, `endpoint`).
3. **Docs lane**: chase/devlog closeout after tests pass. Read-only until implementation evidence exists.

No subagent runs project-wide gates or formatters; parent runs final C commands once.

## 6. Verification / C gates

Run after integration:

```bash
bun test packages/coding-agent/test/rpc-listen-socket-guard.test.ts
bun test packages/coding-agent/test/rpc-uds-listen.test.ts
bun test \
  packages/coding-agent/test/rpc-stdio-redteam.test.ts \
  packages/coding-agent/test/rpc-get-state-payload.test.ts \
  packages/coding-agent/test/harness-control-plane/receipts.test.ts \
  packages/coding-agent/test/harness-control-plane/receipt-spool.test.ts \
  packages/coding-agent/test/rpc-session-registry.test.ts
python3 -m pytest \
  python/jwc-rpc/tests/test_registry.py \
  python/jwc-rpc/tests/test_client.py \
  python/jwc-rpc/tests/test_protocol.py \
  python/jwc-rpc/tests/test_client_uds.py \
  -q
bun test packages/coding-agent/test/cli-command-surface.test.ts
bun test packages/coding-agent/test/rpc-listen-cli.test.ts
bun test packages/coding-agent/test/rpc-listen-platform.test.ts
bun run check:ts
```

If a planned new file is intentionally not created, remove it from the gate list and record why in `14_uds_phase2_implementation_log.md` before D.

## 7. Failure routing

- Parser/listen entrypoint failure → back to B runtime lane.
- UDS real socket smoke missing/failing → back to B runtime lane; do not close issue 09.
- Stdio regression failure → back to B; UDS cannot be admitted as additive.
- Python UDS helper failure only → either fix in B or document issue 09 as server fixed/client partial; do not overclaim.
- Chase docs claiming rows outside issue 09 → fix docs before D.
- Listen-owner exits but remains listed as live in the RPC registry without documented stale-PID/reap behavior → back to B runtime/registry lane.

## 8. Final admission criteria

D is valid only when:

- P/A/B/C stages are advanced through `jwc orchestrate` commands.
- All C gates above are run or explicitly scoped with evidence.
- Goal ledger has a milestone update with implementation evidence, documentation evidence, and verification evidence.
- Final audit reads current source/docs and confirms every deliverable in section 1 has direct evidence.
