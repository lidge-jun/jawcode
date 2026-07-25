# 010 — wp2 docs loop: chase card authoring via sol subagents

## Scope

IN: `struct_har/chase/10.108+_*` (new GJC cards), `struct_har/chase/20.081+_*` (new OMP cards), `struct_har/chase/10_gjc_chase_MOC.md`, `struct_har/chase/20_omp_chase_MOC.md`, `struct_har/chase/007_follow_index.md`, this devlog unit.
OUT: any package source code, `_fin/` moves of old cards, 002_gap_inventory rewrite (append-only notes allowed).

## Dispatch packets (disjoint write sets)

| packet | agent | band | write set |
|---|---|---|---|
| G1 | sol worker A | GJC full delta `3ddf26079..baa4dc76` (529) | new cards `10.108`–`10.119`, coverage note `020_gjc_card_coverage.md` |
| O1 | sol worker B | OMP `b0d04e517..v17.0.8` (678) | new cards `20.081`–`20.099`, coverage note `021_omp_b1_coverage.md` |
| O2 | sol worker C | OMP `v17.0.8..v17.1.0` (539) | new cards `20.101`–`20.119`, coverage note `022_omp_b2_coverage.md` |
| O3 | sol worker D | OMP `v17.1.0..59619623` (84) | new cards `20.121`–`20.129`, coverage note `023_omp_b3_coverage.md` |

Numbering is pre-allocated in non-contiguous blocks so agents never collide (G1: 10.108–10.119, O1: 20.081–20.099, O2: 20.101–20.119, O3: 20.121–20.129). Unused numbers inside a packet's allocation are fine; the MOC sync (main agent) records actuals. **Overflow rule:** if a packet needs more card numbers than its allocation, the agent STOPS writing new cards, finishes the current card, and reports the residual commit set in its coverage note — the main agent reallocates; agents never write outside their block.

## Card requirements (per card)

1. Follow the structure of `struct_har/chase/10.104_gjc_chase_docs_changelog_qa.md` / `20.080_omp_chase_ci_style_changelog.md`: header line (MOC link, tier, ⬜, priority), `> Reviewed source:` range line, Chase Scope, Evidence Commands Run, Upstream Commit Anchors table (commit + source fact + upstream file anchors), Worktree Verification table (probe vs JWC result), Decision Log.
2. Classify each card: `import` / `adapt` / `reject` / `split` / `evidence-fill` / `track-only`, plus autonomy bucket: **A** (autonomous, no user decision), **B** (track/defer/reference), **C** (user decision required — write Decision Log slots but mark `⬜ C`).
3. Each card header carries the G1/G2 group, a P1–P3 priority, and tier placement per `009_follow_tiers.md` (existing cards' headers show the pattern: `> MOC: ... · G1 · ⬜ · P3 — ...`).
4. Every delta commit is either cited in a card's anchor table or listed in the packet's coverage note with a no-card reason (chore/docs/bot/merge-adjacent). Hash-set proof per `001_delta_evidence.md` method.
5. Naming contract per `008_gjc_jwc_naming_contract.md` (jwc / .jwc vocabulary in JWC-facing prose).
6. Cards record exact `path:line` evidence for claimed gaps; no gap inferred from commit message alone.

## Main-agent tasks after workers return

1. Verify each coverage note's hash-set math independently (re-run rev-list, set-diff vs card anchors).
2. Update `10_gjc_chase_MOC.md` (Reviewed through → `baa4dc76`; Recent GJC dev deltas row for the new band range; active card table rows).
3. Update `20_omp_chase_MOC.md` (Reviewed through → `59619623`; new delta row; active rows).
4. Update `007_follow_index.md` header (refresh date + new heads) and append new card rows.
5. Sync the remaining canon surfaces: review `002_gap_inventory.md` (append new gap classes, or record a dated no-change evidence note if the review finds none), sync `bands/` summaries for the new band ranges, and review `009_follow_tiers.md` tier placement of the new cards.
6. Commit docs (one commit per upstream: `docs(chase): ...`).

## Devlog numbering bands (LEXICO-SPLIT-01, locked)

| range | content |
|---|---|
| 000–009 | research/evidence (000 plan, 001 delta evidence) |
| 010 | wp2 P docs plan (this file) |
| 011 | wp2 A audit record (reviewer verdict + blockers) |
| 012 | wp2 P synthesis (blocker dispositions) |
| 020–023 | wp2 B coverage notes per dispatch packet |
| 029 | wp2 D docs-cycle closeout + implementation roadmap lock |
| 030–089 | wp3 implementation cycles — one decade per autonomous cluster (P/A/B/C/D records within the decade) |
| 090 | wp4 _fin reconciliation record |
| 095 | wp5 push/merge record with exact SHAs |

## Accept criteria

- C-1: set-diff(empty) for each band: delta hashes minus card-cited hashes minus explicitly-listed no-card hashes = ∅.
- C-2: every new card carries classification + autonomy bucket + reviewed-source range.
- C-3: MOCs, 007_follow_index, 002_gap_inventory (or no-change evidence), bands/, 009_follow_tiers reflect new heads and card inventory.
- C-4: docs-only — `git diff --name-only` for the cycle touches only struct_har/chase + devlog (+ .codexclaw state).
- C-5 (wp4 lookahead): _fin moves require `✅ _fin` header, `Closed: YYYY-MM-DD`, Decision Slots A–F with implementation/verification evidence and tracked residuals, fixed relative links, and `_fin/INDEX.md` sync.
