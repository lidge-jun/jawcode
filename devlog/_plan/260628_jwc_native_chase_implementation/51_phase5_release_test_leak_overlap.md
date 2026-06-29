# 51 Phase 5 overlap — 20.015 vs 10.048

## Source recheck

OMP source range:

```sh
git -C devlog/_omp_chase/oh-my-pi rev-parse --short HEAD
# 0fc6d136c

git -C devlog/_omp_chase/oh-my-pi log --oneline --reverse cc0c67be..0fc6d136
# source range is available locally and matches 20.015 anchors
```

Observed dirstat from `cc0c67be..0fc6d136` includes `.github/`, docs, package tests, coding-agent tests, provider/catalog/eval/runtime areas, and benchmark references. It is not a single release script patch.

## Overlap rule

`20.015` is OMP reference evidence. `10.048` owns JWC dev/CI/release packaging implementation decisions. If a future patch changes release scripts, package publishing, CI workflows, or native packaging, it must update `10.048` evidence too and must not close `20.015` alone.

## Existing JWC guard mapping

| JWC guard | File | Covers |
|---|---|---|
| Canonical release validation | `scripts/jwc-release-validation.ts` | Release bundle, package manifest, packed SDK, postinstall matrix, native probes, publish contract, workflow guard, public legacy scan, internal dep version match. |
| CI release validation | `.github/workflows/ci.yml` | `validate:jwc-release`, smoke, pack dry-run, pack size, pack file count. |
| Publish order contract | `scripts/release-publish-order.test.ts` | Publish set equals release bump set; JWC prebuild contract; dependency normalization. |
| Hosted runner guard | `scripts/check-no-github-workflows.ts` | Rejects self-hosted workflow runners. |
| Public identity leak guard | `scripts/check-public-legacy-zero.ts` | Rejects active public legacy names in selected public files and package metadata. Existing guard surface only; standalone run currently reports pre-existing findings and is not green Phase 5 evidence. |
| Workflow syntax guard | `scripts/check-workflow-yaml.ts` | Parses workflow YAML files. |

## Classification

| `20.015` bucket | Decision | Rationale |
|---|---|---|
| release asset/package leak tests | adapt evidence only | JWC already has pack dry-run, size/count guard, packed SDK smoke, and publish contract. |
| workflow/runner safety | adapt evidence only | JWC already has hosted-runner guard and CI workflow validation. |
| changelog/version release metadata | defer to `10.048` | GJC release packaging card is the implementation owner. |
| test fixture leak hardening | split if concrete owner appears | `20.015` range spans many package tests; no single JWC owner identified in this phase. |
| provider/catalog/auth/runtime changes | defer to domain cards | Not release/test leak specific. |
| terminal/TUI/bench references | defer to `10.041`/`10.049`/OMP Phase 10 | Not release packaging. |

## Result

Phase 5 should update chase evidence and keep both cards active:

- `20.015` remains a reference/split-audit card with source anchors proven and JWC guard mapping recorded.
- `10.048` remains the implementation owner for any future release packaging code.
