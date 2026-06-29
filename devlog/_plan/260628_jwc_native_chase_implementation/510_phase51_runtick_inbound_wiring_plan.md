# 510 Phase 51 plan — wire inbound routing into runDaemonTick (closes chase 10.032)

> Outcome: a polled Telegram update is routed (`routeTelegramInboundUpdate`) and executed
> (`executeInboundDispatchPlan`) inside `runDaemonTick`, using the phase-50 discovery snapshot bridge.
> This makes the daemon's button + free-text remote-answer path live end-to-end (session = final
> authority). Closes 10.032.

## Design

`runDaemonTick` already polls updates and advances the offset. Add OPTIONAL inbound processing (fully
backward-compatible — absent config => current behavior, unit tests unaffected).

### `daemon-inbound.ts` — add `processInboundUpdates`
```ts
processInboundUpdates(opts: {
  updates: TelegramUpdate[];
  registry: ThreadTopicRegistry;
  expectedChatIdFingerprint: string;
  loadRecord: (sessionId: string) => Promise<NotificationEndpointRecord | null>;
  isDuplicateUpdate: (updateId: number) => boolean;
  recordUpdateId?: (updateId: number) => void;
  effects: InboundDispatchEffects;
}): Promise<{ processed: number; results: ExecuteInboundResult[] }>
```
Steps:
1. Pre-load `Map<sessionId, {context?, token?}>` for sessions named by `registry.list()` (read each
   discovery record once per tick; `buildRemoteActionContextFromRecord`). Async pre-load resolves the
   sync `resolveActionContext` seam the router needs.
2. For each update: resolve the target session (`resolveTargetSession`, read-only — chat-fingerprint match
   + `registry.findByThread`), build a per-update `InboundRouterContext` with
   `presentedToken = preload.token` (the daemon is pre-authorized: it read the per-session connect token
   from the local trusted discovery file and matched the chat; this satisfies the deciders' token check,
   while the session re-validates authoritatively on forward), `resolveActionContext = sid =>
   contexts.get(sid)?.context`, shared `registry`/dedupe.
3. `routeTelegramInboundUpdate(update, ctx)` → plan → `executeInboundDispatchPlan(plan, effects)`. Collect.

`resolveTargetSession(update, registry, chatFp)` mirrors the router's chat/topic resolution at read-only
granularity (no dedupe side effects) for callback + message updates; returns `sessionId | undefined`.

### `daemon-engine.ts` — wire into `runDaemonTick`
Add optional `inbound?: { registry; effects; isDuplicateUpdate; recordUpdateId?; loadRecord? }` to
`RunDaemonTickOptions`. After a successful poll with updates AND inbound config present, call
`processInboundUpdates` and attach `inbound?: { processed; results }` to `DaemonTickResult`. `loadRecord`
defaults to `readNotificationDiscoveryRecord(agentDir, sessionId)`.

### `daemon-runtime.ts` — pass-through
Thread an optional `inbound` config from `RunManagedDaemonOptions` into each `runDaemonTick` call so the
wiring is reachable (no dead code). Daemon-level registry maintenance + real effect construction
(create/delete topic render loop) stays owned by 10.034 (already noted residual at 10.031 close).

## Done gate
- [ ] `processInboundUpdates`: routes+executes each update, pre-loads contexts once, correct
      per-update presentedToken; tested for accepted button (ack+forward), free-text forward, wrong-chat
      drop, stale/no-context behavior.
- [ ] `runDaemonTick` runs inbound only when configured; backward-compatible otherwise (existing
      daemon-engine tests pass unchanged).
- [ ] full notifications regression + check:types green.

## Then: close 10.032
Independent audit must confirm all 7 done-gates genuinely met (decision layer phases 44-49 + live path
50-51). If PASS, move card to _fin/10, fix links, append final-close, bump _fin/INDEX 33->34.
