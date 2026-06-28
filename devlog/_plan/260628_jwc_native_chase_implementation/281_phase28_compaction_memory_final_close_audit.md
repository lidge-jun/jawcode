# 281 Phase 28 audit — 10.040 final close

## First audit

Backend and Docs employees both returned FAIL.

Blocking findings:

- `002_gap_inventory.md` still linked 10.040 as an active backlog item and was missing from the plan.
- `20.014_omp_chase_goal_compaction_provider_concurrency.md` had inbound links that would break after moving 10.040 to `_fin/10`.
- The moved card needed header, Done Gate, and Decision F updates, not only a final-close appendix.
- `007_follow_index.md` needed an exact `_fin` row.
- Final-close wording needed to document deferred/monitored source sub-features outside the Phase 21/22/23 A/B/C boundary.

## Plan revision

The plan now includes:

- `002_gap_inventory.md` update.
- `20.014` cross-link update.
- Moved-card header, Done Gate, Decision F, and final close prose updates.
- Exact `007_follow_index.md` target row.
- Expanded `git diff --check` scope.

## Final audit

Second Backend/Docs re-audit returned FAIL on one remaining link-retarget issue:

- The moved card's header naming-contract link must change from `./008_gjc_jwc_naming_contract.md` to `../../008_gjc_jwc_naming_contract.md`.
- The Done Gate `[008]` link must also use `../../008_gjc_jwc_naming_contract.md`, not `../008_gjc_jwc_naming_contract.md`.

The plan now includes both retargets.

Final PASS re-audit pending.

## Final PASS re-audit

Docs employee returned PASS:

- Both moved-card `[008]` links are planned as `../../008_gjc_jwc_naming_contract.md`.
- MOC retarget to `../../10_gjc_chase_MOC.md` matches `_fin/10` convention.
- All inbound 10.040 links under `struct_har/chase/` are covered by the plan.
- `_fin/INDEX` count bump from 25 to 26 is correct.
- `_fin/10/README.md` does not require a per-card listing update.
