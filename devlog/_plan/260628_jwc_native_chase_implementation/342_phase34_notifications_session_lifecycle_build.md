# 342 Phase 34 build — session lifecycle wiring

> Boss-direct build after audit `341` PASS. Minimal sdk.ts blast radius via a testable helper.

## Changes

### NEW `packages/coding-agent/src/notifications/session-lifecycle.ts` (~50 lines)
`maybeStartNotificationServer({settings, sessionId, cwd, taskDepth?, registerCleanup, startServer?,
now?})`:
- returns `null` when `(taskDepth ?? 0) !== 0` (subagent sessions skipped — no port proliferation);
- returns `null` when `!isNotificationEnabled(getNotificationConfig(settings))`;
- `stateRoot = path.join(cwd, ".jwc", "state")`;
- `try` → `start({sessionId, stateRoot, now})` + `registerCleanup("notifications", () => server.stop())`;
- `catch` → `console.error` + `return null` — a start failure NEVER throws into session creation.
- `startServer` is injectable for tests.

### MODIFY `packages/coding-agent/src/notifications/index.ts`
Added `export * from "./session-lifecycle";` (preserve all exports).

### MODIFY `packages/coding-agent/src/sdk.ts` (2 lines net)
- Import `maybeStartNotificationServer` from `./notifications/session-lifecycle` (after memory-backend).
- Single guarded `await maybeStartNotificationServer({settings, sessionId: logicalSessionId, cwd,
  taskDepth: options.taskDepth, registerCleanup: (name, cleanup) => toolCleanups.set(name, cleanup)})`
  inserted at `sdk.ts:1968`, just before the `AgentSession` constructor.

### NEW `packages/coding-agent/test/notifications-session-lifecycle.test.ts` (4 tests)
disabled→null/no-cleanup; subagent(taskDepth 1)→null; enabled→real server + discovery file +
`"notifications"` cleanup that stops+removes on invocation; injected throwing `startServer`→null,
no throw, no cleanup.

## Verification handoff
C: lifecycle suite + full notifications suite + `check:types` (covers sdk.ts edit) + biome + diff-check.

## Scope
`10.028` still has the ask-flow forwarding done-gate (ask tool → `enqueueAction`) pending = phase 35.
