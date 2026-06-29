# 232 Phase 23 build — token accounting edge

## Build summary

Added two focused regression tests for the `calculateContextTokens` token-accounting contract.

## Changed files

| Path | Change |
|---|---|
| `packages/coding-agent/test/compaction.test.ts` | Added provider `totalTokens` trust and zero-total fallback tests. |
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | Added Phase 23 partial `10.040-C` evidence. |
| `devlog/_plan/260628_jwc_native_chase_implementation/230_phase23_token_accounting_plan.md` | Recorded plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/231_phase23_token_accounting_audit.md` | Recorded Backend audit. |
| `devlog/_plan/260628_jwc_native_chase_implementation/232_phase23_token_accounting_build.md` | Recorded build summary. |
| `devlog/_plan/260628_jwc_native_chase_implementation/233_phase23_token_accounting_check.md` | To be filled during final check. |

## Test intent

| Test | Contract pinned |
|---|---|
| `should trust non-zero provider totalTokens over local component sums` | Provider-reported non-zero totals are authoritative for context accounting. |
| `should fall back to component sums when provider totalTokens is zero` | Zero totals are treated as missing/empty and recover from component buckets. |

## Residual risk

This closes only the focused `10.040-C` token accounting edge. A separate final card-wide close audit is still required before moving `10.040` to `_fin`.
