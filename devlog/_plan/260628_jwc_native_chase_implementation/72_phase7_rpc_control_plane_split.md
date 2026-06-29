# 72 Phase 7 split — 10.038 RPC control plane

## Source card

`struct_har/chase/10.038_gjc_chase_rpc_control_plane_v2.md`

## JWC posture

Adapt only RPC hardening that fits the existing JWC stdio/UDS protocol, Python client package, and harness control-plane tests. Treat socket/listen behavior as security-sensitive.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| RPC mode/server | `packages/coding-agent/src/modes/rpc/rpc-mode.ts` |
| RPC client/types | `packages/coding-agent/src/modes/rpc/rpc-client.ts`; `packages/coding-agent/src/modes/rpc/rpc-types.ts` |
| Python client | `python/jwc-rpc/src/jwc_rpc/**`; `python/jwc-rpc/tests/**` |
| RPC tests | `packages/coding-agent/test/rpc*.test.ts`; `packages/coding-agent/test/rpc/**`; `packages/coding-agent/test/harness-control-plane/**` |

## `_fin` overlap

The baseline stdio/UDS/listen work is already closed in:

- `struct_har/chase/_fin/10/10.008_gjc_chase_rpc_lifecycle.md`
- `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`
- `struct_har/chase/_fin/10/10.026_gjc_chase_rpc_issues_audit.md`

Future `10.038` code must prove a gap beyond those closed cards before touching RPC source.

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.038-A` | Unknown-command id preservation and fail-closed token-cost metrics. | RPC redteam/contract tests. |
| `10.038-B` | UDS/listen work only beyond `10.018` closed baseline; likely duplicate-refusal cleanup or explicit no-op evidence. | `_fin` recheck plus `rpc-listen-socket-guard`, `rpc-uds-listen`, platform/CLI tests if code changes. |
| `10.038-C` | Python client registry/listen parity if JS/Python drift is found. | Python `jwc-rpc` tests plus JS RPC contract tests. |

## Reject/defer

- Opening wider socket bind surfaces without a dedicated auth/TLS decision.
- Replacing the JWC Python package API with upstream names.
- Treating RPC issue-series labels as evidence without command-level tests.

## Done-gate status

No `10.038` done-gate is closed by this split. The card remains active.
