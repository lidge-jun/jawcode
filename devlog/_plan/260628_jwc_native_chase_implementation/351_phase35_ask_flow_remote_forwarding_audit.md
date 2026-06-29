# 351 Phase 35 audit — ask-flow remote forwarding (independent, read-only)

> Audits plan `350`. Verdict: **PASS, scope=full, zero blocking issues**.

## Confirmed against live code
- `AskTool.execute(toolCallId, params, signal?, _onUpdate?, context?)` — `toolCallId` is the stable
  per-invocation LLM tool_call id, usable as the notification `actionId`.
- `ui.select` returns `Promise<string | undefined>`; a remote string maps cleanly into the
  `askQuestion` result shape (selectedOptions/customInput).
- `AbortSignal.any([...])` is supported (35 existing uses); `untilAborted` (`packages/utils/src/
  abortable.ts`) rejects `AbortError` on signal — so aborting a local-only dismiss controller cancels
  the dialog without aborting the turn.
- ToolSession closure-getter wiring is order-safe (mirror `getWorkflowGateEmitter`): a `let
  notificationServer` assigned after the toolSession literal is visible to the getter at tool-exec time.
- Gated condition (`questions.length === 1 && getNotificationServer() && !canUseWorkflowGate`) cleanly
  bypasses the unattended gate path and the multi-question loop.
- `action_resolved` frame has no value → the `setOnRemoteResolved` callback must source the value from
  the client reply frame in `#handleMessage` (plan does this).
- Post-race local rejection must be swallowed to avoid an unhandled rejection (plan's `localTagged`
  `.catch` handles it).

No blockers → full build.
