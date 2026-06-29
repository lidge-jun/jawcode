# 191 Phase 19 audit — agent-wire host tool correlation

## Backend audit 1

Verdict: PASS.

Confirmed:

- `RpcHostToolBridge`, `handleResult`, `handleUpdate`, `requestExecution`, and `rejectAllPending` are public and testable without private-field access.
- `RpcHostToolCallRequest`, `RpcHostToolCancelRequest`, `RpcHostToolUpdate`, and `RpcHostToolResult` shapes match the plan.
- Planned assertions align with the implementation: generated request id, original `toolCallId`, `targetId` on cancel, ignored id-mismatch results, update callback routing, and late-frame rejection.
- Verification commands are scoped and do not overclaim full `10.051` closure.
- No production protocol/version change is planned.

Non-blocking adjustments applied:

- Clarified overlap with existing `packages/coding-agent/test/rpc-host-tools.test.ts` and narrowed Phase 19 toward net-new id-mismatch, late-frame, and bulk teardown invariants.
- Clarified chase evidence should say partial `10.051-B` correlation subset; digest/bounded-observation and `20.009-A` append-only overlap remain open.
