# 91 Phase 9 split — 10.041 TUI input render Windows psmux

## Source card

`struct_har/chase/10.041_gjc_chase_tui_input_render_windows_psmux.md`

## JWC posture

Adapt only TUI behavior that preserves JWC's current controller/component/test structure. Do not reopen OMP micro-fixes already closed by `struct_har/chase/_fin/20/20.006_omp_chase_tui_input_micro_fixes.md` unless a new failing JWC test identifies a gap.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| key handling | `packages/coding-agent/src/modes/controllers/input-controller.ts`; input-controller tests |
| composer/input UI | `packages/coding-agent/src/modes/components/composer-chrome.ts`; `composer-footer.ts`; `hook-input.ts`; composer/hook tests |
| selectors | `packages/coding-agent/src/modes/controllers/selector-controller.ts`; selector component tests |
| terminal primitives | `packages/coding-agent/src/tui/**`; TUI tests |
| render lifecycle | `packages/coding-agent/src/modes/interactive-mode.ts`; event-controller and render tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.041-A` | Esc/newline/IME/PowerShell chord regressions and composer key handling. | `input-controller-escape.test.ts`, `input-controller-keybindings.test.ts`, hook/composer tests. |
| `10.041-B` | Selector identity, inline Other input, and active-monitor/jobs panel behavior. | selector/jobs tests and Frontend review if component files change. |
| `10.041-C` | Long-session render-loop, terminal resize, and preedit caret hardening, excluding the `20.006` `resetDisplay` defer unless a new regression proves it belongs here. | event-controller/render/component tests, TUI snapshot-equivalent checks. |

## Reject/defer

- Bulk importing upstream TUI component code.
- Changing Windows psmux/team behavior here; that remains under Phase 8 `10.050` unless the gap is strictly TUI rendering.
- Reopening `20.006` closed Esc/AST whitespace micro-fixes or its conscious `resetDisplay` defer without fresh regression evidence.

## Done-gate status

No `10.041` done-gate is closed by this split. The card remains active.
