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

## Commit scope

- 6 `git mv` + 6 movers' outbound edits; `002_gap_inventory.md`, `007_follow_index.md`,
  `10_/20_` MOC inbound edits; this plan doc. No push. No source touched.
