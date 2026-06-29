# 221 Phase 22 audit — resident lifecycle evidence

## Backend audit

Verdict: PASS.

Backend performed a read-only audit of the Phase 22 plan against the real JWC resident lifecycle tests and chase card.

## Verified paths

| Path | Status |
|---|---|
| `packages/coding-agent/test/session-manager/resident-retention.test.ts` | exists |
| `packages/coding-agent/test/session-resident-cache.test.ts` | exists |
| `packages/coding-agent/test/session-resident-lifecycle.test.ts` | exists |
| `packages/coding-agent/test/resident-materialization.test.ts` | exists |
| `packages/coding-agent/test/session-resident-ownership.test.ts` | exists |
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | exists |
| `devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md` | exists |
| `221` / `222` / `223` Phase 22 artifacts | valid new devlog paths |

## Coverage audit

| Resident lifecycle behavior | Audit evidence |
|---|---|
| Bounded resident state | `resident-retention.test.ts`; `session-resident-cache.test.ts` |
| Reader/context materialization | `resident-retention.test.ts`; `session-resident-cache.test.ts` |
| Reload / fork / branch | `resident-retention.test.ts`; `session-resident-lifecycle.test.ts` |
| Close disposal | `session-resident-lifecycle.test.ts` text temp-dir disposal, matching runtime prefix `jwc-resident-text-` |
| Session-file switching | `session-resident-lifecycle.test.ts` `setSessionFile` case |
| `moveTo` | `session-resident-lifecycle.test.ts` moved cwd case |
| Sentinel-free reader/context output | `resident-materialization.test.ts` |
| Missing resident fail-closed | `session-resident-ownership.test.ts` image sentinels and post-reset text restore |
| Stale-store restore rejection | `session-resident-ownership.test.ts` detached snapshots and fail-closed restore after `newSession` |

## Auditor notes

- No blocking regression is required before recording `10.040-B` partial evidence.
- The no-runtime-code posture is safe because this slice records existing JWC-native behavior only.
- The chase update must keep the overall `10.040` card active and leave `10.040-C` token accounting open.
- Optional residual: persisted JSONL open has explicit image sentinel fail-closed fixtures; text sentinel fail-closed is covered through restore-after-store-reset rather than a symmetric persisted-open fixture. This is not blocking for `10.040-B`.

## Audit command evidence

Backend also executed the focused resident suite during audit:

```text
28 pass
0 fail
```
