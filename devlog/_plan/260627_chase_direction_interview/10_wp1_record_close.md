# WP1 — record 9 interview directions + retire 6 reference-decided cards

> PABCD work-phase 1 of the direction-interview goal. Class **C1** (doc-only: record
> confirmed decisions + `git mv` reference cards to `_fin`, update MOC/index).
> User answers (2026-06-27): `ref_batch=hold_lsp` · `code_card=adapt_now` · `ref_design=ref_close`.
> Decision-block source: `01_predrafted_decision_blocks.md` (paste-ready).

## Outcome

All 9 undecided cards carry a `## Confirmed decisions (2026-06-27 interview)` block;
the 6 reference/reject-decided cards are retired to `_fin/{10,20}/` with MOC + follow-index
updated; the 3 non-close cards stay active with their direction recorded.

## Per-card action

| card | answer → direction | block (from 01_predrafted) | disposition |
|------|--------------------|----------------------------|-------------|
| 20.002 worker_catalog | hold_lsp → **reject/reference** | Q1/20.002 | → `_fin/20/` |
| 20.003 memory_skills | hold_lsp → **reference (99.01)** | Q1/20.003 | → `_fin/20/` |
| 20.008 pull_15_13_delta | hold_lsp → **confirm as index** | Q1/20.008 | → `_fin/20/` |
| 20.004 lsp_dap | hold_lsp → **HELD (split, deferred)** | Q1/20.004 hold branch | **stay active** |
| 10.013 assistant_msg_cache | adapt_now → **adapt** | Q2/10.013 adapt | **stay active** (code = WP2) |
| 10.020 deep_interview | ref_close → **split/reference-only** | Q3/10.020 | → `_fin/10/` |
| 10.025 perf_corpus/geobench | ref_close → **split/reference** | Q3/10.025 | → `_fin/10/` |
| 20.007 session_modularization | ref_close → **reference-only** | Q3/20.007 | → `_fin/20/` |
| 10.006 tui_core | ref_close → **defer (082/083 gate)** | Q3/10.006 | **stay active** (gated) |

Close to `_fin`: **6** (20.002·20.003·20.008 → `_fin/20`; 10.020·10.025 → `_fin/10`; 20.007 → `_fin/20`).
Stay active w/ recorded direction: **3** (20.004 held · 10.013 adapt-pending-code · 10.006 defer-gated).

## File operations

1. **Insert decision block** in all 9 cards immediately before `## Jawdev chase expansion`.
2. **`git mv`** the 6 close cards to `struct_har/chase/_fin/{10,20}/` (preserve the block).
3. **MOC update**: `10_gjc_chase_MOC.md` rows for 10.020·10.025 → ✅/`_fin`;
   `20_omp_chase_MOC.md` rows for 20.002·20.003·20.007·20.008 → ✅/`_fin`.
4. **`007_follow_index.md`**: mark 6 closed rows; note 20.004 held, 10.006 deferred, 10.013 adapt-queued.
5. **Goal reconcile note**: 20.008 retired as index card; recommend adding decided **10.019** to the close-queue.

## Verification (C)

- `ls struct_har/chase/_fin/{10,20}/` shows the 6 moved cards; `ls struct_har/chase/` no longer lists them.
- `grep -c "Confirmed decisions" struct_har/chase/**` + `_fin` shows all 9 carry the block.
- `git diff --check` exit 0; no broken intra-doc links to moved cards (grep for stale `./10.020`… refs).
- tsc/tests N/A (doc-only); no source touched in WP1.

## Link-integrity map (audit FAIL fix — complete)

A-audit (VERDICT FAIL) found step 4 incomplete: inbound links in `002_gap_inventory.md`
were unlisted. Authoritative map below (movers go 2 levels deeper → `_fin/{10,20}/`).

### Inbound (edit in non-moving files) — `./X_…` → `./_fin/{10,20}/X_…`
- `002_gap_inventory.md`: L15·L60 (20.008), L63 (20.007), L64 (20.003) → `./_fin/20/…`
- `007_follow_index.md`: L51 (20.003), L52 (20.007), L53 (20.008) → `./_fin/20/…`
- `10_gjc_chase_MOC.md`: L61 (10.020), L63 (10.025) → `./_fin/10/…` + status ✅
- `20_omp_chase_MOC.md`: L42·L55 (20.008), L49 (20.002), L50 (20.003), L54 (20.007) → `./_fin/20/…` + status ✅
- Intra-mover `20.008` L17 (20.003), L18 (20.007): same `_fin/20/` dir → **stay `./` (no edit)**.

### Outbound (edit inside each moved card) — transform by target
- `./<MOC>` / `./bands/…` / `./00X_…` / `./<non-moving card>` → `../../…`
- `../../devlog/…` / `../../structure/…` → `../../../../…`
- `./20.003_…` / `./20.007_…` inside 20.008 → stay (co-moved siblings)

Per-card outbound edits: 20.002 (MOC, bands) · 20.003 (MOC) · 20.007 (MOC, devlog, 20.005) ·
20.008 (MOC, devlog, 20.005, 20.006, bands/083, 006; keep 20.003/20.007) · 10.020 (MOC, 003,
devlog) · 10.025 (MOC, structure). Precedent: `_fin/10/10.011…:3` uses `../../10_gjc_chase_MOC.md`.

### Accuracy note (audit should-fix)
`007_follow_index.md` indexes only 3 of 6 movers (20.003/20.007/20.008); 10.020/10.025/20.002
have no row there — that is expected, not an omission.

## Commit scope

- 9 chase card edits (decision blocks) + 6 `git mv` to `_fin`.
- `10_/20_` MOC + `007_follow_index.md` updates.
- This plan doc. Atomic commits grouped by logical step. No push.
