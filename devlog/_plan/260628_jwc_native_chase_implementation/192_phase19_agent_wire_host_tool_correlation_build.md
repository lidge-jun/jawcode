# 192 Phase 19 build — agent-wire host tool correlation

## Build summary

Phase 19 implements partial `10.051-B` host-tool bridge correlation hardening as focused tests. No production code change was required; the existing `RpcHostToolBridge` behavior satisfied the new invariants.

## Files changed

| File | Change |
|---|---|
| `packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts` | Added focused correlation tests for generated request ids, original `toolCallId`, mismatch rejection, update routing, abort cancel `targetId`, late-frame rejection, and `rejectAllPending()`. |
| `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md` | Added Phase 19 partial `10.051-B` evidence and kept the card active. |

## Behavior proven

1. `host_tool_call` frames preserve the caller `toolCallId` while using a distinct generated request id for host result/update correlation.
2. `handleResult()` ignores unrelated ids, resolves only the matching generated id, and rejects late duplicate results after settlement.
3. `handleUpdate()` routes only matching generated ids and does not settle the pending call.
4. Abort emits `host_tool_cancel` with `targetId` equal to the generated request id, then ignores late result/update frames.
5. `rejectAllPending()` rejects multiple pending host tool calls and prevents later frames from being accepted.

## Residual risk

This phase closes only the partial `10.051-B` host-tool correlation subset. Digest/bounded-observation coverage and `20.009-A` append-only overlap evidence remain open.
