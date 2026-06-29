# 202 Phase 20 build — RPC unknown command id preservation

## Build summary

Phase 20 implements the `10.038-A` unknown-command id preservation subset. The patch keeps unknown commands fail-closed, but now returns the original request id so RPC clients can correlate the rejection with the command they sent.

## Files changed

| File | Change |
|---|---|
| `packages/coding-agent/test/rpc-get-state-payload.test.ts` | Added a focused in-process dispatcher regression for unknown-command response id preservation. |
| `packages/coding-agent/src/modes/shared/agent-wire/command-dispatch.ts` | Changed the default unknown-command branch from `rpcError(undefined, ...)` to `rpcError(id, ...)`. |
| `struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md` | Added Phase 20 partial `10.038-A` evidence and kept residuals open. |

## Red/green evidence

Red:

```text
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts
3 pass
1 fail
expected id: \"unknown-1\"; received id: undefined
```

Green:

```text
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts
4 pass
0 fail
```

## Broader RPC stdio note

The planned subprocess stdio regressions were attempted with:

```bash
bun test packages/coding-agent/test/rpc-get-state-payload.test.ts packages/coding-agent/test/rpc-stdio-redteam.test.ts packages/coding-agent/test/rpc-unattended-stdio.test.ts
```

Result:

- `packages/coding-agent/test/rpc-get-state-payload.test.ts` passed 4/0.
- `rpc-stdio-redteam` and `rpc-unattended-stdio` failed before exercising this patch because the child CLI exits with `Bun runtime must be >= 1.3.14 (found v1.3.11)`.

This is an environment preflight blocker, not a Phase 20 behavior failure. The direct in-process dispatcher regression covers the changed branch.

## Residual risk

This phase closes only the unknown-command id preservation subset of `10.038-A`. Fail-closed token-cost metrics, UDS/listen beyond closed baseline, and Python client parity remain open.
