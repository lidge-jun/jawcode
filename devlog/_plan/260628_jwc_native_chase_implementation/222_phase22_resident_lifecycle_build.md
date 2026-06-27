# 222 Phase 22 build — resident lifecycle evidence

## Build summary

Phase 22 is a no-runtime-code evidence-hardening slice for `10.040-B`. Existing JWC resident lifecycle tests already cover the resident cache lifecycle behavior requested by the chase split, so no production code or test code changed.

## Changed files

| Path | Change |
|---|---|
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | Added Phase 22 partial evidence for `10.040-B`; kept `10.040-C` active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md` | Recorded plan and verification scope. |
| `devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md` | Recorded Backend audit verdict and coverage mapping. |
| `devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md` | Recorded this build/evidence summary. |
| `devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md` | Recorded final resident test, typecheck, scoped diff-check, and verifier evidence. |

## Evidence matrix

| `10.040-B` resident lifecycle behavior | JWC evidence |
|---|---|
| Bounded resident state with full reader materialization | `packages/coding-agent/test/session-manager/resident-retention.test.ts`; `packages/coding-agent/test/session-resident-cache.test.ts` |
| Reload, fork, branch, and historical blob refs | `packages/coding-agent/test/session-manager/resident-retention.test.ts`; `packages/coding-agent/test/session-resident-lifecycle.test.ts` |
| Temp resident cleanup on close | `packages/coding-agent/test/session-resident-lifecycle.test.ts` |
| Compaction hydration clamp survives resident lifecycle changes | `packages/coding-agent/test/session-resident-lifecycle.test.ts` |
| Session-file switching resets and repopulates resident stores | `packages/coding-agent/test/session-resident-lifecycle.test.ts` |
| Moving session cwd preserves materialization and bounded state | `packages/coding-agent/test/session-resident-lifecycle.test.ts` |
| Reader/context outputs hide resident sentinels | `packages/coding-agent/test/resident-materialization.test.ts` |
| Snapshot copies do not alias mutable resident state | `packages/coding-agent/test/resident-materialization.test.ts`; `packages/coding-agent/test/session-resident-ownership.test.ts` |
| Missing resident sentinel fails closed with owner/session context | `packages/coding-agent/test/session-resident-ownership.test.ts` |

## No-code rationale

This phase records coverage that already exists in JWC. Adding a new test would duplicate the current resident suite unless future work chooses to add the optional persisted text-sentinel fixture noted by the Backend auditor.

## Residual risk

This closes only the evidenced `10.040-B` resident cache lifecycle subset. `10.040-C` token accounting remains active.
