# 60 — WP6 implementation map (P-phase research, Opus scout 260703)

Two render modes for tool/thinking blocks: DEFAULT = spinner + fixed-height preview
while running, render-once collapsed on completion, commit early; VERBOSE = always
expanded (gjc upstream parity), no fold. In-place expand stays current-turn/default-mode
only; historical expand = full-transcript overlay (both already exist and stay as-is:
`input-controller.ts:1299-1345`, `:1217-1297`).

## Verdict on "additive policy layer"

Mostly TRUE. The fork already ships the architecture: `tool.renderMode` setting
(`config/settings-schema.ts:767-777`, brand default jwc→commit, engine→verbose, read at
`event-controller.ts:178`), live zone (`liveToolContainer` + `#liveToolComponents`),
per-completion hand-off `#commitLiveTool` (`event-controller.ts:187-196` — container
move + `setMinimized(true)`, NO scrollback write), minimized one-line render
(`tool-execution.ts:512-536` via `renderStatusLine`), `renderCommitted`/
`renderFullTranscript` on all block components. The ONLY non-additive part is moving the
`TUI.commitLines` write earlier than the turn boundary (Slice C below).

## Key mechanics discovered

- Live growth: `tool_execution_update` → `updateResult(partial=true)` grows the block;
  bash/eval renderers self-cap via `BASH/EVAL_DEFAULT_PREVIEW_LINES`
  (`tool-execution.ts:837-844`) but **edit/read/task/custom grow unbounded while
  running**; generic fallback caps 4/12 lines. Thinking streaming tail always renders
  full until the stream moves past it (`assistant-message.ts:282-295`).
- Commit sweep: `commitFinalizedBacklog` (`ui-helpers.ts:138-159`) walks a CONTIGUOUS
  committable prefix of chatContainer, stops at `stopsBacklogSweep` (streaming
  component, pendingTools, non-committable child). `canMarkEntireBacklog` same stoppers.
- **Commit-lane dead-on-overflow**: `commitLines` requires `liveZoneTop > 1`;
  `#lastFillRows` is 0 whenever the frame overflows (`tui.ts:1627-1637`) → once a turn
  overflows one screen, mid-turn commits are impossible until turn-boundary realign.
  → SYNERGY: Slice A's preview cap keeps frames small → commit lane stays alive →
  Slice C actually fires. The slices reinforce each other in this order.
- Today's `verbose` branch is NOT upstream parity: it still minimizes the previous tool
  and respects `toolOutputExpanded=false` (4-line collapse). Upstream gjc
  (devlog/_gjc_chase/gajae-code vendored mirror) has no minimize/commit machinery at
  all — always-full render, thinking never collapsed.

## Slices (map to converged order: WP6a = A+B, WP6b = C)

- **A — DEFAULT running preview cap** (pure render, lowest risk): cap the `#isPartial &&
  !#expanded` render path with `truncateToVisualLines` tail preview + existing spinner;
  cap the streaming thinking tail; optional `tool.livePreviewLines` setting. Risk:
  golden churn; don't double-cap bash/eval.
- **B — VERBOSE always-expanded parity**: verbose branches stop `setMinimized(true)` on
  previous tool, force `setExpanded(true)`, thinking expanded; user-visible for non-jaw
  brands — gate carefully; turn-boundary `toolOutputExpanded=false` reset must not
  collapse verbose blocks.
- **C — early commit at completion** (HIGHEST risk, ship last, behind
  `commitLaneEnabled()`): call a mid-turn-safe variant of `commitFinalizedBacklog` from
  `#commitLiveTool`/`#handleMessageEnd`. Invariants: never commit past the streaming
  component (contiguous prefix already enforces), never `realignOverflowedFrame`
  mid-turn, fall back cleanly to the turn-boundary sweep when `commitLines` returns
  false (overflow/overlay), respect `#segmentStartIndex` segment mutation
  (`event-controller.ts:444-462`).

GPT Pro round-3 adds for C: batch verbose large blocks into one synchronized write +
resync barrier; never route image lines through the insert-history lane; WP3b-min
gating (no commit/drain while overlay open or off-bottom) lands BEFORE C.
