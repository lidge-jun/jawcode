# P1.5.2 Critic synthesis round 1

> Plan: `devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md`
> Critic artifact: `.jwc/plans/planphase/2026-06-14-1443-a05a/stage-01-critic.md`
> Verdict: ITERATE

## Findings and decisions

| Finding | Decision | Plan change |
|---|---|---|
| P152-C1: resident image-store ownership underspecified. | Accept. Persistent image residents must remain durable-blob-store owned while text residents move to `EphemeralBlobStore`; in-memory sessions keep memory ownership. | Section 4.0 and 4.2 now state the exact persistent/in-memory ownership model. |
| P152-C2: prepare/materialize callsites lacked a checklist. | Accept. | Section 4.2 now includes a callsite migration table covering load, new session, capture/restore, fork, move, append/persist, readers, branch, and `forkFrom()`. |
| P152-C3: fail-closed image resolvers must be sentinel-only. | Accept. | Section 4.0 and 4.1/4.2 now preserve load-time non-throwing durable resolvers and restrict fail-closed behavior to resident sentinel materialization. |
| P152-C4: captureState/restoreState expectation updates. | Accept. | Section 4.2 and the materialization test plan now call out detached JSON-semantic snapshots. |
| P152-C5: lifecycle helper names should align with upstream template. | Accept. | Section 4.2 now names `#resetResidentTextBlobStore`, `#disposeResidentTextBlobStore`, `#reexternalizeFileEntriesForResidentStore`, and revision bumping. |
| P152-C6: model-change metadata should be sequenced after resident plumbing. | Accept. | Section 4.0 now sequences optional model metadata last; section 4.2 keeps it metadata-only and backward compatible. |
| P152-C7: close-time cleanup lacked a direct hook. | Accept. | Section 4.4 and acceptance criteria now require close-time persistent resident text temp-dir cleanup coverage. |

## Revised plan reference

The revised plan remains `devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md` and includes all accepted changes above.
