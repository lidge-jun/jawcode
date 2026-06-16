# P1.5.2 A-stage audit synthesis round 0

> Plan: `devlog/_plan/260614_performance/53_p1_5_2_resident_cache_plan.md`
> Planner audit: `devlog/_plan/260614_performance/55_p1_5_2_audit_planner_r0.md`
> Architect audit: `devlog/_plan/260614_performance/56_p1_5_2_audit_architect_r0.md`
> Revision after synthesis: `a-r1`

## Shared root cause

The draft plan captured the resident-cache ownership direction but left three execution boundaries too implicit: parent-matrix compaction/resume verification, local mapping for upstream `cloneSessionContext`/revision language, and the exact B-stage ordering that prevents helper-signature/store-split partial ports from compiling half-migrated code.

## Planner findings

| ID | Decision | Plan revision |
|---|---|---|
| PLANNER-A1 | Accept. The parent matrix includes compaction hydration clamp preservation, not just resident cache ownership. | Added a `buildSessionContext()` two-compaction stale-`firstKeptEntryId` regression under `session-resident-lifecycle.test.ts` and an acceptance criterion that old pre-compaction messages are not rehydrated. |
| PLANNER-A2 | Accept. Parent plan asks for session resume smoke. | Added an explicit `SessionManager.open()` resident-heavy resume smoke under `session-resident-lifecycle.test.ts` and documented that no API-key E2E smoke is needed for this lane. |
| PLANNER-A3 | Accept. Jawcode has no local `cloneSessionContext()` function, so the requirement must map to actual local symbols. | State/context discipline now binds the upstream cache discipline to local `buildSessionContext()` and reader APIs materializing from current resident stores on demand. |
| PLANNER-A4 | Accept. Optional cache wording made revision invalidation ambiguous. | Revised plan forbids adding a build-session context cache in this slice; no revision invalidation helper is required. |
| PLANNER-A5 | Accept. The prior helper list named optional revision helpers without an exact local contract. | Removed `#bumpAllRevisions()` from required helpers and stated no cache revision fields are added. |
| PLANNER-A6 | Already satisfied. Critic findings P152-C1..C7 remained accepted. | No additional plan change. |
| PLANNER-A7 | Mostly satisfied, with parent gap fixes above. | Verification and acceptance now include compaction clamp and resume smoke. |

## Architect findings

| ID | Decision | Plan revision |
|---|---|---|
| ARCH-A1 | Accept. Resolver exports must land before sentinel materialization switches. | Section 4.0 now splits resolver addition and sentinel switch into ordered steps and says not to change `session-manager.ts` sentinel materialization until exports exist. |
| ARCH-A2 | Accept. Missing a helper/callsite migration is the main compile risk. | Section 4.0 now requires helper and callsite migration in the same patch as store split; the callsite table remains the B-stage checklist. |
| ARCH-A3 | Accept. Store split before helper migration would break every current single-store callsite. | Section 4.0 now forbids landing split ownership while any `#residentBlobStore` callsite remains. |
| ARCH-A4 | Accept. `cloneJsonSemantic` is absent and must be introduced with capture/restore changes. | State/context discipline continues to require the helper and detached snapshot tests. |
| ARCH-A5 | Accept as implementation reminder. | Test ownership remains explicit; B-stage should port concepts without duplicating long fixtures. |
| ARCH-A6 | Accept. Optional model metadata is low risk. | Sequenced last and metadata-only. |
| ARCH-A7 | Accept. Gates remain adequate after plan additions. | Verification unchanged except the tests now own compaction/resume coverage. |

## Residual risk

The only residual risk is `session-manager.ts` manual migration breadth. The revised B-stage contract mitigates it by requiring resolver exports first, then a single complete helper/callsite migration, and focused tests that cover fail-closed images, lifecycle, resume, compaction clamp, snapshots, and existing resident retention.
