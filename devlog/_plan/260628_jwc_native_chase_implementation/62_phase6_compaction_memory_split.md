# 62 Phase 6 split — 10.040 compaction/pruning/resident memory

## Source card

`struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

## JWC posture

Adapt small compaction/memory guards against current JWC behavior. JWC already documents compaction, pruning, resident retention, overflow recovery, and retry separation, so this card should not become a broad rewrite.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| compaction model | `docs/compaction.md`; `@jawcode-dev/agent-core/compaction` |
| session compaction integration | `packages/coding-agent/src/session/agent-session.ts` |
| session resident retention | `packages/coding-agent/test/session-manager/resident-retention.test.ts`; resident cache tests |
| retry/compaction separation | `docs/non-compaction-retry-policy.md` |
| session context reconstruction | `docs/session.md`; `packages/coding-agent/src/session/session-manager.ts` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.040-A` | Regression tests for pruning cap and protected newest/read/skill behavior. | focused `agent-core`/agent-session compaction tests. |
| `10.040-B` | Resident cache lifecycle test/docs hardening. | resident-retention/cache tests. |
| `10.040-C` | Token accounting docs/test if a concrete mismatch appears. | measured fixture with expected bounds. |

## Reject/defer

- Rewriting compaction strategy based on upstream commit count alone.
- Changing auto-continue/handoff semantics without a dedicated compaction PABCD.
- Treating `check-public-legacy-zero` or release guards as compaction evidence.

## Done-gate status

No `10.040` done-gate is closed by this split. The card remains active.

