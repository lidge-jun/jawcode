# 340 Phase 34 plan — notifications session lifecycle wiring (10.028 slice 3)

> Work-phase 34 = wire `NotificationLoopbackServer` into the live coding-agent session
> lifecycle (start on top-level session create when notifications enabled; stop on dispose),
> via a testable helper so the `sdk.ts` blast radius is one guarded call.
> Risk class: **C4** (core runtime path) → independent audit + minimal blast radius + helper tests.

## Part 1 — plain explanation

The loopback server (phase 33) is built and tested but not yet started by any real session.
This phase makes a top-level session start the server when the user has notifications enabled,
write its discovery file, and stop/remove it when the session disposes. A small helper module
holds the decision logic so it is unit-testable and the change to the large `sdk.ts` runtime file
is a single guarded `await` that can never break session startup.

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/session-lifecycle.ts`
```ts
export interface MaybeStartNotificationServerOptions {
  settings: Settings;
  sessionId: string;
  cwd: string;
  taskDepth?: number;
  registerCleanup: (name: string, cleanup: () => Promise<void> | void) => void;
  startServer?: typeof NotificationLoopbackServer.start; // injectable for tests
  now?: () => number;
}
export async function maybeStartNotificationServer(
  options: MaybeStartNotificationServerOptions,
): Promise<NotificationLoopbackServer | null>;
```
Logic:
1. `if ((options.taskDepth ?? 0) !== 0) return null;` — only top-level sessions (no subagent port proliferation).
2. `const config = getNotificationConfig(options.settings); if (!isNotificationEnabled(config)) return null;`
3. `const stateRoot = path.join(options.cwd, ".jwc", "state");` (matches `GJC_STATE_DIR`).
4. `try { const server = await start({ sessionId, stateRoot, now }); registerCleanup("notifications", () => server.stop()); return server; } catch (error) { console.error("[notifications] loopback server start failed", (error as Error).message); return null; }`
   — failure NEVER throws into session creation.

### MODIFY `packages/coding-agent/src/notifications/index.ts`
Add `export * from "./session-lifecycle";` (preserve all exports).

### MODIFY `packages/coding-agent/src/sdk.ts` (single guarded call)
At the integration point (after `settings` @850, `logicalSessionId` @902, and `toolCleanups`
@1183 exist — placed just before the `AgentSession` construction ~1969):
```ts
await maybeStartNotificationServer({
  settings,
  sessionId: logicalSessionId,
  cwd,
  taskDepth: options.taskDepth,
  registerCleanup: (name, cleanup) => toolCleanups.set(name, cleanup),
});
```
Add the import from `./notifications/session-lifecycle`. Exact local var names re-confirmed in B
before editing.

### NEW `packages/coding-agent/test/notifications-session-lifecycle.test.ts`
- disabled config (notifications off) → returns null, no cleanup registered.
- subagent (`taskDepth: 1`) → returns null even when enabled.
- enabled (isolated Settings + temp cwd) → real server started, discovery file present, cleanup
  registered under "notifications"; invoking the registered cleanup stops server + removes file.
- injected `startServer` that throws → returns null, no throw, no cleanup registered.

### NEW devlog `341_audit`, `342_build`, `343_check`.

## PABCD
- **A**: independent audit — confirm var names/scope at sdk.ts integration point, config/settings
  signatures, cleanup map semantics, taskDepth gating, failure isolation.
- **B**: Boss writes helper + test; minimal sdk.ts call; re-read exact sdk.ts locals first.
- **C**: `bun test test/notifications-session-lifecycle.test.ts` + full notifications suite +
  `bun run check:types` (covers the sdk.ts edit) + biome + `git diff --check`.
- **D**: commit. Note `10.028` still has ONE done-gate pending at live level: ask-flow forwarding
  (ask tool → `enqueueAction`) = phase 35, after which the card closes.

## Constraints
- Failure isolation: notification start must never break session creation.
- Top-level sessions only (`taskDepth === 0`). JWC `.jwc/state` path. ES modules. File ≤400 lines.
- Do NOT close `10.028` this phase (ask-flow forwarding pending).
