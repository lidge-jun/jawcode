# 350 Phase 35 plan — ask-flow remote forwarding (closes 10.028)

> Work-phase 35 = bridge the live human-in-the-loop `ask` gate to the running notification server:
> agent ask → broadcast `action_needed`; a REMOTE reply resolves the SAME ask; LOCAL answer wins
> the race. Closes the last `10.028` done-gate.
> Risk class: **C4** (core interactive path) → independent audit MUST pre-verify ask.ts signatures
> + AbortSignal composition before any core-path edit; gated behind `if (server)` + single-question.

## Part 1 — plain explanation

When notifications are enabled and the agent asks the user a question, remote clients should see
the question and be able to answer it; whichever side answers first (local terminal or remote) wins.
The server already implements the race internally; this phase connects the server's remote-answer
event to the local ask gate and dismisses the local dialog when the remote side wins — without
aborting the whole turn.

## Part 2 — diff-level plan (≈45 lines, 3 files + tests)

### 1. MODIFY `packages/coding-agent/src/notifications/server.ts` (~6 lines)
Add an outbound hook so the host learns when a remote reply is accepted:
```ts
#onRemoteResolved: ((actionId: string, value: string) => void) | undefined;
setOnRemoteResolved(cb: (actionId: string, value: string) => void): void { this.#onRemoteResolved = cb; }
```
In `#handleMessage` `reply` case, after `resolveRemote(...)` returns `action_resolved`, call
`this.#onRemoteResolved?.(frame.actionId, frame.value);` (only on resolved, before/after broadcast).

### 2. NEW `packages/coding-agent/src/notifications/ask-bridge.ts` (~30 lines, fully unit-tested)
A transport-agnostic race helper (no TUI dependency):
```ts
export interface AskBridgeServer {
  enqueueAction(d: {actionId; prompt; options?; allowFreeText?}): unknown;
  resolveLocal(actionId: string): unknown;
  setOnRemoteResolved(cb: (actionId: string, value: string) => void): void;
}
export interface AskBridgeResult { source: "local" | "remote"; value: string; }
// Enqueues the ask, races a caller-provided localAnswer Promise against a remote answer for
// `actionId`; on local win → resolveLocal + returns {local}; on remote win → returns {remote, value}
// and aborts the provided dismiss controller so the caller can close the local dialog.
export async function bridgeAsk(
  server: AskBridgeServer,
  params: { actionId: string; prompt: string; options?: string[]; allowFreeText?: boolean;
            localAnswer: Promise<string | undefined>; dismiss: AbortController },
): Promise<AskBridgeResult>;
```
Manages the `setOnRemoteResolved` subscription lifecycle (single-shot, actionId-matched, cleared on
either outcome). Pure logic → unit-testable with a fake server + a controllable localAnswer promise.

### 3. MODIFY `packages/coding-agent/src/tools/ask.ts` (~10 lines, gated)
Only for `params.questions.length === 1` AND `session.getNotificationServer?.()` present:
- create `const dismiss = new AbortController()`;
- run the existing single-question select under a composed signal
  `AbortSignal.any([signal, dismiss.signal])` (so a remote win dismisses ONLY this dialog, not the
  turn) as the `localAnswer` promise;
- `const r = await bridgeAsk(server, {actionId: toolCallId, prompt, options, allowFreeText, localAnswer, dismiss});`
- if `r.source === "remote"` return the remote value as the selection; else proceed as today.
When no server / multi-question → existing path UNCHANGED.

### 4. MODIFY `packages/coding-agent/src/tools/index.ts` + `sdk.ts` (~8 lines)
- Add `getNotificationServer?: () => NotificationLoopbackServer | undefined` to `ToolSession`.
- In `sdk.ts`, capture the server returned by `maybeStartNotificationServer` into a closure
  `let notificationServer` and expose it via the getter on the toolSession literal.

### 5. NEW `packages/coding-agent/src/notifications/index.ts` export for ask-bridge.

### Tests
- `test/notifications-server.test.ts`: extend — `setOnRemoteResolved` fires with (actionId,value) on a WS reply.
- NEW `test/notifications-ask-bridge.test.ts`: local-wins (localAnswer resolves first → resolveLocal called, source local, remote callback cleared); remote-wins (localAnswer hangs, server fires remote → source remote + value, dismiss aborted); cleanup on both.
- `test/tools/ask.test.ts` (or new): single-question + mock server firing remote → ask returns remote value; no server → unchanged path.

## PABCD
- **A (pre-verify, mandatory)**: confirm exact ask.ts `execute`/`askSingleQuestion`/`selectOption`
  signatures + how `signal` flows into `ui.select`, that `AbortSignal.any` is available in the Bun
  runtime, the `toolCallId`/selection-return shape, and that the gated wrap preserves existing
  behavior. If the ask.ts integration is riskier than designed → NARROW to foundation-only
  (server hook + ask-bridge + accessor, wire ask.ts in phase 36).
- **B**: re-read ask.ts precisely before editing; implement smallest gated change.
- **C**: server + ask-bridge + ask tool tests + full notifications suite + check:types + biome + diff-check.
- **D**: if green, **close 10.028 to _fin** (move card, update follow-index/MOC/gap-inventory/INDEX),
  recording phases 33/34/35 evidence. Otherwise commit foundation and carry ask.ts wiring to phase 36.

## Constraints
- Core interactive path: change MUST be gated (`if server && single-question`); default path untouched.
- Remote win dismisses only the local dialog (composed AbortController), never the turn.
- JWC names; ES modules; files ≤400 lines.
