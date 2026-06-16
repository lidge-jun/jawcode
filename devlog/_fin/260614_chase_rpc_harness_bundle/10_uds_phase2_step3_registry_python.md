# 10 — UDS Phase 2 step 3: registry + Python client

> **Goal**: make UDS-owned RPC sessions discoverable and provide a Python client path without breaking stdio clients.

## Files

| File | Change |
|---|---|
| `packages/coding-agent/src/modes/shared/agent-wire/session-registry.ts` | Optional transport metadata in session records. |
| `packages/coding-agent/test/rpc-session-registry.test.ts` | Registry compatibility tests for stdio + UDS metadata. |
| `python/jwc-rpc/src/jwc_rpc/registry.py` | Parse optional `transport` and `endpoint` fields; no `listenPath`/`listen_path` rename in this cycle. |
| `python/jwc-rpc/tests/test_registry.py` | Add UDS metadata sample while keeping old records valid. |
| `python/jwc-rpc/src/jwc_rpc/client.py` | Add Unix socket connection helper after server smoke is green. |
| `python/jwc-rpc/tests/test_client.py` or new `test_client_uds.py` | Fake UDS server/client roundtrip. |
| `python/jwc-rpc/README.md` | Document stdio default and optional UDS attach. |

## Registry schema

Keep records backward-compatible. Existing readers must survive old and new records.

Canonical optional fields (superseding older `transport: "uds"` / `listenPath` drafts):

```json
{
  "pid": 12345,
  "sessionFile": "/path/to/session.jsonl",
  "cwd": "/repo",
  "updatedAt": "2026-06-14T00:00:00.000Z",
  "transport": "socket",
  "endpoint": "/tmp/jwc-rpc.sock"
}
```

Rules:

- `transport` omitted means legacy/stdin-stdio owner.
- `transport: "stdio"` is allowed but not required.
- `transport: "socket"` requires `endpoint` for attach helpers.
- Python parser should expose unknown/optional fields without failing old records.

## Python client design

### Existing constructor remains default

`RpcClient(command=...)` continues to spawn `jwc --mode rpc` and speak stdio over `subprocess.Popen` pipes.

### Add UDS attach path

Recommended API:
 
```py
client = RpcClient.connect_unix("/tmp/jwc-rpc.sock")
```

Use the classmethod only in this cycle; do not add a public `socket_path=` constructor overload.

```py
@classmethod
def connect_unix(cls, socket_path: str | Path, *, startup_timeout: float = 30.0, request_timeout: float = 30.0, max_event_history: int | None = 10_000) -> "RpcClient": ...
```

Internal changes:

- Add a small transport abstraction or minimal socket-backed read/write path.
- Keep existing process-backed `_stdout_thread` / `_stderr_thread` path intact.
- For socket transport:
  - connect `socket.socket(AF_UNIX, SOCK_STREAM)`.
  - read JSONL from socket file wrapper or a dedicated recv loop.
  - write JSONL with the same `_write_json` semantics, but to socket.
  - `close()` closes socket without killing a process.
  - ready wait uses existing `_ready` event.

## Fake UDS server test

Python client tests do not need to spawn the real jwc binary for first pass. Use a small local Unix socket server that:

1. Accepts connection.
2. Sends `{"type":"ready"}\n`.
3. Reads one request.
4. Sends a correlated response:

```json
{"type":"response","id":"req_1","command":"get_state","success":true,"data":{"sessionId":"fake"}}
```

Assertions:

- Client reaches ready state.
- `get_state()` returns parsed `SessionState` or raw equivalent expected by current parser.
- Closing client does not attempt to terminate a subprocess.
- Cross-check runtime black-box expectations from [09](./09_uds_phase2_step2_runtime_server.md) and [11](./11_uds_phase2_step4_verification.md): malformed JSONL must not kill the owner, reconnect must handle `get_state`, and listen-owner registry records must be reaped/removed after termination or documented in `14_uds_phase2_implementation_log.md`.

## Registry-to-client flow

After both registry metadata and Python UDS client exist, add a documented helper flow:

```py
from jwc_rpc import list_sessions, RpcClient

sessions = list_sessions()
owner = next(s for s in sessions if s.transport == "socket" and s.endpoint)
client = RpcClient.connect_unix(owner.endpoint)
```

Do not make `list_sessions()` auto-connect. Discovery and attach remain explicit.

## Completion evidence

Record:

```text
B3 evidence: registry parser accepts UDS metadata; Python UDS fake-server client test green; stdio Python tests unchanged.
```
