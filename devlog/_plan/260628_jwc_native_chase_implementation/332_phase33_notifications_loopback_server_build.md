# 332 Phase 33 build — notifications loopback server

> Boss-direct build after audit `331` PASS. Bun-native, no external dependency.

## Changes

### NEW `packages/coding-agent/src/notifications/server.ts` (~170 lines)
`NotificationLoopbackServer` — thin Bun WebSocket transport over `NotificationSessionRegistry`:

- `static async start({sessionId, stateRoot, connectToken?, now?})`: generates `connectToken`
  (`crypto.randomUUID()`) when absent; `Bun.serve<NotificationWsData>({hostname:"127.0.0.1",
  port:0, fetch, websocket})`; writes the `0600` discovery record
  (`version/sessionId/url/host/port/token/startedAt/updatedAt/pid`) after bind.
- `#handleFetch`: parses `?token=`, **rejects unauthorized at upgrade** (401 before any WS open)
  via `isNotificationConnectTokenAccepted`; otherwise `server.upgrade(req,{data:{token}})`.
- `#handleOpen`: `registry.connect(token)` → on `{rejected}` close 1008; else add socket + send
  hello + buffered `action_needed` replay frames.
- `#handleMessage`: JSON-guarded; `ping`→`pong`, `hello`→noop, `reply`→`registry.resolveRemote`
  (synthesized `RemoteAnswerInput`: `idempotencyKey=randomUUID`, `transport:"telegram"`,
  `kind` from enqueued draft options, `presentedToken`), unknown→ignore (forward-compat).
  `action_resolved` broadcasts to all; `reply_rejected` sent to the replying socket only.
- `enqueueAction` / `resolveLocal`: delegate to registry + broadcast.
- `stop()`: idempotent — close sockets, `server.stop(true)`, `removeNotificationDiscoveryRecord`.
- Token never logged; only boundary `console.error` on send/close failures.

### MODIFY `packages/coding-agent/src/notifications/index.ts`
Added `export * from "./server";` (alphabetical; all prior exports preserved).

### NEW `packages/coding-agent/test/notifications-server.test.ts` (7 tests)
Real `WebSocket` client tests: token reject (wrong+missing), hello+replay, live broadcast,
remote reply→resolved, local-wins race→reply_rejected, `0600` discovery write + removal on stop
(+ idempotent stop), ping→pong + malformed tolerance.

## Type fixes applied during build
- `Server<NotificationWsData>` generic arg (3 sites); `Bun.serve<NotificationWsData>` (drop 2nd arg).
- `server.port` guarded for `number | undefined`; `server.upgrade` is non-generic in this Bun-types.

## Scope note
This phase delivers the transport unit. Live `sdk.ts` session start/stop wiring (call `start()`
on session create, `registerSessionCleanup` → `stop()`) is the next work-phase before `10.028`
closes.
