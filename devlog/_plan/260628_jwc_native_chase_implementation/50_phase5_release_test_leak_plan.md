# 50 Phase 5 plan — release/test leak hardening

## Scope

Harden chase evidence for `20.015` and prevent overlap with `10.048` before any release/test code change.

This phase is docs-only unless the audit finds a concrete missing JWC guard that is small, non-overlapping, and testable. The initial read shows JWC already has canonical release validation surfaces, so the planned build output is an evidence-backed split and cross-check, not a direct OMP port.

## Source anchors

| Card | Anchor | Phase 5 use |
|---|---|---|
| `20.015` | OMP `cc0c67be..0fc6d136`, head `0fc6d136c` | Recheck source range and classify as track/adapt/reject/defer. |
| `10.048` | GJC `498d86bb..a791d72a` dev/CI/release cluster | Avoid duplicate implementation work and keep JWC naming/package rules. |

## Existing JWC evidence

| Surface | Evidence |
|---|---|
| Canonical release validation | `scripts/jwc-release-validation.ts` runs bundle, node build, bootstrap, package manifest, packed SDK, postinstall matrix, native probes, release publish contract, MCP/CUA defaults, workflow guard, public legacy zero, legacy inventory, and internal dep version match. |
| CI gate | `.github/workflows/ci.yml` runs `bun run validate:jwc-release`, pack dry-run, pack size guard, and pack file count guard. |
| Publish contract | `scripts/release-publish-order.test.ts` checks release dependency normalization, release bump set equals publish set, and JWC package prebuild contract. |
| Workflow runner guard | `scripts/check-no-github-workflows.ts` rejects self-hosted runners. |
| Public legacy leak guard | `scripts/check-public-legacy-zero.ts` rejects active public legacy identity strings. Current standalone run is known to fail in this worktree, so it is recorded as an existing guard surface, not green evidence for Phase 5. |
| Workflow syntax guard | `scripts/check-workflow-yaml.ts` parses workflow YAML files. |

## Planned docs/build artifacts

| File | Purpose |
|---|---|
| `devlog/_plan/260628_jwc_native_chase_implementation/50_phase5_release_test_leak_plan.md` | This plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/51_phase5_release_test_leak_overlap.md` | `20.015` vs `10.048` overlap inventory and JWC existing-guard mapping. |
| `devlog/_plan/260628_jwc_native_chase_implementation/52_phase5_release_test_leak_audit.md` | Employee audit verdicts and any fixes. |
| `devlog/_plan/260628_jwc_native_chase_implementation/53_phase5_release_test_leak_build.md` | Final docs-only build evidence. |
| `devlog/_plan/260628_jwc_native_chase_implementation/54_phase5_release_test_leak_check.md` | Fresh verification output and commit evidence. |

## Chase docs to update

| File | Planned change |
|---|---|
| `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md` | Add Phase 5 source recheck, overlap result, existing JWC guard mapping, and keep card active or mark track-only with explicit rationale. |
| `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md` | Add cross-link note that Phase 5 only documents OMP overlap and does not close GJC release packaging. |

## Initial classification

| OMP sub-behavior bucket | JWC Phase 5 decision |
|---|---|
| changelog/version/release metadata | Covered by existing release scripts; keep under `10.048` for future release process work. |
| release asset/package leak tests | Partially covered by `validate:jwc-release`, `npm pack --dry-run`, size/file count guard, manifest contract. Record evidence; no direct OMP port. |
| workflow/runner safety | Covered by GitHub-hosted runner guard and CI workflow; record evidence. |
| model/catalog/auth/provider changes | Out of scope for release leak phase; belongs to `10.036` or catalog cards. |
| terminal/TUI/bench references | Out of scope; belongs to `10.041`/`10.049` or OMP split-audit later. |
| MCP/tool arg leak hardening | Potential future security slice; do not bundle into release tests without concrete JWC owner files. |

## Verification plan

Docs/checks:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/50_phase5_release_test_leak_plan.md devlog/_plan/260628_jwc_native_chase_implementation/51_phase5_release_test_leak_overlap.md struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md
```

Focused release checks:

```sh
bun test scripts/release-publish-order.test.ts
bun run check:no-github-workflows
bun scripts/check-workflow-yaml.ts
```

Public leak smoke:

```sh
bun scripts/check-public-legacy-zero.ts
```

Expected status in this phase: may fail on existing public identity findings. If it fails, record it as known guard tension rather than using it as passing evidence.

Do not run full `validate:jwc-release` in this docs-only phase unless audit requires it; it invokes build/package/native smoke and is heavier than needed for evidence classification.
