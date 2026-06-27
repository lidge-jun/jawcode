# 81 Phase 8 split — 10.039 harness receipts and phase rollup

## Source card

`struct_har/chase/10.039_gjc_chase_harness_receipts_phase_rollup.md`

## JWC posture

Split only harness receipt, spool, phase-rollup, submit-readiness, and owner-classification gaps that fit JWC's existing `harness-control-plane` module. Do not reopen closed harness RPC lifecycle or unattended workflow decisions unless a new failing test identifies a gap.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| receipt model and ingest | `packages/coding-agent/src/harness-control-plane/receipts.ts`; `packages/coding-agent/src/harness-control-plane/receipt-ingest.ts`; receipt tests |
| receipt spool and rollup | `packages/coding-agent/src/harness-control-plane/receipt-spool.ts`; `packages/coding-agent/src/harness-control-plane/phase-rollup.ts`; phase-rollup tests |
| owner and lifecycle classification | `packages/coding-agent/src/harness-control-plane/owner.ts`; `packages/coding-agent/src/harness-control-plane/state-machine.ts`; owner tests |
| control endpoint and RPC adapter | `packages/coding-agent/src/harness-control-plane/control-endpoint.ts`; `packages/coding-agent/src/harness-control-plane/rpc-adapter.ts`; RPC harness tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.039-A` | JSONL spool export, receipt ingestion, and phase-rollup compatibility tests. | `receipt-spool.test.ts`, `phase-rollup.test.ts`, `receipt-ingest.test.ts`. |
| `10.039-B` | Submit readiness and live/manual owner classification gaps. | `owner.test.ts`, `owner-verbs.test.ts`, `cli-owner-routing.test.ts`, negative owner-death tests. |
| `10.039-C` | Finalize verdict derivation from assistant text only if current JWC behavior is weaker. | `finalize.test.ts`, `owner-review-finalize.test.ts`. |

## Reject/defer

- Porting upstream harness code by file copy.
- Reopening submit-readiness work already closed by `struct_har/chase/_fin/10/10.010_gjc_chase_harness_submit_readiness.md` unless a new failing test identifies a gap.
- Changing harness RPC protocol before checking `_fin` RPC cards.
- Treating docs-only split evidence as card closure.

## Done-gate status

No `10.039` done-gate is closed by this split. The card remains active.
