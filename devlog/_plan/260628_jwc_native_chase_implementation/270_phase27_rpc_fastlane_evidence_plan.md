# 270 Phase 27 plan — 10.038-D RPC fast-lane evidence

## Work-phase target

Close a JWC-native evidence gap for a newly named `10.038-D` fast-lane scheduler subset. The RPC control plane already exposes the safe fast-lane scheduler and read-only allowlist, but JWC does not have a focused regression test pinning the causal-order contract. Audit also found one implementation drift from the scheduler comments: `get_messages` should return a defensive snapshot because it is fast-laned as a read-only command.

## Source anchors

- Chase card: `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md`
- Prior split: `devlog/_plan/260628_jwc_native_chase_implementation/72_phase7_rpc_control_plane_split.md`
- Prior partial evidence: `devlog/_plan/260628_jwc_native_chase_implementation/200-203_phase20_rpc_unknown_command_id_*`
- Upstream reference: GJC `251ea268 fix(rpc,file-lock): safe fast-lane allowlist + GC owner-token TOCTOU guard`

## Current JWC findings

- `packages/coding-agent/src/modes/rpc/rpc-mode.ts` already has:
  - `RPC_CANCELLATION_COMMANDS`
  - `RPC_SAFE_READ_CONTROL_COMMANDS`
  - `isFastLaneRpcCommand()`
  - `createRpcCommandScheduler()`
- `packages/coding-agent/test/rpc-listen-socket-guard.test.ts` already covers live socket refusal.
- JWC lacks a focused `rpc-fastlane` regression file proving:
  - only cancellation + pure read commands are fast-laned,
  - mutating setters stay ordered,
  - scheduler lets read/cancel commands bypass a blocked ordered command,
  - ordered commands preserve arrival order.
- `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts` currently returns `session.messages` directly for `get_messages`; this conflicts with the fast-lane read-only snapshot contract documented in `rpc-mode.ts`.

## Planned file changes

### MODIFY `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts`

Before:

```ts
case "get_messages": {
	return rpcSuccess(id, "get_messages", { messages: session.messages });
}
```

After:

```ts
case "get_messages": {
	return rpcSuccess(id, "get_messages", { messages: [...session.messages] });
}
```

### NEW `packages/coding-agent/test/rpc-fastlane.test.ts`

Add JWC-native tests using the exported scheduler/classifier from `@jawcode-dev/coding-agent/modes/rpc/rpc-mode`:

1. `isFastLaneRpcCommand()` returns true for cancellation commands and safe read/control commands.
2. Mutating mode/config setters and async commands return false.
3. `createRpcCommandScheduler()` runs a fast-lane read while an ordered command is still pending.
4. Ordered commands submitted after a blocked ordered command wait until the earlier command resolves.
5. `dispatchRpcCommand({ type: "get_messages" })` returns a defensive snapshot, so post-read mutation of `session.messages` does not mutate the response payload.

The test will be adapted to JWC package names and current command type names only. Production code is limited to the one-line snapshot fix above.

### MODIFY `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md`

Add `JWC Phase 27 Partial Evidence — 2026-06-28`:

- State that the fast-lane implementation already existed in JWC.
- Define `10.038-D` as the fast-lane scheduler subset so `10.038-B` remains reserved for UDS/listen.
- Record the new regression test file and focused verification.
- Mark `10.038-D` fast-lane/scheduler evidence closed while keeping `10.038-B` UDS/listen and Python parity residuals open as documented.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/271_phase27_rpc_fastlane_evidence_audit.md`

Record plan-audit result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/272_phase27_rpc_fastlane_evidence_build.md`

Record test-only implementation result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/273_phase27_rpc_fastlane_evidence_check.md`

Record final checks.

## Verification plan

Focused tests:

```bash
bun test packages/coding-agent/test/rpc-fastlane.test.ts packages/coding-agent/test/rpc-listen-socket-guard.test.ts packages/coding-agent/test/rpc-get-state-payload.test.ts
```

Package typecheck:

```bash
cd packages/coding-agent && bun run check:types
```

Scoped whitespace:

```bash
git diff --check -- packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts packages/coding-agent/test/rpc-fastlane.test.ts struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md devlog/_plan/260628_jwc_native_chase_implementation/270_phase27_rpc_fastlane_evidence_plan.md devlog/_plan/260628_jwc_native_chase_implementation/271_phase27_rpc_fastlane_evidence_audit.md devlog/_plan/260628_jwc_native_chase_implementation/272_phase27_rpc_fastlane_evidence_build.md devlog/_plan/260628_jwc_native_chase_implementation/273_phase27_rpc_fastlane_evidence_check.md
```

## Commit plan

One atomic commit:

```text
fix(rpc): snapshot fast-lane message reads
```
