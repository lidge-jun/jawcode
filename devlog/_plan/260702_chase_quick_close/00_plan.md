# 260702 chase quick-close plan

Goal: run repeated small PABCD cycles over chase cards that can be closed by direct evidence or narrow documentation patches, moving only fully proven cards to `struct_har/chase/_fin`.

## Phase map

| phase | card | intended outcome | implementation surface | verification |
|---|---|---|---|---|
| 10 | `10.069` provider/search/docs/model support | close as already-covered/adapt/reject mix if evidence holds | `struct_har/chase/10.069_*`, `_fin` indexes, this devlog | focused grep/source anchors, `bun test packages/ai/test/claude-usage-retry.test.ts`, `git diff --check` |
| 20 | next low-risk GJC card, likely `10.068` sub-slice | decide whether a small resilience subitem is closeable | chase card + narrow code/docs only if proven | focused test for touched surface |
| 30 | next reference-only OMP card, likely `20.033` | reference-triage, close only if JWC is already protected or explicit no-adopt is justified | chase card + `_fin` indexes | source anchor audit + docs diff check |

## Phase 10 file plan

Move:
- `struct_har/chase/10.069_gjc_chase_provider_search_docs_model_support.md`
- to `struct_har/chase/_fin/10/10.069_gjc_chase_provider_search_docs_model_support.md`

Modify:
- `struct_har/chase/007_follow_index.md`
- `struct_har/chase/002_gap_inventory.md`
- `struct_har/chase/10_gjc_chase_MOC.md`
- `struct_har/chase/_fin/INDEX.md`

Add:
- `devlog/_plan/260702_chase_quick_close/10_phase1_10069_provider_search_docs.md`

No product code changes are planned for Phase 10. Current evidence shows JWC already has Tavily provider docs/config, Claude usage 429/Retry-After retry tests, generic retry-after retry support in `packages/utils/src/fetch-retry.ts`, and prior provider-catalog coverage. The upstream Aside backend was reverted upstream, so it is a reject/no-adopt item rather than an implementation target.

## Preservation constraints

- Do not touch existing dirty TUI files: `packages/tui/src/tui.ts`, `packages/tui/test/scroll-misalignment.test.ts`, or `devlog/_plan/260702_tui_stabilization/12_gpt55_review.md`.
- Do not stage `.jwc/goal/*`, `.codexclaw/`, `.omo/`, or unrelated user work.
- Do not edit chase clones under `devlog/_gjc_chase/` or `devlog/_omp_chase/`.
