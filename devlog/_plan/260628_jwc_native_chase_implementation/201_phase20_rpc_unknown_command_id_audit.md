# 201 Phase 20 audit — RPC unknown command id preservation

## Backend audit 1

Verdict: PASS.

Confirmed:

- `dispatchRpcCommand()` captures `const id = command.id`, but the default unknown-command branch currently calls `rpcError(undefined, ...)`, dropping the request id.
- A focused test can reuse the existing `dispatchContext()` harness in `packages/coding-agent/test/rpc-get-state-payload.test.ts`.
- The planned source change is a one-line default-branch fix and does not affect known commands, parse errors, UDS/listen setup, or Python client code.
- Verification commands are scoped to the direct in-process dispatcher test plus stdio/unattended RPC regressions, package typecheck, biome, and diff check.
- Chase wording must remain partial `10.038-A`; token-cost metrics, UDS/listen beyond closed baseline, and Python parity remain open.

Non-blocking note:

- The unknown-command test should use a nearby describe instead of implying it belongs to `get_state` behavior.
