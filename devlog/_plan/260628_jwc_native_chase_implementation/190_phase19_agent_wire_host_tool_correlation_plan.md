# 190 Phase 19 plan — agent-wire host tool correlation

## Work-phase

Phase 19 implements the `10.051-B` agent-wire tool event correlation/digest slice as focused protocol-hardening tests around the existing JWC agent-wire host-tool bridge.

This is a JWC-native hardening slice, not a GJC logic port. The current implementation already emits `host_tool_call`, `host_tool_cancel`, `host_tool_update`, and `host_tool_result` frames through `RpcHostToolBridge`; this phase will lock the correlation and late-frame behavior with regression tests before considering production code changes.

## Source evidence

| Source | Evidence |
|---|---|
| `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md` | `10.051-B` remains open for agent-wire tool event correlation/digest tests. |
| `devlog/_plan/260628_jwc_native_chase_implementation/152_phase15_tool_choice_queue_build.md` | Phase 15 closed only `10.051-A`; agent-wire correlation/digest remains residual. |
| `packages/coding-agent/src/modes/shared/agent-wire/host-tool-bridge.ts` | Existing owner for host-tool call/result/update/cancel correlation. |
| `packages/coding-agent/src/modes/shared/agent-wire/event-contract.ts` | Existing agent-wire envelope contract carries `correlation_id` for request/response pairs and bounded owner observations. |
| `packages/coding-agent/test/bridge/*` | Existing bridge/agent-wire test location and style. |

## Planned files

### NEW `packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts`

Add focused tests for `RpcHostToolBridge`. Existing `packages/coding-agent/test/rpc-host-tools.test.ts` already covers basic update/result routing and abort cancel frames, so this file should emphasize net-new bridge invariants: id mismatch, late-frame rejection, and bulk teardown.

1. `emits host_tool_call frames with the caller toolCallId and resolves only the matching result id`
   - Register one host tool.
   - Execute it with `toolCallId: "tc-1"` and args `{ path: "README.md" }`.
   - Assert emitted frame has `type: "host_tool_call"`, generated `id`, original `toolCallId`, `toolName`, and arguments.
   - Send an unrelated valid `host_tool_result` id and assert it is ignored.
   - Send the matching result id and assert the promise resolves.

2. `routes host_tool_update by generated request id without settling the call`
   - Execute a host tool with an `onUpdate` callback.
   - Send a valid `host_tool_update` for the generated request id.
   - Assert callback receives the partial result and the call still resolves only after a matching `host_tool_result`.

3. `emits host_tool_cancel with targetId and ignores late result frames after abort`
   - Execute with an `AbortController`.
   - Abort after the call frame is emitted.
   - Assert the cancel frame uses `targetId` equal to the call frame id.
   - Assert the promise rejects with the host-tool abort error.
   - Assert a late matching result returns `false` from `handleResult`.

4. `rejects all pending host tool calls without accepting later frames`
   - Start two host tool calls.
   - Call `rejectAllPending("bridge closed")`.
   - Assert both promises reject.
   - Assert late result frames return `false`.

### MODIFY `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md`

Append Phase 19 partial evidence:

- Phase 19 covers the partial `10.051-B` host-tool bridge correlation subset.
- Keep `10.051` active unless audit proves all residuals are closed; at minimum digest/bounded-observation and `20.009-A` append-only overlap evidence remain open.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/191_phase19_agent_wire_host_tool_correlation_audit.md`

Record A-phase employee audit and required plan fixes.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/192_phase19_agent_wire_host_tool_correlation_build.md`

Record implementation, focused checks, and reviewer result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/193_phase19_agent_wire_host_tool_correlation_check.md`

Record final checks and commit evidence.

## Production-code policy

No production code change is planned. Modify `packages/coding-agent/src/modes/shared/agent-wire/host-tool-bridge.ts` only if a new test exposes an actual bug.

## Verification plan

Run:

```bash
bun test packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts packages/coding-agent/test/bridge/agent-wire-responses.test.ts packages/coding-agent/test/bridge/bridge-conformance.test.ts packages/coding-agent/test/bridge/bridge-client-bridge.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/test/bridge/agent-wire-host-tool-bridge.test.ts struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md devlog/_plan/260628_jwc_native_chase_implementation/190_phase19_agent_wire_host_tool_correlation_plan.md devlog/_plan/260628_jwc_native_chase_implementation/191_phase19_agent_wire_host_tool_correlation_audit.md devlog/_plan/260628_jwc_native_chase_implementation/192_phase19_agent_wire_host_tool_correlation_build.md devlog/_plan/260628_jwc_native_chase_implementation/193_phase19_agent_wire_host_tool_correlation_check.md
```

## Reviewer requirements

Backend audit in A and Backend verification in B are required because host-tool bridging is a remote/control-plane tool execution surface.

## Boundaries

- Do not alter Bridge public protocol version.
- Do not add a new digest protocol unless a concrete missing bounded-observation owner is proven in audit.
- Do not close `10.051` fully unless append-only overlap evidence is also proven.
- Do not stage unrelated `devlog/.gitignore` or `devlog/_tmp/`.
