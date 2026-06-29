# 101 Phase 10 split — 20.011 OMP TUI image drafts and terminal edges

## Source card

`struct_har/chase/20.011_omp_chase_tui_image_drafts_terminal_edges.md`

## JWC posture

Reference-only split. OMP image draft and terminal-edge behavior must be checked against JWC's existing image, clipboard, sixel, and TUI owner surfaces and GJC `10.041`.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| image utilities | `packages/coding-agent/src/utils/image-loading.ts`; `image-resize.ts`; image tests |
| clipboard and paste | `packages/coding-agent/src/utils/clipboard.ts`; input-controller paste tests |
| terminal image/sixel | `packages/coding-agent/src/utils/sixel.ts`; `packages/tui/**`; `packages/coding-agent/test/bash-execution-sixel.test.ts`; `packages/coding-agent/test/tools/bash-sixel-render.test.ts`; `packages/tui/test/sixel-probe.test.ts` |
| TUI/session picker/render | `packages/coding-agent/src/modes/**`; `packages/coding-agent/src/tui/**`; `packages/tui/**`; TUI/input tests |

## Split decisions

| Slice | Decision | Rationale | Required future evidence |
|---|---|---|---|
| `20.011-A` bare PNG paste/draft restore | adapt only if JWC paste state has a concrete gap | JWC already has image input/paste owners | image-input/input-controller tests |
| `20.011-B` terminal capability/kitty/Warp handling | split with Frontend/TUI review | terminal capability is environment-sensitive | `packages/tui/**` and coding-agent TUI/sixel/render tests, manual terminal note if needed |
| `20.011-C` session picker/fullscreen/interrupt ordering | coordinate with GJC `10.041` | overlaps TUI input/render split | selector/input/event-controller tests |
| `20.011-D` settings wheel/transcript tail rotation | defer | needs product UX decision before code | focused UX/test evidence |

## Reject/defer

- Do not import OMP terminal heuristics without JWC terminal tests.
- Do not reopen closed `20.006` Esc/AST micro-fixes without fresh regression evidence.
- Do not add platform-specific behavior as default without opt-out/negative tests.

## Done-gate status

No `20.011` done-gate is closed by this split. The card remains reference-only and active.
