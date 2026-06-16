# 09 — UDS Phase 2 step 2: runtime server

> **Goal**: implement the persistent Unix-domain socket server while preserving the existing stdio JSONL transport.

## Files

| File | Change |
|---|---|
| `packages/coding-agent/src/modes/rpc/rpc-mode.ts` | Port upstream listen branch using jwc naming and existing Phase 1 command scheduler. |
| `packages/coding-agent/test/rpc-listen-socket-guard.test.ts` | Live/stale socket guard unit tests. |
| `packages/coding-agent/test/rpc-uds-listen.test.ts` | Black-box UDS server smoke. |

## Runtime shape

### New helper

```ts
export async function isUnixSocketAlive(socketPath: string): Promise<boolean>;
```

Expected behavior:

- Returns `true` only when a connection succeeds.
- Returns `false` for missing path or stale socket path with no listener.
- Does not throw for normal `ENOENT` / `ECONNREFUSED` cases.

### `runRpcMode` signature

```ts
export async function runRpcMode(
  session: AgentSession,
  setToolUIContext?: (uiContext: ExtensionUIContext, hasUI: boolean) => void,
  options?: { listen?: string },
): Promise<never>;
```

## Transport behavior

### stdio mode

Unchanged:

1. `process.env.PI_NOTIFICATIONS = "off"`.
2. Frames write to stdout.
3. Emit `{ type: "ready" }` immediately.
4. Read `process.stdin` via `readLines`.
5. Dispatch each complete JSONL frame through existing scheduler.

### UDS listen mode

1. `frameSink` starts as stdout fallback but is replaced per accepted socket.
2. Do **not** emit `ready` to stdout.
3. `mkdir -p dirname(socketPath)`.
4. If socket path exists:
   - `isUnixSocketAlive(socketPath) === true` → throw/refuse startup.
   - otherwise unlink stale file.
5. `Bun.listen({ unix: socketPath, socket: ... })`.
6. On socket open:
   - set `frameSink` to socket writer.
   - emit `{ type: "ready" }` to that socket.
7. On socket data:
   - append UTF-8 text to connection buffer.
   - split by `\n`.
   - pass each complete line to `handleInboundLine(text)`.
8. On close/error:
   - clear active sink if it belongs to that socket.
   - do not terminate the RPC process solely because one client disconnects.

## Important invariants

- `handleInboundLine()` remains the only parse+dispatch path.
- Scheduler semantics remain unchanged: fast-lane read/cancel commands bypass ordered chain; mutating commands stay ordered.
- Extension UI/host tool/host URI frames use the same `output()` sink as responses/events.
- A UDS server can outlive a client reconnect, but Phase 2 does not guarantee multi-client broadcast.
- `registerRpcSession` still occurs once per server process, not per client.
- `unregisterRpcSession` must still run when the RPC process exits.

## Error handling

Preferred errors:

| Failure | Error |
|---|---|
| Live socket path | `rpc listen socket already in use: <path>` |
| Socket path too long / bind failure | include path and original error message |
| Invalid JSONL from client | emit RPC parse error frame to active socket, do not crash |

## Tests

### Socket guard test

- Starts a dummy `Bun.listen({ unix })` server.
- `isUnixSocketAlive(sock)` returns `true`.
- Starting RPC listen on same path rejects.
- After dummy server closes, stale socket cleanup path can proceed.

### UDS smoke

- Spawn `jwc --mode rpc --listen <tmp.sock>`.
- Connect with `Bun.connect({ unix })`.
- Read `ready` from socket.
- Send `{"id":"req_1","type":"get_state"}\n`.
- Assert response `id === "req_1"`, `type === "response"`, `success === true`.
- Send a malformed non-JSON line, assert a parse error frame, then assert a subsequent valid `get_state` still succeeds.
- Assert registry discovery for the spawned owner: `transport === "socket"` and `endpoint === <tmp.sock>` via TypeScript `listRpcSessions` and Python `list_sessions()` coverage where practical.
- Disconnect and reconnect a client; assert the reconnect receives `ready` and a second `get_state` success response.
- After killing the process, assert the listen registry record is reaped/removed; if the socket file itself remains, document that residual in `14_uds_phase2_implementation_log.md`.
- Kill process and assert socket file cleanup if implemented; if Bun leaves path, document cleanup behavior.

## Completion evidence

Record:

```text
B2 evidence: UDS ready+get_state smoke green; live socket clobber guard green; stdio redteam still green.
```
