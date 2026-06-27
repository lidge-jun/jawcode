# 200 Phase 20 plan — RPC unknown command id preservation

## Work-phase

Phase 20 implements the `10.038-A` RPC control-plane slice for unknown-command id preservation. Current inspection found a concrete JWC gap: `dispatchRpcCommand()` captures `const id = command.id`, but the default unknown-command branch returns `rpcError(undefined, ...)`, dropping the caller's request id.

This is a JWC-native fail-closed contract fix. It preserves the error behavior while keeping the response correlated to the original command id.

## Source evidence

| Source | Evidence |
|---|---|
| `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md` | `10.038-A` allows unknown-command id preservation and fail-closed control-plane tests. |
| `devlog/_plan/260628_jwc_native_chase_implementation/72_phase7_rpc_control_plane_split.md` | Future code must prove a gap beyond closed RPC lifecycle/registry evidence. |
| `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts` | Default branch currently calls `rpcError(undefined, unknownCommand.type, ...)`. |
| `packages/coding-agent/test/rpc-get-state-payload.test.ts` | Existing in-process `dispatchRpcCommand()` harness with lightweight mock session. |

## Planned files

### MODIFY `packages/coding-agent/test/rpc-get-state-payload.test.ts`

Add one focused test in `describe("RPC get_state payload", ...)` or a new nearby describe:

```ts
it("preserves the request id when rejecting unknown commands", async () => {
  const response = await dispatchRpcCommand(
    { id: "unknown-1", type: "definitely_unknown" } as never,
    dispatchContext(),
  );

  expect(response).toEqual({
    id: "unknown-1",
    type: "response",
    command: "definitely_unknown",
    success: false,
    error: "Unknown command: definitely_unknown",
  });
});
```

### MODIFY `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts`

Change default branch only:

```diff
 default: {
   const unknownCommand = command as { type: string };
-  return rpcError(undefined, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
+  return rpcError(id, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
 }
```

### MODIFY `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md`

Append Phase 20 partial evidence:

- Phase 20 covers the `10.038-A` unknown-command id preservation subset.
- Keep `10.038` active because fail-closed token-cost metrics, UDS/listen beyond closed baseline, and Python parity remain open unless separately proven.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/201_phase20_rpc_unknown_command_id_audit.md`

Record A-phase plan audit.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/202_phase20_rpc_unknown_command_id_build.md`

Record implementation and B verifier evidence.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/203_phase20_rpc_unknown_command_id_check.md`

Record final checks and commit evidence.

## Verification plan

Run:

```bash
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/test/rpc-stdio-redteam.test.ts packages/coding-agent/test/rpc-unattended-stdio.test.ts
cd packages/coding-agent && bun run check:types
bunx biome check packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts
git diff --check -- packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md devlog/_plan/260628_jwc_native_chase_implementation/200_phase20_rpc_unknown_command_id_plan.md devlog/_plan/260628_jwc_native_chase_implementation/201_phase20_rpc_unknown_command_id_audit.md devlog/_plan/260628_jwc_native_chase_implementation/202_phase20_rpc_unknown_command_id_build.md devlog/_plan/260628_jwc_native_chase_implementation/203_phase20_rpc_unknown_command_id_check.md
```

## Boundaries

- Do not change known-command behavior.
- Do not change parse-error behavior in `rpc-mode.ts`; parse failures still have no command id when no command was parsed.
- Do not touch UDS/listen code or Python client code in this phase.
- Do not claim full `10.038` closure.
- Do not stage unrelated `devlog/.gitignore` or `devlog/_tmp/`.
