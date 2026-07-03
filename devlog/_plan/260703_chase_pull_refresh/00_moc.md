# 260703 chase pull refresh — MOC

Status: active docs/evidence refresh
Owner: Boss
Created: 2026-07-03
Work class: C3 documentation/state reconciliation

## Objective

Fast-forward the GJC and OMP chase clones, inspect chase documentation rules, and add/update `struct_har/chase` documents for newly pulled upstream/reference deltas without touching unrelated root worktree changes.

## Scope

### In

- Pull `devlog/_gjc_chase/gajae-code` from `upstream dev`.
- Pull `devlog/_omp_chase/oh-my-pi` from `origin main`.
- Add new chase cards for newly observed delta clusters.
- Update `struct_har/chase` MOCs, inventory, follow index, and struct_har baselines.
- Record pull and synthesis evidence in this devlog folder.

### Out

- No root repository pull/rebase/reset/clean.
- No product-code implementation from the new chase cards.
- No edits inside chase clones except fast-forwarding their git checkout.
- No commits/staging; unrelated dirty root worktree changes are preserved.

## Evidence read

- `struct_har/chase/README.md` — chase purpose, update rules, source lanes, worksheet.
- `struct_har/chase/002_gap_inventory.md` — current reviewed-through snapshot and update checklist.
- `struct_har/chase/10_gjc_chase_MOC.md` — GJC numbering and active rows.
- `struct_har/chase/20_omp_chase_MOC.md` — OMP numbering and active rows.
- `struct_har/chase/007_follow_index.md` — execution-order index.
- `struct_har/README.md`, `struct_har/INDEX.md` — baseline HEAD records.

## Outputs

- New GJC cards: `10.070`–`10.073`.
- New OMP cards: `20.036`–`20.040`.
- Updated baseline/index docs under `struct_har/` and `struct_har/chase/`.
- Evidence docs: `10_pull_delta.md`, `20_card_synthesis.md`.
