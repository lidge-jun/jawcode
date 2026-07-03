# 50 — WP4: final stabilization pass (260703)

## Loop continuity

WP1 (c109b78) realign v3, WP2 (04c0520) signature multiset, WP3 (03ca086) fold targeting
— all committed with 2-round Codex audit/verify each. Remaining debt (task tracker):
6 render-golden fixtures and 4 coding-agent tests failing on a CLEAN tree at 5c375b1
(verified twice via git-stash baselines), i.e. broken by/at the pre-session WIP
checkpoint, not by this session's cycles.

## Scope (class C2 — verification/repair pass, no new features)

1. **Triage the 4 pre-existing coding-agent failures.**
   - `interactive-mode-status.test.ts` "preserves startup notifications...": mock ctx
     lacks `session.buildDisplaySessionContext` — likely a stale test after the
     `renderInitialMessages` refactor (`ui-helpers.ts:695`). Fix the TEST if the product
     path is sound; fix the product if not.
   - `issue-825-repro.test.ts` ×3 (compaction-queue flush → steering queue): determine
     whether `flushCompactionQueue` behavior regressed in the WIP checkpoint (product
     bug → fix) or the contract legitimately changed (update test + record).
2. **Golden refresh.** For each of the 6 failing render-golden fixtures: diff current
   captured viewport/scrollback text vs the stored golden, eyeball that the new behavior
   is correct (no duplicated rows, no blank bands, composer anchored), then regenerate
   with `UPDATE_GOLDENS=1` and re-run to green. Any fixture whose diff shows an actual
   defect becomes a finding instead of a refresh.
3. **Full gates.** Workspace build (`bun run build`), full tui + coding-agent test
   suites, `bun run check` both packages.
4. **E2E smoke.** Launch the built `jwc` binary headlessly (`--help` / print mode) to
   confirm the build boots; interactive screenshot scenarios remain user-verified (the
   three mechanisms have unit repros from WP1-3).

## Verification

Everything in scope IS verification; D records the final suite counts and residuals.

## D — cycle summary (260703 WP4)

- Triage (Codex gpt-5.5 xhigh): 4A/0B — all four pre-existing coding-agent failures were
  stale test mocks from the import commit 5892f59 (missing
  `session.buildDisplaySessionContext` / `ctx.prepareRealUserAgentPromptSubmission`).
  Fixed both mocks → 9/9.
- Golden eyeball review: layout-resize-rich-text, interactive-editor-overlay,
  transcript-shrink-clear, sixel-image-line-preservation have IDENTICAL viewport +
  scrollback text (writeLog escape-byte drift only) → selectively regenerated.
  **multiplexer-viewport-repaint** and **termux-height-diff** expose REAL regressions
  from the WIP checkpoint: (1) in a multiplexer, the INITIAL overflowing render goes
  through the viewport-repaint path (write log: `[H` + 5×2K rows, no 3J/2J) so rows
  above the viewport never materialize into the scrollback — content loss for tmux
  users; (2) the termux resize path leaves 2 stale duplicate rows above the final frame.
  NOT refreshed — carried as WP5.
- Full gates: tui 539/541; coding-agent full suite 116 fail vs 214 at a pre-session
  baseline worktree (net −98; failing groups are subprocess/skill/GJC/model-selector
  domains untouched by this session); workspace build clean; `dist/jwc --version` boots.

Next-direction: WP5 — multiplexer initial-materialization + termux resize scrollback
regressions (repro = the two unrefreshed golden fixtures).
