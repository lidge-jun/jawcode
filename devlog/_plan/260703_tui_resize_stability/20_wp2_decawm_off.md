# 20 — WP2: DECAWM off for the TUI session

## Loop continuity

WP1 (10_wp1) shipped `resyncViewport()` + resize flip-back detection (commit 0045e58,
545/545 tui tests). Its D note: resync bounds drift lifetime but does not prevent drift
creation. External reviews landed since: GPT Pro (full report in scratchpad, key points
folded here) confirmed H1–H3, re-ranked H2+H3 as the dominant LIVE-corruption cause, and
named session-wide DECAWM-off the single highest-impact fix. The user also reported
corruption arising NATURALLY (no resize, no scroll — screenshot: right-aligned
"Thinking … +3 lines"/"jaw" labels drifting to odd indents, tool lines wrapping with
left-cropped tails like "evlo…").

## Why this fixes the natural case too (Part 1 — plain)

The renderer guarantees every line it writes measures ≤ terminal width — but it measures
with `Bun.stringWidth`. Characters like `…` `§` `✔` (all East Asian AMBIGUOUS width) can
render 2 columns wide in CJK-leaning terminal configurations while being counted as 1.
Any FULL-WIDTH padded or right-aligned line containing one such character is then
physically 1+ column overwide → with autowrap on, the terminal inserts a real wrapped
row the renderer knows nothing about → every subsequent relative cursor move paints one
row off (the user's screenshot). Exact-width lines are additionally exposed to
deferred-wrap edge cases across emulators (GPT Pro: "never intentionally write a
printable cell into column `width` in primary-buffer diff mode").

Turning autowrap OFF (`CSI ?7l`, DECRST 7) converts every such overwide write from
"insert an invisible row and desync forever" into "clip at the right edge" — visually a
1-char imperfection, row-model-safe. The renderer never relies on autowrap: every line
is pre-wrapped and rows are separated by explicit `\r\n`.

## Diff plan (Part 2)

### MODIFY packages/tui/src/terminal.ts

1. `ProcessTerminal.start()` — after the bracketed-paste enable
   (`this.#safeWrite("\x1b[?2004h")`), add:
   `this.#safeWrite("\x1b[?7l");` (disable autowrap for the session).
2. `ProcessTerminal.stop()` — alongside the other restores (next to
   `\x1b[?2004l`), add: `this.#safeWrite("\x1b[?7h");`.
3. `emergencyTerminalRestore()` — add `"\x1b[?7h"` to the blind-restore escape string
   (crash-path restore; the tracked path already goes through `terminal.stop()`).

Lifecycle coverage: Ctrl+Z suspend and external-editor handoff call `TUI.stop()` →
`terminal.stop()` (wrap restored for the shell); resume calls `start()` (wrap off
again). `#safeWrite` already no-ops on non-TTY stdout, so piped/test runs see no bytes.

### NEW packages/tui/test/decawm.test.ts

ProcessTerminal with `process.stdout.write` spied (terminal-appearance.test.ts idiom):
- start() emits `\x1b[?7l` after raw-mode setup.
- stop() emits `\x1b[?7h`.
- emergencyTerminalRestore() blind path (terminal started then lost) includes `\x1b[?7h`.

## Risks / rollout

- A crash that skips both stop() and the emergency handler leaves the user's shell with
  autowrap off (long shell lines clip until `reset`). Same exposure class as the
  existing raw-mode/kitty/bracketed-paste restores — mitigated by the same handlers.
- Overwide lines now CLIP their last cell(s) instead of wrapping. For correctly-measured
  lines nothing changes; for ambiguous-width mismatches the clipped char is the lesser
  evil vs row drift. Proper ambiguous-width probing is a candidate later WP.
- xterm/tmux/screen/zellij/ghostty/iterm2/kitty all implement DECAWM (DECRST/DECSET 7);
  xterm-headless (test emulator) supports it.
