# 152 Phase 15 build — tool-choice queue integrity

## Build summary

Phase 15 implements `10.051-A` as a focused test-hardening slice. No production code change was required because the new edge regressions passed against the existing queue implementation.

## Files changed

| File | Change |
|---|---|
| `packages/coding-agent/test/tool-choice-queue.test.ts` | Added edge tests for requeue ordering, original-sequence tail behavior, `removeByLabel` + requeue semantics, and requeued last-served labels. |
| `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md` | Added Phase 15 partial `10.051-A` evidence and kept card active. |

## Behavior proven

1. A lost forced-tool yield requeued after abort is replayed before later queued directives.
2. The requeued yield does not duplicate the original sequence tail.
3. `removeByLabel()` on a matching in-flight directive can preserve the generated `-requeued` single-yield replay while removing the original directive tail.
4. `consumeLastServedLabel()` reports the generated requeue label after a replayed yield resolves.

## Residual risk

This phase closes only the tested `10.051-A` queue-regression subset. `10.051-B` agent-wire tool event correlation/digest and `20.009-A` append-only overlap evidence remain open.
