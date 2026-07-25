# 10 — WP1: resyncViewport() primitive + resize flip-back trigger

## What (Part 1 — plain)

A public one-shot "repaint the visible screen at absolute coordinates" switch on the TUI,
plus an automatic firing of that switch when a resize event returns to the previous
dimensions (flip-back). It heals the screen the same way sending a chat message does,
without committing the turn or touching the scrollback. It cannot delete anything: it
replays the current frame's visible rows in place.

**Design revision during B (settle timer → flip-back detection).** The first build used
a 200ms wall-clock settle timer after the last resize event. The full suite exposed it:
`metrics-redteam.test.ts` "byte-for-byte replay" compares two sequential replay runs
(the harness resizes ~8% of turns), and a wall-clock timer injects absolute repaints at
nondeterministic points of the streaming sequence — the runs' branch decisions
(maxLinesRendered resets) can then diverge, changing which rows enter scrollback.
Analysis of the race also showed the timer was over-broad: a resize whose dimensions
differ from the last render is ALREADY healed by the width/height-change absolute
branches (the stale-width render always runs BEFORE process.stdout.columns updates, so
the change-detecting render follows it). The only unhealed residue is a flip-back —
A→B→A inside one render window, where widthChanged never trips but the terminal
reflowed and may have moved the cursor. Flip-back is detectable AT EVENT TIME by
comparing event dimensions with #previousWidth/Height: deterministic, no timer.

Why not `requestRender(true)`: a forced render resets mirrors to -1 dimensions and, in
3J-allowed sessions, performs a full clearing render including scrollback erase
(`tui.ts` fullRender clear path) — too destructive for a watchdog-style trigger. The
internal `viewportRepaint` closure is exactly the right primitive (absolute `ESC[H`, 2K
per row, no 2J/3J, flushes a parked committed block first, updates all bookkeeping); WP1
only adds a way to request it explicitly.

## Diff plan (Part 2)

### MODIFY packages/tui/src/tui.ts

1. New private state near the other render-scheduling fields:
   - `#resyncRequested = false;`

2. New public method (after `setOverflowFloorFrozen`):

```ts
resyncViewport(reason = "resync viewport"): void {
    if (this.#stopped || !this.terminalAvailable) return;
    this.#resyncRequested = true;
    this.requestRender(false, reason);
}
```

3. `start()`: resize callback becomes `() => this.#handleResize()`:

```ts
#handleResize(): void {
    if (
        this.#previousWidth > 0 &&
        this.#previousHeight > 0 &&
        this.terminal.columns === this.#previousWidth &&
        this.terminal.rows === this.#previousHeight
    ) {
        this.resyncViewport("resize flip-back");
        return;
    }
    this.requestRender();
}
```

   (`#previousWidth > 0` also excludes the forced-render sentinel value -1.)

4. `stop()`: reset `#resyncRequested`.

5. `#doRender()`: consume the flag at the top (`const resyncRequested =
   this.#resyncRequested; this.#resyncRequested = false;`) so ANY render this pass
   consumes it (an earlier absolute branch — first render, width/height change,
   quarantine — already satisfies the request). Insert the explicit branch immediately
   after the misaligned-viewport quarantine and before clearOnShrink:

```ts
if (resyncRequested && (this.#fillSentinelPresent || newLines.length >= height)) {
    viewportRepaint("explicit resync");
    return;
}
```

   Guard rationale: a legacy no-sentinel frame shorter than the viewport may not be
   anchored at screen row 1 (first render prints at the shell cursor without clearing) —
   an `ESC[H` repaint there would stamp frame rows over shell history. Pin-model frames
   always have length ≥ height (fill expansion), so the guard only downgrades the exotic
   legacy case to a normal diff.

### NEW packages/tui/test/resync-viewport.test.ts

VirtualTerminal-based (same pattern as above-viewport-repaint.test.ts):
- **restores corrupted screen**: render a fill-sentinel frame, corrupt the emulator
  directly (`term.write("\x1b[2;1H<garbage>")` outside a TUI render), assert corruption
  visible, `ui.resyncViewport()`, flush, assert viewport matches the frame again.
- **one-shot**: after the resync render, a content-only change goes through the normal
  diff path again (writeLog delta does not start with `ESC[H` full repaint of every row /
  fullRedraws counter increments exactly once for the resync).
- **resize flip-back**: `term.resize(50,20)` + `term.resize(60,20)` before any render
  runs (A→B→A); assert an absolute repaint fired (fullRedraws delta) and screen content
  is correct despite widthChanged never tripping.
- **legacy short frame guard**: no sentinel, content shorter than viewport, resync
  requested → no `ESC[H` repaint emitted (writeLog), diff path output unchanged.

## Risks / non-goals

- Does NOT repair scrollback (policy-preserved) and does NOT prevent drift creation
  (WP2/WP5 do); it bounds drift lifetime.
- viewportRepaint semantics (maxLinesRendered reset, parked-block flush, floor
  untouched) are reused as-is — no new write sequences are introduced.
- Public API addition to @jawcode-dev/tui (`resyncViewport`) is additive; no existing
  signature changes.
