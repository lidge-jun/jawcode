# 85 Phase 8 split — 10.048 dev CI release packaging

## Source card

`struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md`

## JWC posture

Adapt only release/CI/package hardening that matches JWC's current validation scripts, package manifests, and workflow ownership. Phase 5 already recorded the `20.015` overlap; `10.048` remains the owner for release implementation work.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| CI workflows | `.github/workflows/ci.yml`; `.github/workflows/dev-ci.yml`; `.github/workflows/build-natives.yml`; `.github/workflows/release.yml` |
| release validation scripts | `scripts/jwc-release-validation.ts`; `scripts/ci-release-publish.ts`; `scripts/ci-release-build-binaries.ts`; `scripts/ci-build-native.ts` |
| affected paths and state gates | `scripts/ci-dev-affected.ts`; `scripts/ci-jwc-state-gates.ts`; workflow YAML guard scripts |
| package manifests | `package.json`; `packages/*/package.json`; `crates/**/Cargo.toml`; generated schema/build artifacts only when explicitly owned |
| overlap evidence | `devlog/_plan/260628_jwc_native_chase_implementation/51_phase5_release_test_leak_overlap.md` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.048-A` | Affected-path CI and workflow YAML validation hardening. | `scripts/check-workflow-yaml.ts`, `scripts/ci-dev-affected.ts`, workflow checks. |
| `10.048-B` | Release publish order, changelog, package manifest, and native build guard tests. | `scripts/release-publish-order.test.ts`, release validation script tests. |
| `10.048-C` | Platform support warnings and native binary lane adjustments only after current hosted runner support is checked. | workflow diff review, supported Bun/runtime evidence, no accidental release lane deletion. |

## Reject/defer

- Letting OMP `20.015` own JWC release code.
- Copying upstream workflow matrices without translating package names and platform support.
- Changing release credentials, npm publish, or GitHub Actions secrets in a docs-first phase.

## Done-gate status

No `10.048` done-gate is closed by this split. The card remains active.
