# 00 INDEX — clean-follow tier1 implementation loop

## Goal

Implement and close the additional clean-follow 1-tier chase cards as separate, atomic FULL PABCD cycles:

1. `10.060` TUI render resilience, Ctrl+Enter submit, status-line UX.
2. `10.041` remaining TUI input/render Windows psmux.
3. `10.056` terminal bell plus completion hook.
4. `10.064` Telegram daemon entrypoint plus Windows bell workaround.
5. `10.057` Windows hardening.
6. `10.061` tmux/team Windows psmux titles.
7. `10.052` docs external integrations.
8. `20.015` release/test leak hardening reference closure.

`10.019` is intentionally out of this goal after the accepted file-lock GC vertical. Remaining harness/team/tmux/registry GC adapters are deferred to a future goal because the scope needs separate safety and ownership decisions.

## Constraints

- One card equals one complete PABCD cycle with an atomic commit.
- OMP material is reference evidence only. No 1:1 OMP ports.
- Public/product naming remains `jwc`, `.jwc`, and `@jawcode-dev/*`; upstream names are allowed only as cited source facts.
- Do not touch `devlog/_gjc_chase/` or `devlog/_omp_chase/` except for read-only evidence.
- Do not run `tsc` or `npx tsc`; use Bun verification gates.
- Ignore existing untracked folders: `.codexclaw/`, `.omo/`, `devlog/_plan/260630_ci_green_stabilization/`.
- For TUI work, preserve the user-curated scroll and visual behavior in `packages/tui/src/tui.ts` and related coding-agent TUI components.

## Required closure bundle per card

Each card closes only when the bundle below exists:

| evidence kind | required proof |
|---|---|
| Documentation | card body updated or moved to `_fin`, MOC row, `007_follow_index.md`, `002_gap_inventory.md` if relevant, and `10.001` or `20.001` cycle note |
| Implementation | source/test paths changed, or explicit no-code/reference rationale |
| Verification | focused test output, `bun run check:ts`, and `git diff --check` |
| Review | read-only employee/sub-agent verdict for the card's surface |
| Git | atomic commit, no push/reset/force |

## Work-phase order

### Phase 1 — `10.060`

Reason: highest immediate clean-follow user value among the open 1-tier candidates, has concrete upstream commits, and mostly touches local TUI/status-line behavior with focused tests.

Plan file: `10_phase1_10060_tui_render_resilience.md`.

### Phase 2 — `10.041`

Handle the remaining TUI input/render Windows psmux slices after `10.060` lands. Keep `20.006 resetDisplay` deferred unless a fresh JWC regression proves it belongs here.

### Phase 3 — `10.056`

Adapt terminal bell plus completion hook after checking existing notification cards `10.028` through `10.035`.

### Phase 4 — `10.064`

Adapt compiled Telegram daemon entrypoint and Windows Terminal bell workaround. Coordinate with `10.056` and already-closed `10.030`.

### Phase 5 — `10.057`

Selectively import/adapt Windows platform hardening in JWC runtime paths.

### Phase 6 — `10.061`

Adapt tmux title and Windows/psmux spawn fixes after `10.057` so shared runtime naming and platform helpers are stable.

### Phase 7 — `10.052`

Docs-only or docs-plus-tests closure for external integration documentation. Do not claim unsupported integrations as implemented.

### Phase 8 — `20.015`

Reference-only closure after rechecking `10.048` overlap. If no new JWC owner remains, close as track-only with explicit evidence rather than release implementation.

## PABCD discipline

At the end of each D phase, if cards remain, re-enter P for the next card. Do not batch multiple cards into one B phase.
