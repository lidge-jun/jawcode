# 330 Phase 33 plan — notifications loopback WebSocket server (10.028 slice 2)

> Goal: JWC-native chase implementation (active). Work-phase 33 = the loopback WebSocket
> transport for the notifications SDK (card `10.028`), building on the transport-complete
> `NotificationSessionRegistry`. Live `sdk.ts` session wiring is deferred to a follow-up phase.
> Risk class: **C4** (auth token, loopback socket, remote reply resolution) → independent
> read-only audit + security review mandatory.

## Part 1 — plain explanation

The notification SDK already has all the *logic* (who may connect, action replay, remote vs
local answer race) in `session-registry.ts`, but no actual network surface. This phase adds the
thin transport: a localhost-only WebSocket server that authenticates clients by a per-session
token, replays buffered asks to late joiners, accepts remote replies, and broadcasts resolution
frames — then writes/removes the discovery file so local clients can find it. No external
dependency: Bun's built-in `Bun.serve({ websocket })` (same loopback+token pattern as
`src/eval/py/tool-bridge.ts`).

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/server.ts`
A `NotificationLoopbackServer` class wrapping `Bun.serve` + `NotificationSessionRegistry`:

- `static async start(options): Promise<NotificationLoopbackServer>`
  - `options`: `{ sessionId: string; stateRoot: string; connectToken?: string; resolverAvailable?: boolean; now?: () => number; display?: NotificationEndpointDisplay }`
  - generate `connectToken` if not supplied: `crypto.randomUUID()` (never logged).
  - construct `new NotificationSessionRegistry({ sessionId, connectToken })`.
  - `Bun.serve({ hostname: "127.0.0.1", port: 0, fetch, websocket })`:
    - `fetch(req, server)`: parse `?token=` from URL; if `server.upgrade(req, { data: { authed: isNotificationConnectTokenAccepted(connectToken, presented) } })` → return; else `401`. Reject upgrade when token invalid (close on open with `reply_rejected`-style or refuse upgrade → respond 401, do NOT upgrade).
    - `websocket.open(ws)`: if `!ws.data.authed` → `ws.close(1008, "unauthorized")`; else add to `Set<ServerWebSocket>`, call `registry.connect(token)` and send the hello + replay frames from the decision snapshot.
    - `websocket.message(ws, raw)`: JSON.parse guarded; if `reply` frame → `registry.resolveRemote(...)` → broadcast resulting frame; if `ping` → send `pong`; unknown → ignore (forward-compat).
    - `websocket.close`: remove from set.
  - after bind, write discovery: `await writeNotificationDiscoveryRecord(stateRoot, { sessionId, host, port, url, token: connectToken, protocolVersion, pid, startedAt, display })` (`0600`).
- instance methods:
  - `get url()` / `get port()` — bound address.
  - `enqueueAction(draft): NotificationActionNeededFrame` — `registry.enqueueAction` then broadcast the frame.
  - `resolveLocal(actionId): NotificationServerFrame` — `registry.resolveLocal` then broadcast.
  - `async stop(): Promise<void>` — idempotent: stop `Bun.serve`, close sockets, `removeNotificationDiscoveryRecord(stateRoot, sessionId)`.
- `broadcast(frame)`: `JSON.stringify` once, iterate authed socket set. Never log token/frame bodies.

Exact registry/discovery/protocol signatures will be re-read from the source before coding
(B phase) to match field names precisely.

### MODIFY `packages/coding-agent/src/notifications/index.ts`
Add `export * from "./server";` (barrel; preserve existing exports).

### NEW `packages/coding-agent/test/notifications-server.test.ts`
Real-WS-client tests (connect with `new WebSocket(server.url + "?token=...")`):
1. wrong/missing token → connection closed/refused (no frames, no leak).
2. valid token → receives `hello` + buffered `action_needed` replay.
3. `enqueueAction` after connect → client receives `action_needed`.
4. client sends `reply` → receives `action_resolved` (remote answer path).
5. local answer first (`resolveLocal`) then remote `reply` → remote gets `reply_rejected`.
6. discovery file exists with `0600` while running and is removed after `stop()`; token never appears in any log buffer.
7. `ping` → `pong`; malformed JSON ignored (connection stays open).

### NEW devlog
`331_phase33_..._audit.md`, `332_..._build.md`, `333_..._check.md`.

## PABCD

- **A**: independent read-only audit — verify signatures match real `session-registry.ts`/
  `discovery.ts`/`config.ts`/`protocol.ts`, no token-logging, loopback-only bind, upgrade-time
  rejection, race semantics delegated to registry (not re-implemented).
- **B**: Boss writes `server.ts` + test; re-read exact signatures first; Bun-native only.
- **C**: `bun test test/notifications-server.test.ts` (+ existing notifications suites for no
  regression) and `bun run check:types`; `git diff --check`.
- **D**: commit; record that `10.028` done-gate items (loopback server, token reject, remote
  answer→resolved, local-wins race, discovery removal) are met at the transport level; live
  `sdk.ts` session start/stop wiring is the next work-phase before card close.

## Constraints

- No external WebSocket dep — Bun `Bun.serve` native.
- 127.0.0.1 only; token from `?token=`; validate at upgrade; never log token or frame bodies.
- JWC names; `.jwc/state/notifications`. ES modules. File ≤400 lines (split if needed).
- Do NOT close `10.028` this phase (live session wiring still pending).
