# 40 Phase 4 — OMP active/_fin consistency review

## Scope

Review index consistency after Phase 3 OMP split.

## Findings before edit

- `20_omp_chase_MOC.md` is current for OMP `0fc6d136` and lists 20.009-20.015.
- `007_follow_index.md` links 20.009-20.015.
- `002_gap_inventory.md` links 20.009-20.015 but top snapshot still cites stale GJC `f0a8a3eb`; current GJC baseline is `a791d72a`.
- `_fin/20/20.008` still says next OMP pull may split `20.009+`; that is historical text in a completed index card and should not be rewritten unless this phase explicitly edits `_fin` bodies. Leave as historical.

## Planned edits

- MODIFY `struct_har/chase/002_gap_inventory.md`:
  - Update top snapshot/reviewed-through GJC head from `f0a8a3eb` to `a791d72a`.
  - Leave OMP `0fc6d136` and JWC `af363c8` rows as currently stated.
- NEW this plan file only.

## Non-goals

- Do not edit `_fin/20/*.md` historical body text.
- Do not change active OMP card contents created in Phase 3 unless verifier finds broken links.

## Verification

- `rg 'f0a8a3eb' struct_har/chase/002_gap_inventory.md` returns no match.
- `rg '20\.009|20\.010|20\.011|20\.012|20\.013|20\.014|20\.015' struct_har/chase/20_omp_chase_MOC.md struct_har/chase/007_follow_index.md struct_har/chase/002_gap_inventory.md` confirms the new cards remain linked.
- `git diff --check -- struct_har/chase/002_gap_inventory.md devlog/_plan/260628_chase_hardening_gjc_omp/40_phase4_omp_consistency_review.md` passes.
