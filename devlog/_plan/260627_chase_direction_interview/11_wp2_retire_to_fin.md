# WP2 — retire 6 reference-decided cards to `_fin` + link surgery

> PABCD work-phase 2. Class **C1** (doc moves + relative-link rewrites). Link map is the
> authoritative one in `10_wp1_record_close.md` (§Link-integrity map), already A-audited.
> Movers (6): 20.002, 20.003, 20.008, 20.007 → `_fin/20/`; 10.020, 10.025 → `_fin/10/`.

## Operation order (deterministic, scripted)

1. **Outbound** link rewrites inside each mover (still in `chase/`), per §map:
   `./<sibling>` → `../../<sibling>`; `../../{devlog,structure}` → `../../../../…`;
   keep co-moved `./20.003_…` / `./20.007_…` inside 20.008.
2. **Inbound** rewrites in non-moving files: `002_gap_inventory.md`, `007_follow_index.md`
   (`./X` → `./_fin/{10,20}/X`); `10_/20_` MOC full-row rewrites (link → `_fin` + status `⬜/🟡` → `✅ _fin`);
   `20_MOC` theme-row 20.008 link (replaceAll remainder).
3. **`git mv`** the 6 movers to `struct_har/chase/_fin/{10,20}/`.
4. **`007_follow_index.md`** prose: mark closed; note 20.004 held, 10.006 deferred, 10.013 adapt-queued.

## Verification (C)

- `rg "\]\(\./(20\.002|20\.003|20\.008|20\.007|10\.020|10\.025)_" struct_har/chase --glob '!_fin/**'`
  → **zero** chase-root links to movers remain (all now `./_fin/…` or moved-internal `../../`).
- `ls struct_har/chase/_fin/{10,20}/` shows the 6 moved files; `ls struct_har/chase/` no longer lists them.
- Each moved card's internal links resolve (spot-check 20.008 + 10.020).
- `git diff --check` exit 0. tsc/tests N/A (doc-only).

## C verification result

- ✅ Zero chase-root links to the 6 movers remain (`rg`).
- ✅ 6 files relocated (`_fin/20`: 20.002/003/007/008; `_fin/10`: 10.020/025); gone from chase root.
- ✅ Moved-card link resolution (node `existsSync`): **17/19 resolve**.
- ✅ Stale devlog `_plan`→`_fin` fixed in 8 docs (commit `8b3f820`, 12 refs).
- ✅ `git diff --check` clean; tsc/tests N/A (doc-only).
- **Conclusion: WP2 introduced ZERO new breakage.** The 2 unresolved links are pre-existing
  (see below), not a retirement regression.

## Discovered pre-existing issues (out of WP2 scope — recorded, not fixed)

**Bands consolidation staleness.** `struct_har/chase/bands/` was consolidated to a single
`README.md`; the per-band files (`100_node.md`, `083_output.md`, `080_tui.md`, `081_cursor.md`,
`090_auth.md`, `070_memory.md`, `030_skills.md`, …) no longer exist. Links to `bands/NNN_*.md`
are therefore broken across **many** chase docs — verified identical at `HEAD~2` (before this
work), so NOT introduced here. In the 6 movers this surfaces as 2 broken links:
`20.002 → ../../bands/100_node.md`, `20.008 → ../../bands/083_output.md`. Also present in
active docs: 10.002, 10.003, 10.013, 006_jwc_own_backlog, 004_reference_from_omp, … .

**Recommended follow-up** (separate small PABCD, not this goal): repoint all `bands/NNN_*.md`
references to `bands/README.md` (or its band-row anchors) consistently across chase docs.
Left unfixed here to avoid partial/inconsistent edits and scope creep on the retirement.

## Commit scope

- 6 `git mv` + 6 movers' outbound edits; `002_gap_inventory.md`, `007_follow_index.md`,
  `10_/20_` MOC inbound edits; this plan doc. No push. No source touched.
