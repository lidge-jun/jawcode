# 501 Phase 50 build+check — live pending-action snapshot bridge + inbound execution layer

> Plan `500`. Independent CLI sub-agent plan audit PASS (no blocking; verified isEndpointRecord is open
> so the optional field is backward-compatible, all RemoteActionContext/InboundDispatchAction shapes
> match, token-auth chain confirmed). Slice does NOT touch `runDaemonTick` (phase 51).

## Changes
### `src/notifications/discovery.ts`
New optional `NotificationEndpointRecord.pendingAction?: NotificationPendingActionSnapshot`
(`{actionId, options?, allowFreeText?}`). No token/prompt/secret. Backward-compatible: `isEndpointRecord`
(transport-shell) validates only required fields, `read` is a JSON cast, `write` is `JSON.stringify`.

### `src/notifications/server.ts`
- Capture the base discovery record at `start()`; track `#pendingActionId`; `#lastPublish` promise.
- `enqueueAction` publishes `{actionId, options, allowFreeText}`; `resolveLocal` and the remote
  `action_resolved` path clear it via `#clearPendingActionIfActive`.
- `#publishPendingAction` is best-effort (rewrite record + bump `updatedAt`; write errors swallowed and
  logged without the token) so a discovery write can never block/fail an ask.
- `whenPendingActionPublished()` test/wiring hook awaits the latest publish.

### `src/notifications/daemon-inbound.ts` (NEW)
- `buildRemoteActionContextFromRecord(record)` → preliminary `RemoteActionContext` (undefined when stale or
  no pendingAction). Daemon-side context for decoding compact button callbacks; session re-validates.
- `executeInboundDispatchPlan(plan, effects)` → runs a router plan against injected effects
  (`answerCallback`, `forwardToSession`); every action isolated (never throws); returns
  `{executed[], acked, forwarded, dropped, failed}`; token-safe.

### `src/notifications/index.ts` — export daemon-inbound.

## Verification
- `bun test test/notifications-daemon-inbound.test.ts test/notifications-server.test.ts test/notifications-discovery.test.ts`
  → **24 pass / 0 fail** (12 new: 4 context-build, 6 executor, +4 server publish/clear).
- Full `bun test test/notifications-*.test.ts test/notify-cli.test.ts`
  → **195 pass / 0 fail / 545 expect()** across 31 files.
- `bun run check:types` → exit 0 (fixed: normalize `#lastPublish` to `Promise<void>` since
  `writeNotificationDiscoveryRecord` returns the path string). `bunx biome check` clean; `git diff --check` clean.

## Result
Live free-text inbound already resolves authoritatively via forward; buttons now decodable daemon-side via
the published options snapshot. Done-gates for this slice met. 10.032 NOT yet closed — phase 51 wires
router + bridge + executor into `runDaemonTick`, then the card closes.
