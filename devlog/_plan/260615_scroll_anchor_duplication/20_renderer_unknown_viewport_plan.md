# 20 — P PLAN: unknown viewport duplicate-render follow-up

## Objective

Fix the remaining TUI scroll/duplicate-render regression reported after the prior scroll anchoring patch and a fresh build. The observed reproduction is live agent output duplicating or pushing rows while the user is scrolled upward, and it has also reproduced while apparently pinned to the bottom row.

This is a follow-up to `10_renderer_second_patch_plan.md`. That prior patch removed full transcript replay for `firstChanged < viewportTop` plus growth, but it intentionally left production `ProcessTerminal` without a real viewport-position hook. The current source therefore treats `undefined` viewport position as bottom-like:

```ts
const viewportAtBottom = this.terminal.isViewportAtBottom?.();
...
} else if (grew && !isMultiplexerSession() && viewportAtBottom !== false) {
	appendGrowthAndRepaintViewport(...);
}
```

`VirtualTerminal` can return `true`/`false`, so tests cover known bottom and known off-bottom. Real `ProcessTerminal` returns `undefined`, so both real bottom and real off-bottom are routed through the append-growth path. The user reproduction strongly suggests that this append phase can still duplicate or move rows in real terminals after the performance/render-cache patches made stale physical positioning more visible.

This cycle intentionally supersedes the plan-10 policy that treated `undefined` as unknown-but-bottom-like for append preservation. The revised policy is conservative: append-growth is allowed only when bottom position is positively known.

## Current evidence

- Canonical scroll spec: `structure/31_scroll.md` §5 says unknown viewport is currently treated like bottom for append preservation.
- Current renderer: `packages/tui/src/tui.ts:1733-1743` uses `viewportAtBottom !== false` in the `firstChanged < prevViewportTop` branch.
- Current viewport repaint helper: `packages/tui/src/tui.ts:1500`.
- Current terminal interface: `packages/tui/src/terminal.ts` defines optional `isViewportAtBottom?(): boolean | undefined`; `ProcessTerminal` does not implement it.
- Existing tests: `packages/tui/test/above-viewport-repaint.test.ts` covers:
  - above-viewport shrink without 2J/3J;
  - offscreen mutation + growth with known bottom;
  - known off-bottom remains off-bottom.
- User evidence after fresh build: duplicate output still reproduced, including an “apparently bottom row” case. Therefore the safe default for real unknown terminals must not be the physical append phase.

## Root-cause hypothesis

The remaining bug is not that logical `newLines` are wrong. It is that the renderer emits a physical append (`\x1b[<height>;1H` + `\r\n`) when it cannot prove the user is at the bottom. In real terminals, that append can scroll the viewport or duplicate rows already present in scrollback/live viewport. A later input render or forced repaint can reconcile the logical frame, making the issue appear as transient duplication/pushing during agent output.

The recent performance work likely amplified the symptom by reducing broad per-tick recomputation/repaint; stale physical cursor/viewport state now survives longer when the renderer chooses a partial append path.

## Patch plan

### MODIFY `packages/tui/src/tui.ts`

Change the offscreen-change + growth branch to require proven bottom state before using `appendGrowthAndRepaintViewport()`.

Before:

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

After:

```ts
const viewportAtBottom = this.terminal.isViewportAtBottom?.();
if (useLegacyMultiplexerFullRender()) {
	fullRender(true, "firstChanged < viewportTop");
} else if (grew && !isMultiplexerSession() && viewportAtBottom === true) {
	appendGrowthAndRepaintViewport(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
} else {
	viewportRepaint(`firstChanged < viewportTop (${firstChanged} < ${prevViewportTop})`);
}
```

Rationale:

- Known bottom (`true`) keeps the tested append-growth optimization.
- Known off-bottom (`false`) keeps the existing safe viewportRepaint-only behavior.
- Unknown (`undefined`) now chooses viewportRepaint-only instead of append-growth. This favors no duplicate/no forced bottom movement over speculative scrollback append.
- `ProcessTerminal` remains simple and does not pretend to know scrollback position.
- `PI_TUI_LEGACY_MULTIPLEXER_FULL_RENDER` remains the explicit escape hatch.

### MODIFY `packages/tui/test/above-viewport-repaint.test.ts`

Add a regression that wraps `VirtualTerminal` but hides `isViewportAtBottom`, mimicking `ProcessTerminal` unknown viewport state while retaining xterm-backed inspection.

Test outline:

```ts
function unknownViewportTerminal(term: VirtualTerminal): Terminal {
	return {
		start: term.start.bind(term),
		stop: term.stop.bind(term),
		drainInput: term.drainInput.bind(term),
		write: term.write.bind(term),
		get available() {
			return term.available;
		},
		get columns() {
			return term.columns;
		},
		get rows() {
			return term.rows;
		},
		get kittyProtocolActive() {
			return term.kittyProtocolActive;
		},
		moveBy: term.moveBy.bind(term),
		hideCursor: term.hideCursor.bind(term),
		showCursor: term.showCursor.bind(term),
		clearLine: term.clearLine.bind(term),
		clearFromCursor: term.clearFromCursor.bind(term),
		clearScreen: term.clearScreen.bind(term),
		setTitle: term.setTitle.bind(term),
		setProgress: term.setProgress.bind(term),
		onAppearanceChange: term.onAppearanceChange.bind(term),
		get appearance() {
			return term.appearance;
		},
	};
}
```

The wrapper must intentionally omit `isViewportAtBottom` so `this.terminal.isViewportAtBottom?.()` evaluates to `undefined`. Do not subclass `VirtualTerminal` with an incompatible `isViewportAtBottom(): boolean | undefined` override, and do not use object-rest destructuring on a class instance because prototype methods would be dropped.

Scenario:

1. Use `const term = new VirtualTerminal(60, 20)` and pass `unknownViewportTerminal(term)` to `new TUI(...)`.
2. Build the same overflowing fixture: `ViewportFill`, `thinking` (`40` lines), `tail` (`10` lines), `ComposerStub`.
3. Initial render, then `term.clearWriteLog()`.
4. Mutate an offscreen line and append `answer-10` / `answer-11` in one render pass.
5. `tui.requestRender()` and flush.

Assertions:

- No `\x1b[2J` / `\x1b[3J`.
- Write log does not contain the append-growth cursor anchor `\x1b[20;1H` (for a 20-row terminal), proving unknown did not take the append phase.
- Write log still contains `answer-10` / `answer-11` through viewport repaint.
- Write log does not contain early offscreen rows such as `thinking-0` / `thinking-1`, proving no full transcript replay.
- `term.getScrollBuffer()` still contains `thinking-0`, proving history survived even though unknown viewports skip append-growth.
- Visible viewport floor assertion is exact: `term.getViewport()[term.getViewport().length - 1] === "> input"`.

Also tighten the existing known-off-bottom test:

- Change its assertion so known off-bottom must not contain the append-growth cursor anchor either, while keeping the existing `answer-10` / `answer-11` presence assertions. The current test allows appended markers to appear in the write log, which does not distinguish viewport repaint from append+repaint and therefore misses the user’s real duplicate shape.

Also tighten the existing known-bottom growth test:

- Add a positive assertion that the write log contains `\x1b[20;1H` for a 20-row terminal, proving `isViewportAtBottom() === true` still takes the append-growth optimization instead of silently degrading to viewportRepaint-only.

### MODIFY `structure/31_scroll.md`

Update §5 policy text:

- Replace “off-bottom이 아니거나 off-bottom 여부가 불명확하면 appendGrowthAndRepaintViewport” with “only when the terminal proves `isViewportAtBottom() === true`”.
- State that `undefined` viewport state is treated as unsafe/unknown and uses viewportRepaint-only.
- Keep the physical limitation note: real terminal scrollback cannot be un-scrolled; the renderer must prefer not emitting speculative CRLF append when it cannot prove bottom position.
- Explicitly state that this supersedes the earlier plan-10 unknown-as-bottom append policy.

## Non-goals

- Do not revert the prepared-line cache or input-priority render patches.
- Do not simplify or rewrite B2-lite viewport fill / sticky gap behavior.
- Do not modify `packages/tui/src/tui.ts` clear-on-shrink defaults globally.
- Do not add terminal query protocols for real scrollback position in this patch.
- Do not touch curated welcome/banner visuals.
- Do not stage unrelated worktree changes.

## Acceptance criteria

Focused verification:

```sh
bun test packages/tui/test/above-viewport-repaint.test.ts packages/tui/test/viewport-fill.test.ts packages/tui/test/commit-lane.test.ts packages/tui/test/prepared-line-cache.test.ts
```

Expected test outcomes:
- Known-bottom growth test: write log includes `\x1b[20;1H`, includes `answer-10`/`answer-11`, and excludes early `thinking-0`/`thinking-1` replay.
- Known-off-bottom growth test: write log excludes `\x1b[20;1H`, still includes `answer-10`/`answer-11`, excludes early replay, and `term.isViewportAtBottom()` remains `false`.
- Unknown-viewport growth test: write log excludes `\x1b[20;1H`, still includes `answer-10`/`answer-11`, excludes early replay, preserves `thinking-0` in `getScrollBuffer()`, and keeps the exact floor row `> input`.

Broader package verification:

```sh
bun --cwd=packages/tui run check
```

If coding-agent integration is touched unexpectedly, also run:

```sh
bun test packages/coding-agent/test/commit-time-folding.test.ts
bun --cwd=packages/coding-agent run check
```

Documentation/touched-file formatting:

```sh
bun biome check packages/tui/src/tui.ts packages/tui/test/above-viewport-repaint.test.ts structure/31_scroll.md
```

Expected implementation commit:

```text
fix: avoid unknown-viewport scroll append
```

## PABCD notes

- This plan is intentionally small because the previous renderer patch already landed most scaffolding.
- A-stage should specifically challenge whether dropping append-growth for unknown terminals risks losing scrollback history. The intended answer is that duplicate-free live viewport correctness wins for unknown real terminals; scrollback reconciliation remains available via deliberate full rebuild/compact paths, and known-bottom terminals still preserve the append optimization.
- A-stage accepted the scrollback-history tradeoff for production `ProcessTerminal`: because it cannot prove bottom position, it must choose duplicate-free viewport repaint over speculative CRLF append. Known-bottom test coverage preserves the append path for terminals that can prove bottom state.
