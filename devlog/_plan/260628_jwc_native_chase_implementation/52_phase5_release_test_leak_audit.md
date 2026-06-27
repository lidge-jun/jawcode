# 52 Phase 5 audit — release/test leak hardening

## Audit scope

Read-only audits checked:

- `50_phase5_release_test_leak_plan.md`
- `51_phase5_release_test_leak_overlap.md`
- `02_phase_map.md`
- `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md`
- `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md`
- JWC guard files named in Phase 5 evidence.

## Verdicts

| Reviewer | Verdict | Notes |
|---|---|---|
| Backend | PASS | Verified guard paths exist, claims match real code, OMP source anchors are valid, `20.015` remains reference/split-audit, and `10.048` remains implementation owner. |
| Docs initial | NEEDS_FIX | Phase map still said "close" and implied implementation checks; `20.015` had a path-anchor leading space and an unlinked `10.048` reference. |
| Docs re-audit | PASS | Confirmed phase map, links, path anchor, and public-legacy guard status are aligned. |

## Fixes applied

1. Reworded `02_phase_map.md` Phase 5 goal/gate to docs audit + overlap evidence + optional existing guard script smoke.
2. Fixed `20.015` path anchor formatting and linked `10.048` in the reconcile table.
3. Documented `scripts/check-public-legacy-zero.ts` as an existing guard surface with current pre-existing findings, not green Phase 5 evidence.

## Guard status

| Guard | Phase 5 status |
|---|---|
| `scripts/release-publish-order.test.ts` | Green focused evidence. |
| `scripts/check-no-github-workflows.ts` | Green focused evidence. |
| `scripts/check-workflow-yaml.ts` | Green focused evidence. |
| `scripts/check-public-legacy-zero.ts` | Existing guard surface; current standalone run fails on pre-existing findings and is not counted as green evidence. |

