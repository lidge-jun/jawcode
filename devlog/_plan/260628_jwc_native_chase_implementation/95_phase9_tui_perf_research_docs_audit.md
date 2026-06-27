# 95 Phase 9 audit — TUI, performance, research, and docs edge slices

## Scope

Audit of Phase 9 docs-first plan and chase-card updates:

- `90_phase9_tui_perf_research_docs_plan.md`
- `91_phase9_tui_input_render_split.md`
- `92_phase9_research_mode_split.md`
- `93_phase9_perf_corpus_split.md`
- `94_phase9_external_docs_split.md`
- chase cards `10.041`, `10.046`, `10.049`, `10.052`

## Audit results

| Auditor | Verdict | Notes |
|---|---|---|
| Backend | PASS | Confirmed `autoresearch`, web/search, perf bench/corpus, scripts, and external docs owners exist; `10.046` maps upstream RLM to JWC `autoresearch`; `10.049` correctly treats `_fin/10/10.025` as overlap; `10.052` does not claim unsupported integrations. |
| Docs | PASS | Confirmed numbering, evidence sections, candidate-slice alignment, open status, and JWC naming. Noted Phase 9 phase-map split row was missing before the final fix. |
| Frontend | NEEDS_FIX then PASS | Initial audit required stronger `10.041` boundaries for `_fin/20/20.006`, `resetDisplay`, psmux/team defer to `10.050`, `jobs-observer.ts`, event-controller owners, and Frontend/TUI review gate. Final narrow re-audit passed. |

## Fixes applied

| Issue | Fix |
|---|---|
| Phase map missing split artifacts | Added Phase 9 required split artifacts row for `91-94` in `02_phase_map.md`. |
| `10.041` resetDisplay/psmux boundary | Added explicit `_fin/20/20.006` cross-ref, `resetDisplay` defer, and Phase 8 `10.050` psmux/team defer to the card and plan. |
| `10.041` owner inventory | Added `interactive-mode.ts`, `event-controller.ts`, `jobs-overlay.ts`, `jobs-observer.ts`, event-controller tests, and jobs-observer test. |
| TUI review gate | Updated `10.041` Decision G to require Frontend/TUI review for controller/component/rendering changes. |

## Residual risk

This phase is docs-only. It does not change TUI behavior, research routing, benchmark thresholds, generated artifacts, or product docs. Future implementation slices still need focused tests and role-specific review.
