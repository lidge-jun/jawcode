# 352 Phase 35 build — ask-flow remote forwarding

> Boss-direct build after audit `351` PASS. Closes the last `10.028` live done-gate.

## Changes

### MODIFY `packages/coding-agent/src/notifications/server.ts` (~9 lines)
Added `#onRemoteResolved` field + `setOnRemoteResolved(cb)` setter. In `#handleMessage` `reply` case,
after `resolveRemote` returns `action_resolved`, call `this.#onRemoteResolved?.(frame.actionId,
frame.value)` (value sourced from the client reply frame, since the resolved frame omits it).

### NEW `packages/coding-agent/src/notifications/ask-bridge.ts` (~75 lines, unit-tested)
`bridgeAsk<T>(server, {actionId, prompt, options?, allowFreeText?, local, dismiss, onRemote})`:
enqueues the action, races `local` (tagged so a post-race rejection is swallowed) against a remote
reply matched on `actionId`; local win → `resolveLocal` + return local result; remote win →
`dismiss.abort()` (cancels local prompt) + return `onRemote(value)`; subscription always cleared.
`AskBridgeServer` is a structural interface (NotificationLoopbackServer satisfies it).

### MODIFY `packages/coding-agent/src/tools/ask.ts` (~25 lines, gated)
- `_toolCallId` → `toolCallId` (now used as `actionId`).
- `askQuestion` accepts `options.signalOverride`, passed to `askSingleQuestion`'s `signal`.
- Single-question path: when `getNotificationServer()` present and not unattended, wrap the local
  `askQuestion` under `AbortSignal.any([signal, dismiss.signal])` and route through `bridgeAsk`;
  remote answers map to selected option (if it matches a label) or free-text custom input. No server
  / multi-question → existing path unchanged.

### MODIFY `packages/coding-agent/src/tools/index.ts` + `sdk.ts` (~6 lines)
Added `getNotificationServer?` to `ToolSession`; sdk.ts captures the started server into a closure and
exposes it via the getter (mirrors `getWorkflowGateEmitter`).

### MODIFY `packages/coding-agent/src/notifications/index.ts`
Added `export * from "./ask-bridge";`.

### Tests
- `notifications-ask-bridge.test.ts` (3): local-wins (+resolveLocal), remote-wins (+dismiss, actionId
  filter), local-rejection propagation.
- `notifications-server.test.ts` (+1): `setOnRemoteResolved` fires `(actionId,value)` on accepted reply.
- `tools/ask.test.ts` (+2): remote wins over a hanging local prompt → returns remote value; no-server
  path unchanged.

## Verification handoff
C: bridge + server + ask suites + full notifications regression + `check:types` + biome + diff-check.
D: close `10.028` to `_fin` (all 6 done-gates met).
