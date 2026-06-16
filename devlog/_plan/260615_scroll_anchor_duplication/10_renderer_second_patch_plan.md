# P PLAN — Scroll anchoring duplicate-render second patch

## Objective

Fix the remaining TUI scroll anchoring / duplicate-render bug under PABCD after the first live-zone routing fix (`e7c3026d fix: route streamed tools through live zone`). The second patch targets renderer-level duplicate replay when live agent output grows while an earlier/offscreen row also changes.

This intentionally supersedes the `structure/31_scroll.md` §5 growth exception that routed `firstChanged < viewportTop` plus growth to `fullRender(true)` outside multiplexers. The new policy is append-only growth for the new tail rows followed by viewport-only repaint for the offscreen mutation.

User-observed symptoms:

- Reproduced while the user was scrolled upward / not at bottom: active agent output appeared to push content upward and duplicate chunks.
- Reproduced again even while pinned to the bottom row: duplicate output still appeared.

## Current evidence

### First patch already committed

- `packages/coding-agent/src/modes/controllers/event-controller.ts`
- `packages/coding-agent/test/commit-time-folding.test.ts`
- Commit: `e7c3026d fix: route streamed tools through live zone`
- Focused verification: `bun test packages/coding-agent/test/commit-time-folding.test.ts` passed 4 tests / 19 assertions.

### External audits

- `agent://74-ScrollRendererAudit` found the renderer still models only a bottom-pinned logical viewport and highlighted the dangerous branch:
  - `firstChanged < prevViewportTop && grew && !isMultiplexerSession()` → `fullRender(true, "firstChanged < viewportTop")`.
  - This can replay the full transcript, duplicating content already present in scrollback.
- `agent://75-LiveZoneRoutingAudit` confirmed the first-patch live-zone root cause and agreed that renderer/overflow shedding remains a secondary risk.

### Current renderer source

`packages/tui/src/tui.ts` currently does this in `#doRender()`:

```ts
if (firstChanged < prevViewportTop) {
	logRedraw(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
	const grew = newLines.length > this.#previousLines.length;
	if (useLegacyMultiplexerFullRender() || (grew && !isMultiplexerSession())) {
		fullRender(true, "firstChanged < viewportTop");
	} else {
		viewportRepaint(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
	}
	return;
}
```

This was intended to avoid content loss when a frame grows while an offscreen line also changes, but it reintroduces a full transcript replay during live streaming. With commit lane / scrollback-native history, that full replay is exactly the duplicate-output shape.

### Performance-patch interaction hypothesis

The user observed that the recent performance work may have contributed: before the optimization path, more work was recalculated/replayed every tick, so stale renderer positioning was less visible. After P2.2 prepared-line caching and narrower partial render paths, the renderer depends more heavily on `#previousLines`, `#viewportTopRow`, `#maxLinesRendered`, and cached prepared line output being correct across frames.

This plan therefore treats the performance patch as an exposure amplifier, not necessarily the original root cause:

- Do not remove prepared-line caching or revert P2.2.
- Do add bottom-pinned and off-bottom regressions for offscreen mutation + tail growth, so stale partial-render bookkeeping cannot rely on full replay to self-heal.
- Do verify `packages/tui/test/prepared-line-cache.test.ts` with the scroll-focused tests, because the second patch must remain compatible with the cached prepared-line path.

## Patch plan

### MODIFY `packages/tui/src/terminal.ts`

Add an optional viewport-state hook to the `Terminal` interface:

```ts
isViewportAtBottom?(): boolean | undefined;
```

Production `ProcessTerminal` does not need to implement this in the initial patch because native terminal scrollback offset is not reliably observable through the existing raw-tty surface. `undefined` means “unknown”; the renderer treats unknown like bottom for append preservation, while tests can expose known off-bottom state through `VirtualTerminal`.

### MODIFY `packages/tui/src/tui.ts`

#### 1. Anchor `viewportRepaint()` from the live screen top

Before:

```ts
const currentScreenRow = Math.max(0, Math.min(height - 1, hardwareCursorRow - prevViewportTop));
let buffer = "\x1b[?2026h";
if (currentScreenRow > 0) {
	buffer += `\x1b[${currentScreenRow}A`;
}
buffer += "\r";
```

After:

```ts
let buffer = "\x1b[?2026h\x1b[H";
```

Rationale: `viewportRepaint()` is a viewport-only repaint. It should not depend on potentially stale `hardwareCursorRow - prevViewportTop` after commit-lane scroll-out or append movement. Absolute home within the live screen is simpler and avoids repainting rows offset from the intended viewport.

Existing above-viewport shrink cases must continue to pass with the home-anchored `viewportRepaint()` path; those cases are the acceptance coverage for the broader anchoring change.

#### 2. Add a single synchronized helper inside `#doRender()` for offscreen-change + growth

Add a local helper near `viewportRepaint()` that appends only the newly grown tail rows and then repaints the target viewport in the **same synchronized output block**:

```ts
const appendGrowthAndRepaintViewport = (reason: string): void => {
	this.#fullRedrawCount += 1;
	if (renderMetrics.enabled) renderMetrics.recordFullRedraw(reason);
	const appended = newLines.slice(this.#previousLines.length);
	const nextViewportTop = Math.max(0, newLines.length - height);
	let buffer = "\x1b[?2026h";

	if (appended.length > 0) {
		buffer += `\x1b[${height};1H`;
		for (const line of appended) {
			buffer += "\r\n\x1b[2K";
			buffer += line;
		}
	}

	buffer += "\x1b[H";
	for (let screenRow = 0; screenRow < height; screenRow++) {
		if (screenRow > 0) buffer += "\r\n";
		buffer += "\x1b[2K";
		const lineIndex = nextViewportTop + screenRow;
		if (lineIndex >= newLines.length) continue;
		buffer += this.#truncatePreparedLineToWidth(newLines[lineIndex], width);
	}

	const finalPhysicalRow = nextViewportTop + Math.max(0, height - 1);
	let cursorSeq = "\x1b[?25l";
	let cursorToRow = finalPhysicalRow;
	if (cursorPos && cursorPos.row >= nextViewportTop && cursorPos.row < nextViewportTop + height) {
		const cursor = this.#cursorControlSequence(cursorPos, newLines.length, finalPhysicalRow);
		cursorSeq = cursor.seq;
		cursorToRow = cursor.toRow;
	}
	this.#hardwareCursorRow = cursorToRow;
	buffer += cursorSeq;
	buffer += "\x1b[?2026l";

	if (!this.#writeTerminal(buffer)) return;

	if ($flag("PI_DEBUG_REDRAW")) {
		const logPath = getDebugLogPath();
		const msg = `[${new Date().toISOString()}] appendGrowthAndRepaintViewport: ${reason} (prev=${this.#previousLines.length}, new=${newLines.length}, height=${height}, viewportTop=${nextViewportTop})\n`;
		fs.appendFileSync(logPath, msg);
	}

	this.#cursorRow = Math.max(0, newLines.length - 1);
	this.#maxLinesRendered = newLines.length;
	this.#viewportTopRow = nextViewportTop;
	this.#previousLines = newLines;
	this.#previousWidth = width;
	this.#previousHeight = height;
};
```

Implementation may share code with `viewportRepaint()` to avoid duplication, but the behavior must stay one synchronized terminal write. The append phase must not use `hardwareCursorRow - prevViewportTop`; it anchors absolutely to the terminal bottom row before emitting `\r\n` for each prepared appended line. The appended bytes must use the already-prepared `newLines` entries directly, matching `fullRender()`'s byte contract. Telemetry/debug side effects must match other viewport-class redraw paths (`#fullRedrawCount`, `renderMetrics.recordFullRedraw`, `PI_DEBUG_REDRAW` logging).

#### 3. Replace the full replay branch for growth + offscreen change

Before:

```ts
if (useLegacyMultiplexerFullRender() || (grew && !isMultiplexerSession())) {
	fullRender(true, "firstChanged < viewportTop");
} else {
	viewportRepaint(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
}
```

After:

```ts
const viewportAtBottom = this.terminal.isViewportAtBottom?.();

if (useLegacyMultiplexerFullRender()) {
	fullRender(true, "firstChanged < viewportTop");
} else if (grew && !isMultiplexerSession() && viewportAtBottom !== false) {
	appendGrowthAndRepaintViewport(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
} else {
	viewportRepaint(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
}
```

Rationale:

- Preserve explicit legacy multiplexer escape hatch.
- Preserve normal multiplexer behavior as the pre-patch viewportRepaint-only path; do not add append behavior there without a tmux-specific follow-up plan.
- Preserve non-multiplexer growth by appending only newly added tail rows when the viewport is bottom-pinned or unknown.
- When a terminal exposes known off-bottom state (VirtualTerminal regression), avoid append/newline growth and use viewportRepaint-only so the user's scrollback viewport is not forced to the bottom.
- Avoid replaying the entire transcript and duplicating rows already in scrollback.
- Reconcile `#previousLines`, `#maxLinesRendered`, and `#viewportTopRow` exactly once after a successful single-buffer write.

### MODIFY `packages/tui/test/above-viewport-repaint.test.ts`

Add a focused regression with concrete fixture and assertions:

- Setup: `VirtualTerminal(60, 20)`, `ViewportFill`, `MutableContent` blocks named `thinking` and `tail`, and `ComposerStub`, mirroring the existing shrink test fixture.
- Initial render overflows viewport.
- Call `term.clearWriteLog()` before the exercised render.
- In one render pass, mutate an above-viewport row and append two named tail rows:

```ts
const thinking = new MutableContent(lines("thinking", 40));
const tail = new MutableContent(lines("answer", 10));
const tui = new TUI(term);
tui.addChild(new ViewportFill());
tui.addChild(thinking);
tui.addChild(tail);
tui.addChild(new ComposerStub());
tui.start();
await flushRender(term);
term.clearWriteLog();

thinking.setLines(["thinking-updated", ...lines("thinking", 39).slice(1)]);
tail.setLines([...lines("answer", 10), "answer-10", "answer-11"]);
tui.requestRender();
await flushRender(term);
```

- Assert:
  - write log does not include `\x1b[2J` or `\x1b[3J`.
  - write log includes `answer-10` and `answer-11`.
  - write log does not include early offscreen marker rows that would prove full transcript replay for this exercised render, e.g. `thinking-0` or `thinking-1`.
  - `term.getScrollBuffer()` still contains the original early marker, proving history survived without replaying it in the latest write.
  - `term.getViewport()[term.getViewport().length - 1]` is `"> input"` (same concrete floor assertion shape as existing tests).

### MODIFY `packages/tui/test/virtual-terminal.ts`

Add test-only helpers (not part of the production `Terminal` interface):

```ts
scrollViewportUp(lines: number): void {
	this.xterm.scrollLines(-Math.max(0, lines));
}

getViewportY(): number {
	return this.xterm.buffer.active.viewportY;
}

isViewportAtBottom(): boolean {
	const buffer = this.xterm.buffer.active;
	return buffer.viewportY + this.xterm.rows >= buffer.length;
}
```

### Add mandatory scrolled-up regression

Add a second focused regression in `packages/tui/test/above-viewport-repaint.test.ts`:

- Use the same `ViewportFill` + `MutableContent` + `ComposerStub` fixture.
- Render an overflowing transcript and capture `const beforeY = term.getViewportY()`.
- Call `term.scrollViewportUp(5)` and assert `term.getViewportY() < beforeY` (or otherwise not equal to the bottom viewport).
- Clear the write log.
- Mutate an above-viewport row and append named tail rows in one `requestRender()`.
- Assert:
  - no `\x1b[2J` / `\x1b[3J`;
  - appended tail markers are present;
  - early offscreen markers are absent from the exercised write log;
  - `term.isViewportAtBottom()` remains `false` after the render; because the renderer sees `isViewportAtBottom() === false`, it must choose the viewportRepaint-only branch rather than the append/newline branch.
  - last viewport row remains `"> input"` after scrolling back to bottom for final-state inspection if needed.

## Non-goals

- Do not change the curated welcome/banner visuals.
- Do not rewrite the B2-lite viewport fill / sticky gap model.
- Do not introduce alternate-screen rendering.
- Do not silently update render goldens.
- Do not stage unrelated worktree changes.
- Do not add a production real-terminal scroll-position protocol in this patch; this cycle only adds an optional `Terminal` hook plus a VirtualTerminal implementation. `ProcessTerminal` may leave the hook undefined.

## Acceptance criteria

1. The known first patch remains intact:
   - `bun test packages/coding-agent/test/commit-time-folding.test.ts` passes.
2. Renderer duplicate replay is blocked:
   - new `above-viewport-repaint` regression passes.
   - no `2J`/`3J` on offscreen-change + growth path except legacy multiplexer flag path.
3. Existing scroll/commit/prepared-line focused tests pass:
   - `bun test packages/tui/test/above-viewport-repaint.test.ts packages/tui/test/commit-lane.test.ts packages/tui/test/viewport-fill.test.ts packages/tui/test/input-render-latency.test.ts packages/tui/test/input-render-redteam.test.ts packages/tui/test/prepared-line-cache.test.ts packages/coding-agent/test/commit-time-folding.test.ts`
4. Touched-file formatting/type hygiene passes:
   - `bun biome check packages/tui/src/terminal.ts packages/tui/src/tui.ts packages/tui/test/above-viewport-repaint.test.ts packages/tui/test/virtual-terminal.ts structure/31_scroll.md`
5. Full package checks are attempted. If blocked by known unrelated worktree changes (currently `packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts`), record the exact blocker and keep the PABCD C synthesis honest.
6. `structure/31_scroll.md` §5 is updated to replace the superseded growth exception with the new non-multiplexer append+viewportRepaint policy and to preserve the legacy multiplexer escape hatch.

## Commit strategy

- Commit only files touched by this cycle.
- Expected commit 1: `fix: avoid scroll replay on offscreen growth` for `packages/tui/src/terminal.ts`, `packages/tui/src/tui.ts`, `packages/tui/test/above-viewport-repaint.test.ts`, `packages/tui/test/virtual-terminal.ts`, and `structure/31_scroll.md`.
- Optional commit 2: devlog PABCD evidence files.
- Do not stage `.jwc/goal/*` or unrelated package/distribution work.
