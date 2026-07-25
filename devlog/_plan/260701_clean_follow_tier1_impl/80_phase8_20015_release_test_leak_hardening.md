# 80 Phase 8 — 20.015 release/test leak hardening reference closure

## Scope

Close `20.015` as an OMP reference-only / track-only chase card.

This phase must not port OMP release/test changes directly. Prior evidence already says
`10.048` is the JWC implementation owner for dev/CI/release packaging, and `10.048` is now
closed with the affected-path Bun cwd false-green guard. `20.015` should therefore close as
overlap evidence: OMP source facts preserved, JWC release guard mapping recorded, no new
runtime or packaging behavior adopted in this card.

## Existing facts read before planning

| Evidence | Result |
|---|---|
| `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md` | Active card already classifies as `reference-only`, `Decision A = track-only`, and records Phase 5 source/guard mapping. |
| `struct_har/chase/_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md` | Closed 260701; adopted only the JWC affected-path false-green guard and explicitly keeps `20.015` as overlap evidence. |
| `devlog/_plan/260628_jwc_native_chase_implementation/50_phase5_release_test_leak_plan.md` | Planned docs-only Phase 5 unless a concrete missing JWC guard appeared. |
| `devlog/_plan/260628_jwc_native_chase_implementation/51_phase5_release_test_leak_overlap.md` | States `20.015` must not close independently as a release implementation owner. |
| `devlog/_plan/260628_jwc_native_chase_implementation/54_phase5_release_test_leak_check.md` | Existing focused checks passed except `check-public-legacy-zero`, which was explicitly recorded as known guard tension, not green evidence. |

## Decision

| Bucket | Decision | Rationale |
|---|---|---|
| Release asset/package leak tests | ADAPT evidence only | JWC release validation/pack guards already exist; no new product behavior is needed in this card. |
| Workflow/runner safety | ADAPT evidence only | Existing hosted-runner and workflow YAML guards cover the relevant release/test surface. |
| Release metadata/changelog/version handling | DEFER to `10.048` lineage | Implementation owner is already closed for this goal; future release behavior reopens `10.048` or a new release card. |
| Test fixture leak hardening | DEFER until concrete owner appears | OMP range spans many areas; no single JWC file owner is proven for this card. |
| Provider/catalog/auth/runtime leaks | OUT OF SCOPE | Covered by provider/security/session cards, not release/test closure. |
| Terminal/TUI/bench references | OUT OF SCOPE | Belongs to TUI/bench cards, not release/test closure. |

## Diff-level plan

### NEW

No new product code.

This plan file is the only new devlog artifact for the current goal:

- `devlog/_plan/260701_clean_follow_tier1_impl/80_phase8_20015_release_test_leak_hardening.md`

### MOVE

Move the active card into the OMP `_fin` directory:

- from `struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md`
- to `struct_har/chase/_fin/20/20.015_omp_chase_release_test_leak_hardening.md`

### MODIFY

`struct_har/chase/_fin/20/20.015_omp_chase_release_test_leak_hardening.md`

- Header: change status from `⬜ · reference-only` to `✅ _fin 260701 · reference-only / track-only closure`.
- Done Gate: mark all checkboxes complete, with explicit no-code/reference rationale for adopted/deferred buckets.
- Verification: replace future-tense bullets with concrete expected evidence:
  - `bun test scripts/release-publish-order.test.ts`
  - `bun run check:no-github-workflows`
  - `bun scripts/check-workflow-yaml.ts`
  - `git diff --check`
  - `bun run check:ts`
- Add a `Closure (260701)` section:
  - cite `10.048` closed owner card,
  - state no standalone JWC implementation remains for `20.015`,
  - record focused verification commands,
  - note `check-public-legacy-zero` remains non-gating historical guard tension if re-run.
- Rebase the moved card's own `10.048` relative links from `./_fin/10/...` to `../10/10.048_gjc_chase_dev_ci_release_packaging.md`.
- Rebase the moved card's MOC link from `./20_omp_chase_MOC.md` to `../../20_omp_chase_MOC.md`.

`struct_har/chase/20_omp_chase_MOC.md`

- Row `015`: update link to `./_fin/20/20.015_omp_chase_release_test_leak_hardening.md`.
- Status: change `⬜` to `✅ _fin`.
- Scope text remains `release/test leak hardening`; no product-feature claim added.

`struct_har/chase/_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md`

- Update the `20.015` cross-link from the old active card path to `../20/20.015_omp_chase_release_test_leak_hardening.md`.
- Keep the existing conclusion unchanged: `10.048` remains the release/CI implementation owner, while `20.015` is overlap/reference evidence.

`struct_har/chase/002_gap_inventory.md`

- OMP 16.1.13 -> 16.1.20 row for release/test leak hardening:
  - link to `_fin/20/20.015...`,
  - direction becomes `✅ _fin 260701 (track-only reference closure)`.

`struct_har/chase/007_follow_index.md`

- O7 row:
  - link to `_fin/20/20.015...`,
  - status becomes `✅ _fin`.

`struct_har/chase/009_follow_tiers.md`

- Additional 1-tier goal note changes from `20.015 remaining` to `all 8 closed`.
- `20.015` row points to `_fin/20/...` and status becomes `✅ _fin 260701 (track-only reference closure; release implementation owned by 10.048)`.

`struct_har/chase/20.001_omp_chase_cycle.md`

- Changelog table gains a 2026-07-01 row for `20.015`:
  - range `cc0c67be..0fc6d136`,
  - judgement `release/test leak hardening track-only closure`,
  - link to `_fin/20/20.015...`,
  - note no product code change because `10.048` owns JWC release implementation.

`struct_har/chase/_fin/INDEX.md`

- OMP `_fin/20` count becomes 20.
- Add `20.015` row under OMP `_fin/20`.

`devlog/_plan/260701_clean_follow_tier1_impl/00_INDEX_slice_map.md`

- Phase 8 row/section records the concrete plan file and closure result once B completes.

## Verification plan

Focused release/test evidence:

```sh
bun test scripts/release-publish-order.test.ts
bun run check:no-github-workflows
bun scripts/check-workflow-yaml.ts
```

Structural/doc evidence:

```sh
rg -n "20\\.015|10\\.048|20_omp_chase_MOC" struct_har/chase/20_omp_chase_MOC.md struct_har/chase/002_gap_inventory.md struct_har/chase/007_follow_index.md struct_har/chase/009_follow_tiers.md struct_har/chase/20.001_omp_chase_cycle.md struct_har/chase/_fin/INDEX.md struct_har/chase/_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md struct_har/chase/_fin/20/20.015_omp_chase_release_test_leak_hardening.md
test ! -e struct_har/chase/20.015_omp_chase_release_test_leak_hardening.md
git diff --check
bun run check:ts
```

Non-gating diagnostic:

```sh
bun scripts/check-public-legacy-zero.ts
```

This diagnostic is not required as a passing gate because Phase 5 already recorded known
pre-existing findings. If it now passes, record it as extra evidence; if it fails in the
same known way, record it as historical guard tension and keep the green gate on the
focused release checks plus `bun run check:ts`.

## Acceptance criteria

- `20.015` no longer appears as an active chase card.
- Every maintained 20.015 link in MOC, gap inventory, follow index, follow tiers, cycle
  changelog, and `_fin` index points to `_fin/20`.
- The card explains why no new JWC release/test implementation is needed in this goal.
- Focused release guard checks, `git diff --check`, and `bun run check:ts` pass.
- Atomic commit closes this card without staging unrelated untracked directories.
