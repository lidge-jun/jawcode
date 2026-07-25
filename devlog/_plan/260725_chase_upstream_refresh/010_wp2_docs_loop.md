# 010 — wp2 docs loop: chase card authoring via sol subagents

## Scope

IN: `struct_har/chase/10.108+_*` (new GJC cards), `struct_har/chase/20.081+_*` (new OMP cards), `struct_har/chase/10_gjc_chase_MOC.md`, `struct_har/chase/20_omp_chase_MOC.md`, `struct_har/chase/007_follow_index.md`, this devlog unit.
OUT: any package source code, `_fin/` moves of old cards, 002_gap_inventory rewrite (append-only notes allowed).

## Dispatch packets (disjoint write sets)

| packet | agent | band | write set |
|---|---|---|---|
| G1 | sol worker A | GJC full delta `3ddf26079..baa4dc76` (529) | new cards `10.108`–`10.11x`, file `devlog` evidence note `020_gjc_card_coverage.md` |
| O1 | sol worker B | OMP `b0d04e517..v17.0.8` (678) | new cards `20.081`–`20.08x`, `021_omp_b1_coverage.md` |
| O2 | sol worker C | OMP `v17.0.8..v17.1.0` (539) | new cards continuing after O1's last number (coordinate via coverage note: O2 starts at `20.091`), `022_omp_b2_coverage.md` |
| O3 | sol worker D | OMP `v17.1.0..head` (84) | new cards from `20.101` (fixed start to avoid collision), `023_omp_b3_coverage.md` |

Numbering is pre-allocated per packet (G1: 10.108+, O1: 20.081–20.090, O2: 20.091–20.100, O3: 20.101+) so agents never collide. Unused numbers inside a packet's allocation are fine; the MOC sync (main agent) records actuals.

## Card requirements (per card)

1. Follow the structure of `struct_har/chase/10.104_gjc_chase_docs_changelog_qa.md` / `20.080_omp_chase_ci_style_changelog.md`: header line (MOC link, tier, ⬜, priority), `> Reviewed source:` range line, Chase Scope, Evidence Commands Run, Upstream Commit Anchors table (commit + source fact + upstream file anchors), Worktree Verification table (probe vs JWC result), Decision Log.
2. Classify each card: `import` / `adapt` / `reject` / `split` / `evidence-fill` / `track-only`, plus autonomy bucket: **A** (autonomous, no user decision), **B** (track/defer/reference), **C** (user decision required — write Decision Log slots but mark `⬜ C`).
3. Every delta commit is either cited in a card's anchor table or listed in the packet's coverage note with a no-card reason (chore/docs/bot/merge-adjacent). Hash-set proof per `001_delta_evidence.md` method.
4. Naming contract per `008_gjc_jwc_naming_contract.md` (jwc / .jwc vocabulary in JWC-facing prose).
5. Cards record exact `path:line` evidence for claimed gaps; no gap inferred from commit message alone.

## Main-agent tasks after workers return

1. Verify each coverage note's hash-set math independently (re-run rev-list, set-diff vs card anchors).
2. Update `10_gjc_chase_MOC.md` (Reviewed through → `baa4dc76`; Recent GJC dev deltas row for the new band range; active card table rows).
3. Update `20_omp_chase_MOC.md` (Reviewed through → `59619623`; new delta row; active rows).
4. Update `007_follow_index.md` header (refresh date + new heads) and append new card rows.
5. Commit docs (one commit per upstream: `docs(chase): ...`).

## Accept criteria

- C-1: set-diff(empty) for each band: delta hashes minus card-cited hashes minus explicitly-listed no-card hashes = ∅.
- C-2: every new card carries classification + autonomy bucket + reviewed-source range.
- C-3: MOCs and 007_follow_index reflect new heads and card inventory.
- C-4: docs-only — `git diff --name-only` for the cycle touches only struct_har/chase + devlog (+ .codexclaw state).
