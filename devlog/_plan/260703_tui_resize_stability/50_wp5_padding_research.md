# 50 — WP5 P-phase research: full-width padding removal (Opus scout, 260703)

Condensed from the scout report; slice plan adopted.

## Load-bearing verdicts

- **EL-in-line is NOT viable as a general mechanism.** Width machinery tolerates
  `\x1b[K` (zero-width passthrough in pi-natives `ansi_seq_len_u16`, text.rs:312-360;
  SGR tracking untouched), BUT (a) `#terminalTerminator` appends `\x1b[0m` to every
  line so a naive embedded EL paints DEFAULT bg, and (b) overlay compositing
  (`extractSegments`/`sliceByColumn`, tui.ts:1313-1360) has no cells to slice right of
  content on an EL-filled row → bg vanishes/misaligns under overlays. Decisive.
- **Committed rows are the clean EL win**: `buildInsertHistorySequence` already emits
  `\x1b[2K` per row (insert-history.ts:86) — bg-active-at-2K + BCE paints the freed row
  blank-free with ZERO trailing cells → width shrink cannot reflow committed history.
  Never composited under overlays (flush-first), so the constraint doesn't apply.
- **Never intra-line CSI-G/CHA**: zero-width to the measurer, but physically moves the
  cursor — recreates the width/cursor divergence class (R2/R3). No code emits it today;
  keep it that way.
- **BCE detection v1**: no infocmp subprocess (absent on minimal systems). `JWC_TUI_BCE`
  override → allowlist-default-true unless TERM dumb/empty or TERMINAL_ID base; tmux/
  screen BCE is pane-local (fine for live zone; committed rows land in pane history).
  New `bce` capability in terminal-capabilities.ts.

## Producer inventory (summary)

- **Cat A (bg-carrying, needs renderer-level treatment):** padToWidth core
  (coding-agent/src/tui/utils.ts:92-97), output-block.ts:70/80/95/104 (bgFn frames —
  the prime reflow amplifier), applyBackgroundToLine (tui/src/utils.ts:393-401), Box
  (box.ts:127-155), Text (text.ts:84-97), Markdown (markdown.ts:262-275),
  resolve.ts:247 inverse band.
- **Cat B (colorless alignment — just stop trailing-filling):** composer-footer.ts:105
  (`" ".repeat(width - right - 1)` — the floating "jaw"/Thinking label amplifier) and
  :111, full-transcript-overlay.ts:125, footer.ts:231/238, selector/dashboard columns
  (overlay content). Right-alignment where kept: literal LEADING spaces sized by the
  WP2.5-synced visibleWidth; never right-pad after the label.

## Adopted slices

1. **WP5.1** colorless de-padding + right-label trailing-fill removal (C2, low risk;
   goldens: layout-resize-rich-text + interactive-editor-overlay regenerate).
2. **WP5.2** `bce` capability plumbing + env override (no byte changes).
3. **WP5.3** renderer-emitted bg+EL for bg rows (live zone) + bg-active 2K commits;
   literal-space fallback when !bce; overlay-composited rows keep literal cells. High
   risk, broad golden churn — reviewed deltas, plus a TERM=dumb fallback fixture.

Cross-cutting: DECAWM already off neutralizes the deferred-wrap EL hazard (keep the
last-column guard defensively); image lines never get bg/EL.
