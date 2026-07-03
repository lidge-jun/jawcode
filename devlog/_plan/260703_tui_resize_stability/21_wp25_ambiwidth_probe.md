# 21 — WP2.5: ambiguous-width probe → width-measurement alignment

## Loop continuity

WP2 (20_wp2) shipped DECAWM-off (fdb6e46 + 3cc2689, 548/548, pushed). Its D note: with
autowrap off, a width-measurement mismatch no longer causes row drift — it clips at the
right edge. WP2.5 removes the mismatch itself so nothing is clipped and truncation/
padding are computed with the terminal's real cell widths. GPT Pro round 2 recommended
this slice immediately after WP2 (it directly targets the no-resize screenshot); round 3
review of the probe design is in flight and will be folded in before D.

Verified locally: `Bun.stringWidth("…§·", {ambiguousIsNarrow:false})` = 6 vs `true` → 3
(default narrow); `✔` is 1 either way (not EAW-A in Bun — matches GPT Pro's nuance that
the mismatch class is "ambiguous/emoji/symbol", probe with EAW-A chars only).

## What (Part 1 — plain)

At startup, ask the terminal how wide it actually renders East Asian Ambiguous
characters (`§…·`): print them, ask for the cursor position (CPR), erase — one invisible
round-trip. If the terminal says 2 cells, switch the width measurer to match
(`Bun.stringWidth(s, {ambiguousIsNarrow:false})`), flush the prepared-line caches, and
repaint once. Result: `…`/`§`-bearing lines are truncated and padded with the terminal's
real widths — no more clipped tails on CJK-configured terminals, and correct layout for
the "Thinking … +3 lines" labels from the user's screenshot.

## Diff plan (Part 2)

### MODIFY packages/tui/src/utils.ts

- Module state + accessors near `visibleWidthRaw`:
  `let ambiguousIsNarrow = true;`
  `export function setAmbiguousWidthMode(mode: "narrow" | "wide"): void`
  `export function getAmbiguousWidthMode(): "narrow" | "wide"`
- `visibleWidthRaw` line ~137: `const sw = typeof Bun !== "undefined" ? (s: string) =>
  Bun.stringWidth(s, { ambiguousIsNarrow }) : (s: string) => s.length;`
  (pure-ASCII fast path above is unaffected; all wrap/truncate/pad helpers route through
  visibleWidth, so the mode applies uniformly, including @jawcode-dev/tui consumers.)

### MODIFY packages/tui/src/tui.ts — `#queryAmbiguousWidth()` (sixel-probe idiom)

- State: `#ambiguousProbePending`, `#ambiguousProbeBuffer`, `#ambiguousProbeTimeout`,
  `#ambiguousProbeUnsubscribe`.
- Called from `start()` after `#queryCellSize()`:
  1. Env override wins, probe skipped: `JWC_AMBIGUOUS_WIDTH` = `2|wide` → wide,
     `1|narrow` → narrow.
  2. Skip when stdout is not a TTY (VirtualTerminal tests opt in explicitly).
  3. Register input listener FIRST, then write `\r§…·\x1b[6n\r\x1b[2K` in one chunk —
     the terminal prints the probe, reports the cursor column, then the CR+EL erases it
     before the first frame paints; the screen is never visibly disturbed and the reply
     arrives async.
  4. Listener consumes `^\x1b\[(\d+);(\d+)R$` (with split-sequence partial buffering,
     same as the sixel probe): `col - 1 >= 6` → wide, else narrow. Non-matching input
     passes through untouched.
  5. 150ms timeout → keep the current default (narrow). Deliberate deviation from GPT
     Pro's locale fallback: most modern terminals (incl. macOS Korean setups) default
     ambiguous=narrow, and with WP2's DECAWM off a wrong narrow only clips one cell —
     while a wrong wide mis-lays-out every padded line. No-regression default; the env
     var covers the rest.
  6. On a mode CHANGE: `setAmbiguousWidthMode`, `#clearPreparedLineCaches()`,
     `this.invalidate()`, `this.requestRender(true)` (startup window — no committed
     history yet, forced render is the existing start() behavior).
- Cleanup in `stop()`/`#markTerminalUnavailable()` (timeout + unsubscribe), mirroring
  the sixel probe.

### NEW packages/tui/test/ambiguous-width.test.ts

- utils: wide mode → `visibleWidth("…") === 2`, `truncateToWidth` cuts earlier; narrow
  restores; afterEach resets module state.
- TUI probe on VirtualTerminal: start() writes `\x1b[6n` after the probe chars; feeding
  `\x1b[1;7R` through the input path flips mode to wide and forces a repaint; feeding
  `\x1b[1;4R` keeps narrow.
- env override `JWC_AMBIGUOUS_WIDTH=2`: no CPR written, mode wide.
- timeout: no reply → mode stays narrow after the window.

## GPT Pro round-3 refinements (folded in before B)

- **Probe byte order**: `\r\x1b[2K§…·\x1b[6n`, then on success OR timeout `\r\x1b[2K` +
  repaint (clear first so the probe never mixes with existing shell-line content).
- **Own partial reassembly**: terminal.ts's private-CSI reassembler only covers
  `ESC [?` prefixes (DA1/kitty/2031) — plain CPR (`ESC [ 12;7 R`) is NOT reassembled
  there. The TUI listener buffers `^\x1b\[[0-9;]*$` partials itself, consumes only CPR,
  passes everything else through (sixel idiom, adjusted pattern).
- **Commit gate until resolved**: a wrong first PAINT is row-safe post-WP2, but a wrong
  first COMMIT bakes mismeasured pixels into canonical history — `commitLines()` returns
  false (virtual-lane fallback) until the width mode is resolved (probe reply, timeout,
  or env). Expose `ambiguousWidthResolved` from the probe state.
- **Narrow-terminal guard**: columns < 8 → skip probe, use fallback (CPR result would be
  meaningless once the probe clips).
- **✔ stays out of scope**: not EAW-A in Bun's table — separate symbol/emoji class; if
  checkmark corruption persists post-WP2.5, options are U+FE0E text-presentation or a
  small override table (future WP).

## Risks

- CPR reply pattern can theoretically be produced by shifted-F3 in exotic xterm
  configs; exposure is a 150ms startup window with passthrough for non-matches.
- Module-global width mode: tests must restore; runtime only ever sets it during the
  startup window (and via env), never mid-stream except the probe resolution repaint.
- Mid-session terminal setting changes (user toggles ambiguous width in prefs) are out
  of scope — same class as font-zoom (WP-later watchdog/resync territory).
