# 260703 — TUI resize/scroll corruption: stabilization slice map

## Loop continuity (LOOP-CONTINUITY-01)

Previous cycle: 260703 WP5 closed the multiplexer first-overflow materialization and
termux height-diff goldens (devlog/_plan/260702_tui_stabilization/60). Its D conclusion:
remaining corruption classes are policy-inherent (scrollback retention) or unfixed
structural gaps. This session's RCA (user screenshot: rows with horizontally-shifted
fragments, LEFT-cropped lines, floating right-aligned "jaw" labels; worst while resizing
or scrolling during streaming) identified four mechanisms:

- **R1 — terminal reflow vs immutable scrollback.** Width changes make reflowing
  terminals rewrap screen+scrollback. Frame lines are widely FULL-WIDTH padded
  (`padToWidth(..., lineWidth)` in `packages/coding-agent/src/tui/output-block.ts`,
  right-aligned labels in `composer-footer.ts:105`), so every padded line wraps into two
  rows on any width shrink. Renderer never repairs scrollback by policy (3J forbidden
  after committed history, `tui.ts` fullRender). Left-cropped fragments = wrap tails.
- **R2 — resize race → stale-width writes.** Streaming renders every 16ms read
  `process.stdout.columns` at render time; a render firing between the physical PTY
  resize and the Node resize event writes lines truncated to the OLD width. With DECAWM
  never disabled (no `CSI ?7l` anywhere in the repo), those writes physically wrap,
  inserting real rows and permanently desyncing the diff path's relative cursor moves
  (`#hardwareCursorRow` bookkeeping, no DSR/CPR re-sync). widthChanged compares stale
  values, so that render takes the diff path.
- **R3 — no autowrap guard + no cursor verification.** Any single overwide write (stale
  width or `Bun.stringWidth` vs terminal divergence) starts undetectable drift until the
  next absolute repaint; rows scrolled out during the drift window become permanent
  scrollback garbage.
- **R4 — user-observed healing on submit.** The submit path stabilizes because
  `realignOverflowedFrame()` resets all drift-prone bookkeeping and
  `compactViewportFill()` forces an absolute repaint, plus committed components shorten
  the frame. The healing half (absolute repaint + bookkeeping resync) is generalizable to
  more triggers; the realign/commit half is turn-boundary-only (preconditions:
  markable backlog, no overlay, commit lane).

External second opinions in flight (results folded in as they land): Codex gpt-5.5 xhigh
RCA (xterm-headless repro probes), ChatGPT Pro review with tui.ts/terminal.ts/
insert-history.ts attached.

## Work-phase slice map (small → certain first)

| WP | Slice | Class | Status |
|----|-------|-------|--------|
| WP1 | `TUI.resyncViewport()` one-shot absolute repaint primitive + resize-settle trigger | C2 | this cycle |
| WP2 | DECAWM off for the TUI session (`CSI ?7l` on start, `?7h` on stop/suspend/emergency restore) | C2 | next |
| WP3 | coding-agent resync triggers: agent_end, streaming watchdog, Ctrl+L | C2 | after WP2 |
| WP4 | full-width padding → BCE/EL(0) (kill reflow damage at the source) | C3 | needs Codex/GPT input on BCE terminal coverage |
| WP5 | render-time PTY size via ioctl(TIOCGWINSZ) (kill the stale-width race) | C3 | stretch |

One full PABCD cycle per WP; D of each cycle records evidence and re-enters P.

## WP1 detail

See `10_wp1_resync_viewport.md`.
