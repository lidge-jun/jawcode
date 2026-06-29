# 20 Phase 2 — GJC `_fin` index and baseline review

## Scope

Repair GJC completed-card index consistency and source baseline pointers.

## Findings before edit

- Actual GJC `_fin/10` card files: 25 (`find struct_har/chase/_fin/10 -name '10.*.md'`).
- `struct_har/chase/_fin/INDEX.md` lists only 14 GJC rows.
- `struct_har/chase/README.md` still says GJC source clone is at `f0a8a3eb`; current source head is `a791d72a`.
- `10_gjc_chase_MOC.md` already reviews through `a791d72a`.

## Planned edits

- MODIFY `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/_fin/INDEX.md`:
  - Replace the completed table with a generated full inventory covering all 25 GJC `_fin/10` files and 6 OMP `_fin/20` files currently present.
  - Preserve the long Jawdev guardrail section after the table.
- MODIFY `/Users/jun/Developer/new/700_projects/jawcode/struct_har/chase/README.md`:
  - Update GJC reviewed source from `f0a8a3eb` to `a791d72a`.
  - Keep JWC/OMP rows unchanged unless a later OMP phase updates them.

## Non-goals

- Do not edit individual `_fin/10/*.md` card bodies in this phase.
- Do not reopen completed cards unless a later audit finds behavioral evidence.
- Do not touch unrelated dirty `structure/*` or `devlog/_tmp` files.

## Verification

- `_fin/INDEX.md` contains links for every file returned by:
  - `find struct_har/chase/_fin/10 -maxdepth 1 -type f -name '10.*.md'`
  - `find struct_har/chase/_fin/20 -maxdepth 1 -type f -name '20.*.md'`
- `rg 'f0a8a3eb' struct_har/chase/README.md struct_har/chase/_fin/INDEX.md` returns no match.
- `git diff --check -- struct_har/chase/_fin/INDEX.md struct_har/chase/README.md devlog/_plan/260628_chase_hardening_gjc_omp/20_phase2_gjc_fin_review.md` passes.
