# 61 Index link reconciliation

## Scope

The completion audit found that the source-anchor hardening is complete, but some indexes still point to active-path files that now live only under `_fin`. This phase fixes those links and harmonizes the JWC reviewed-through SHA in the GJC MOC.

## Planned edits

### MODIFY `struct_har/chase/002_gap_inventory.md`

- `10.008` link: `./10.008_gjc_chase_rpc_lifecycle.md` -> `./_fin/10/10.008_gjc_chase_rpc_lifecycle.md`
- `10.011` link: `./10.011_gjc_chase_receipt_spool.md` -> `./_fin/10/10.011_gjc_chase_receipt_spool.md`
- `20.006` link: `./20.006_omp_chase_tui_input_micro_fixes.md` -> `./_fin/20/20.006_omp_chase_tui_input_micro_fixes.md`
- Status text for those rows becomes `_fin`/landed rather than active partial wording.

### MODIFY `struct_har/chase/007_follow_index.md`

- `10.011` link: `./10.011_gjc_chase_receipt_spool.md` -> `./_fin/10/10.011_gjc_chase_receipt_spool.md`
- `10.008` link: `./10.008_gjc_chase_rpc_lifecycle.md` -> `./_fin/10/10.008_gjc_chase_rpc_lifecycle.md`
- Status text becomes `_fin`.

### MODIFY cross-reference docs

- `struct_har/chase/003_reference_from_gjc.md`: `10.008` -> `_fin/10/10.008`.
- `struct_har/chase/10.001_gjc_chase_cycle.md`: `10.008`, `10.011` -> `_fin/10/...`.
- `struct_har/chase/10.019_gjc_chase_gc_file_lock.md`: `10.011` -> `_fin/10/10.011`.
- `struct_har/chase/_fin/20/20.008_omp_chase_pull_15_13_delta.md`: `../../20.006_omp...` -> `./20.006_omp...`.
- `struct_har/chase/_fin/10/10.010_gjc_chase_harness_submit_readiness.md`: `../../10.008_gjc...` -> `./10.008_gjc...`.

### MODIFY `struct_har/chase/10_gjc_chase_MOC.md`

- Reviewed-through JWC SHA: `a5c7c5c` -> `af363c8` to match the same 2026-06-28 docs pass used by README/gap inventory/OMP MOC.

### MODIFY synthesis/meta docs

- `devlog/_plan/260628_chase_hardening_gjc_omp/02_phase_map.md`: append Phase 60 and 61.
- `devlog/_plan/260628_chase_hardening_gjc_omp/50_final_synthesis.md`: append commits `b46b62f`, `35edc96`, and Phase 61 pending/current evidence once this phase is committed.

## Non-goals

- Do not move cards between active and `_fin`.
- Do not edit implementation files.
- Do not stage `devlog/.gitignore` or `devlog/_tmp/`.

## Verification

- No active-path links remain for `_fin`-only cards from chase-root docs:

```bash
rg '\]\(\./(10\.008_gjc|10\.011_gjc|20\.006_omp)' \
  struct_har/chase/*.md
rg '\]\(\.\./\.\./(10\.008_gjc|10\.011_gjc|20\.006_omp)' \
  struct_har/chase/_fin/**/*.md
```

Valid same-directory `_fin` sibling links such as `./10.008_gjc...` inside `_fin/10/` and `./20.006_omp...` inside `_fin/20/` are allowed.

- The three `_fin` targets exist:

```bash
test -f struct_har/chase/_fin/10/10.008_gjc_chase_rpc_lifecycle.md
test -f struct_har/chase/_fin/10/10.011_gjc_chase_receipt_spool.md
test -f struct_har/chase/_fin/20/20.006_omp_chase_tui_input_micro_fixes.md
```

- `10_gjc_chase_MOC.md` uses JWC `af363c8`.
- `git diff --check` passes.
- Independent Docs verifier reports DONE.
