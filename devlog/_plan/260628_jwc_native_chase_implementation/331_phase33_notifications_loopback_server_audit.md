# 331 Phase 33 audit — notifications loopback server (independent, read-only)

> Audits plan `330`. Read-only. Verdict: **PASS with 4 mandatory signature corrections**.

## Corrections the build applied

1. `NotificationEndpointRecord` uses `version` (not `protocolVersion`) and requires `updatedAt`;
   has **no** `display` field. Server writes `{version, sessionId, url, host, port, token,
   startedAt, updatedAt, pid}`. (`discovery.ts:7-18`)
2. `NotificationSessionRegistry.connect(presentedToken)` returns
   `NotificationConnectSnapshot {sessionId, frames[]} | {rejected:true, reason:"unauthorized"}` —
   server discriminates on `"rejected" in decision` and replays `decision.frames`. The hello +
   buffered `action_needed` frames are pre-built inside `frames`. (`session-registry.ts:78-96`)
3. `resolveRemote` needs a full `RemoteAnswerInput {sessionId, actionId, idempotencyKey, transport,
   kind, value, presentedToken?}`. The thin `reply` frame only carries `{actionId, value, source?}`,
   so the server synthesizes the rest: `idempotencyKey = randomUUID()`, `transport = "telegram"`
   (only allowed literal), `kind` inferred from the enqueued draft's options
   (`options.includes(value) ? "button" : "free_text"`), `presentedToken` = the WS query token.
   (`remote-answer.ts:11-20`)
4. Frame discriminant is `type`; ServerFrame types `action_needed|action_resolved|reply_rejected|
   hello|pong`, ClientFrame `reply|hello|ping`. (`protocol.ts`)

## Confirmed

- Bun 1.3.x native `Bun.serve({websocket})` + `server.upgrade(req,{data})` viable; loopback port:0
  pattern proven by `src/eval/py/tool-bridge.ts`.
- Global `WebSocket` available in `bun:test` (real-client tests feasible).
- Security posture sound: loopback-only bind, token validated at upgrade (pre-upgrade 401),
  discovery file `0600`/`0700` handled inside `discovery.ts`, `maskToken` available; token never logged.
- `isNotificationConnectTokenAccepted` uses `===` (non-constant-time) — acceptable on loopback (LOW).

No blocking issues.
