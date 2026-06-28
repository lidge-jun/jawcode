# 341 Phase 34 audit — session lifecycle wiring (independent, read-only)

> Audits plan `340`. Verdict: **PASS, zero blocking issues**.

## Confirmed against live code

- sdk.ts locals at the integration point (single line, before `AgentSession` ctor):
  `settings` (`sdk.ts:850`, type `Settings`), `logicalSessionId` (`:902`, string),
  `cwd` (`:817`), `toolCleanups` (`:1183`, `Map<string, () => Promise<void> | void>`),
  `options.taskDepth` (`:986`, defaulted to 0). Integration line **`sdk.ts:1968`** — and
  `toolCleanups` is passed to `AgentSession` at `:1969`, so a `.set()` at `:1968` is visible to
  `dispose()`.
- `getNotificationConfig(settings: Settings): ResolvedNotificationConfig` and
  `isNotificationEnabled(Pick<…,"enabled"|"configured">)` accept sdk.ts's `Settings`.
- `NotificationLoopbackServer.start({sessionId, stateRoot, connectToken?, now?})` and idempotent
  `async stop()` match the plan.
- Cleanups run via `Promise.allSettled` in `agent-session.ts:3368-3380` — sync/async both handled.
- `taskDepth === 0` correctly identifies top-level (non-subagent) sessions.
- No import cycle (notifications/* never imports sdk.ts). Start is <5ms, try/catch-isolated — cannot
  deadlock or break startup.
- Test feasible via `Settings.isolated({...})` + temp `cwd`.

No corrections beyond cosmetic. PASS → build.
