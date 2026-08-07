# 000 — plan: 2026-07-25 upstream chase refresh (GJC + OMP)

## Loop spec (HOTL)

- **Loop archetype:** spec-satisfaction repair (chase coverage + autonomous card implementation), docs-first multi-cycle per LOOP-DOCS-FIRST-01.
- **Trigger:** user request 2026-07-25 — "커밋하고 head를 dev로 전환하고 다시 chase를 기본 레거시 대로 sol 서브에이전트들을 파견해서 문서화 loop, 의사결정 불필요한 것들 PABCD로 고쳐서 커밋/푸시/main 머지".
- **Goal (user-visible outcome):** dev branch refreshed with documented GJC/OMP deltas since 2026-07-17 anchors, autonomous cards implemented and archived, dev pushed, main merged + pushed.
- **Non-goals:** C/direction-decision cards (user), TUI visual identity, npm release/publish, any push beyond dev+main.
- **Verifier:** hash-set coverage of delta commits vs card anchors; `bun run check:ts`; `bun scripts/verify-g002-gates.ts`; `bun scripts/rebrand-inventory.ts --strict`; `bun scripts/check-visible-definitions.ts`; focused tests per implementation; `git ls-remote` SHA equality for push claims.
- **Stop condition:** all workPhases done + criteria met, or terminal outcome (BLOCKED/NEEDS_HUMAN/UNSAFE) with evidence.
- **Memory artifact:** this unit + `.codexclaw/goalplans/jawcode-upstream-chase-loop-on-dev-branch-2026-0/` (goalplan + ledger) + `struct_har/chase/*` cards.
- **Expected terminal outcomes:** DONE (all above green, pushed, merged). BLOCKED (upstream unreachable). NEEDS_HUMAN (card needs product decision). UNSAFE (TUI visual / release flow).
- **Escalation condition:** 3 failed repair rounds on same failure (LOOP-REPAIR-01) or attestation doom (LOOP-DOOM-01).
- **HOTL resource bounds:** write scope = `struct_har/chase/**`, `devlog/**`, `.codexclaw/**`, package source for autonomous card implementations + their tests. Credential scope: git push to origin dev+main only (pre-approved). No wall-clock bound stated by user; stagnation cap via Stop hook.

## Work-phase map (dependency-ordered, PHASE-SPLIT-01)

| WP | phase | content | status |
|---|---|---|---|
| wp1 | housekeeping | commit state, switch dev, merge main→dev (8566fa7), repair post-merge gates (1cef6e4) | ✅ done (pre-loop, evidence in goalplan c1) |
| wp2 | docs-first cycle | pull clones, hash-set deltas, write chase cards via sol subagents, update MOCs + 007_follow_index — **this cycle's B**; its D locks the implementation roadmap | active |
| wp3 | implementation cycles | one PABCD cycle per autonomous card cluster (decade doc per cluster, written at wp2 D) | pending |
| wp4 | _fin reconciliation | header evidence, archive moves, MOC/index sync, full gates | pending |
| wp5 | push + merge | push dev, merge dev→main, push main, report SHAs | pending |

## Constraints

- Card conventions: GJC = `struct_har/chase/10.NNN_*` (next free 10.108), OMP = `20.NNN_*` (next free 20.081); closed cards move to `_fin/10|20/` with `✅ _fin`, `Closed: YYYY-MM-DD`, Decision Slots A–F.
- Classification taxonomy (memory + 2026-07-17 round): directional cards `import / adapt / reject / split`; simple reinforcement `evidence-fill`; intentional tracking `track-only`. A(autonomous) vs B(track/defer/reference) vs C(user decision) — C cards are never autonomously implemented.
- Upstream clones are read-only evidence sources: `devlog/_gjc_chase/gajae-code` (upstream=Yeachan-Heo/gajae-code, dev branch), `devlog/_omp_chase/oh-my-pi` (origin=can1357/oh-my-pi, main).
- Delegation: gpt-5.6-sol subagents, disjoint write sets; reviewer agents read-only.
