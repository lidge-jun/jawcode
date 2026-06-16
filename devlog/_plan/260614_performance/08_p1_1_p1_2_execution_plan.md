# 08 — P1.1/P1.2 execution plan

> PABCD P-stage plan for implementing the first CPU hot-path fixes from the performance incident. No product/source files are changed by this plan file.

## 1. Objective

Implement and verify two safe CPU-first performance patches while preserving the current scrollback-native UX:

1. **P1.1:** `ToolExecutionComponent` minimized/collapsed status rows must not full-render hidden child content on every render tick.
2. **P1.2:** collapsed execution previews must cache the exact existing `truncateToVisualLines()` result per width/content/budget, with resize-safe invalidation.

Preserved UX:

```text
previous committed jaw/tool/read/result  → immutable terminal scrollback pixels; no ctrl+o toggle
current live user→jaw/tool/read/result   → ctrl+o expand/collapse eligible
next user submit                         → current visual state commits and becomes immutable
ctrl+t                                   → separate transcript pager; no inline history mutation
```

## 2. Files

### MODIFY `packages/coding-agent/src/modes/components/tool-execution.ts`

Purpose: remove hidden full child render from minimized tool rows.

Planned diff shape:

```diff
 class ToolExecutionComponent extends Container {
 	#focused = false;
+	#expandedLineCountsByWidth = new Map<number, number>();
 	#renderState = { ... };
```

```diff
+	private #clearExpandedHeightCache(): void {
+		this.#expandedLineCountsByWidth.clear();
+	}
+```

Clear sites are explicit, not vague: clear before/with `updateArgs()` after the early-return guard, `setArgsComplete()` when it starts final preview diff work, `#runPreviewDiff()` success before `#updateDisplay()`, `updateResult()` before `#updateDisplay()`, `#maybeConvertImagesForKitty()` conversion success before `#updateDisplay()`, `setShowImages()` before `#updateDisplay()`, and `override invalidate()` before `#updateDisplay()`. The rule is: any path that can mutate `#contentBox`, `#contentText`, `#multiFileBoxes`, image conversion state, edit preview state, result text, or rendered args clears `#expandedLineCountsByWidth` before the next minimized render. State-only changes such as focus/minimized/expanded do not clear the cache unless they rebuild body content.

Mandatory clear table:

| Mutator | Clear point |
|---|---|
| `updateArgs()` | after early-return guard and before `#runPreviewDiff()` / `#updateDisplay()` |
| `setArgsComplete()` | when it changes `#argsComplete`, before `#runPreviewDiff()` |
| `#runPreviewDiff()` | success path before assigning `#editDiffPreview` / `#updateDisplay()` |
| `updateResult()` | after assigning result/partial state and before `#updateDisplay()` |
| `#maybeConvertImagesForKitty()` | conversion success before storing converted image / `#updateDisplay()` |
| `setShowImages()` | before `#updateDisplay()` |
| `override invalidate()` | before `super.invalidate()` / `#updateDisplay()` |

Do not replace this with a blanket clear at the start of `#updateDisplay()` unless `setExpanded(false)` is refactored to preserve a just-populated expanded-height cache; a naive blanket clear would erase the cache immediately before minimized render.

```diff
 	setExpanded(expanded: boolean): void {
+		if (this.#expanded === expanded) return;
 		this.#expanded = expanded;
 		this.#updateDisplay();
 	}
```

```diff
 	setMinimized(minimized: boolean): void {
+		if (this.#minimized === minimized) return;
 		this.#minimized = minimized;
 	}
```

```diff
 	override render(width: number): string[] {
 		if (this.#minimized && !this.#expanded) {
-			const full = super.render(width);
-			const hiddenLines = Math.max(0, full.length - 2);
+			const cachedFullHeight = this.#expandedLineCountsByWidth.get(width);
+			const hiddenLines = cachedFullHeight === undefined ? 0 : Math.max(0, cachedFullHeight - 2);
 			...
 			return this.#applyFocusMarker(["", ` ${truncateToWidth(line, Math.max(1, width - 1))}`]);
 		}
-		return this.#applyFocusMarker(super.render(width));
+		const lines = super.render(width);
+		this.#expandedLineCountsByWidth.set(width, lines.length);
+		return this.#applyFocusMarker(lines);
 	}
```
`renderCommitted(width)` inherits this behavior: if the current minimized tool has no cached expanded height for `width`, the committed status row is allowed to omit `+N lines` rather than paying a hidden full render. That is the explicit CPU/UX tradeoff for minimized-first widths.


Notes:

- The minimized path never calls `super.render(width)`.
- Hidden-line meta remains exact when the tool has already rendered expanded at the same width, which is the normal path before a newer tool minimizes it.
- On a brand-new width with no cached expanded height, the minimized row omits the `+N lines` meta rather than paying full hidden render. Expanding re-renders at the current width and refreshes the cache.
- `renderFullTranscript()` and expanded ctrl+o paths still render full output and populate the cache.
- No `any`, dynamic imports, or prompt changes.
- Height-cache invalidation is mandatory: any tool output/body mutation must clear `#expandedLineCountsByWidth` before the next minimized render. Stale `+N lines` is not allowed for changed content at a previously cached width.
- Remove the stale inline comment at the old minimized path that says children render cheaply for hidden-line counting.

### MODIFY `packages/coding-agent/src/modes/components/execution-shared.ts`

Purpose: cache exact collapsed preview visual lines inside the component returned by `createCollapsedPreview()`.

Planned diff shape:

```diff
 export function createCollapsedPreview(previewText: string, previewLines: number): Component {
+	let cachedWidth: number | undefined;
+	let cachedResult: string[] | undefined;
 	return {
-		render: (width: number) => truncateToVisualLines(previewText, previewLines, width, 1).visualLines,
-		invalidate: () => {},
+		render: (width: number) => {
+			if (cachedWidth === width && cachedResult) return cachedResult.slice();
+			cachedWidth = width;
+			cachedResult = truncateToVisualLines(previewText, previewLines, width, 1).visualLines;
+			return cachedResult.slice();
+		},
+		invalidate: () => {
+			cachedWidth = undefined;
+			cachedResult = undefined;
+		},
 	};
 }
```

Implementation detail:

- Return a defensive copy of cached visual lines (`cachedResult.slice()`) unless the implementation adds and documents a stronger immutability contract for component render arrays.
- Cache dimensions are exactly `previewText`, `previewLines`, padding `1`, and `width`. The first three are closure constants; width is the live key.
- Resize safety is owned by width-miss behavior for the current single preview instance. Parent invalidation is still supported through `invalidate()` for reused children, but bash/eval rebuilds usually allocate a new preview component on output changes.

Notes:

- This is an exact-result cache, not bounded-tail truncation.
- Resize invalidates by width miss; explicit `invalidate()` clears the cache.
- No module-global preview result cache is added.

### MODIFY `packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts`

Purpose: encode P1.1 behavior and preserve ctrl+o/overlay behavior.

Add a test-local helper before the new tests:

```ts
function attachCountingChild(tool: ToolExecutionComponent): { renderCount: number } {
	const counter = { renderCount: 0 };
	tool.addChild({
		render: () => {
			counter.renderCount++;
			return ["sentinel"];
		},
		invalidate() {},
	});
	return counter;
}
```

This helper uses the inherited `Container.addChild()` API. The sentinel does not need to be part of the real tool body; it mechanically proves whether minimized render accidentally calls `super.render(width)`.

Planned test changes:

```diff
 it("renders a one-line summary with hidden-line hint when minimized", () => {
 	const tool = makeTool("ls -la", "a\nb\nc\nd");
 	const fullHeight = tool.render(80).length;
 	tool.setMinimized(true);
 	const lines = strip(tool.render(80));
 	...
 	expect(lines[1]).toContain(`+${fullHeight - 2} lines`);
 });
+
+it("does not render hidden children while minimized and still renders them when expanded", () => {
+	const tool = makeTool("printf", Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n"));
+	const counter = attachCountingChild(tool);
+	tool.setMinimized(true);
+	expect(strip(tool.render(80)).length).toBe(2);
+	expect(strip(tool.render(40)).length).toBe(2);
+	expect(counter.renderCount).toBe(0);
+	tool.setExpanded(true);
+	void tool.render(40);
+	expect(counter.renderCount).toBeGreaterThan(0);
+});
+
+it("clears cached minimized hidden-line counts when output height changes", () => {
+	const tool = makeTool("ls -la", "a\nb\nc\nd");
+	void tool.render(80);
+	tool.setMinimized(true);
+	expect(strip(tool.render(80))[1]).toContain("lines");
+	tool.updateResult({ content: [{ type: "text", text: "single" }], isError: false }, false);
+	expect(strip(tool.render(80))[1]).not.toContain("+2 lines");
+});
+
+it("omits hidden-line hint for unseen resized or committed width instead of full-rendering", () => {
+	const tool = makeTool("ls -la", "a\nb\nc\nd");
+	void tool.render(80);
+	tool.setMinimized(true);
+	expect(strip(tool.render(40))[1]).not.toContain("lines");
+	expect(strip(tool.renderCommitted(40))[1]).not.toContain("lines");
+	tool.setExpanded(true);
+	void tool.render(40);
+	tool.setExpanded(false);
+	expect(strip(tool.render(40))[1]).toContain("lines");
+});
```

Retain existing ctrl+o/overlay coverage in this same file:

- `expansion overrides minimization and is reversible`
- `transcript overlay shows full output of minimized tools without mutating chat state`

Add no test that depends on historical committed ctrl+o; that remains covered by input-controller/commit tests outside this P1 slice.
### MODIFY `packages/coding-agent/test/visual-truncate.test.ts`

Purpose: keep ANSI/wide/resize correctness for the existing exact truncation oracle.

Planned additions:

```diff
 import { truncateToVisualLines } from "@gajae-code/coding-agent/modes/components/visual-truncate";
+
+const red = "\u001b[31m";
+const reset = "\u001b[39m";
```

Add cases:

- width 80 → 10 → 80 returns width-specific wrapped lines without stale reuse.
- ANSI span across wrapping keeps stripped text equal to expected tail.
- Hangul/CJK wide text does not exceed requested visual line count.
- tabs remain represented through existing `Text` render behavior.

### ADD `packages/coding-agent/test/execution-shared-preview.test.ts`

Purpose: test the `createCollapsedPreview()` cache separately from the `truncateToVisualLines()` oracle.

Planned assertions:

- same component rendered twice at same width returns equal visual lines.
- width change produces a different wrapped result for wrap-sensitive text.
- render width 80 → 20 → 80 on the same preview instance and assert the final 80-column output equals the original 80-column output, not stale 20-column output.
- `invalidate()` after same-width render recomputes logically equivalent lines.
- changed-content behavior is represented by a new `createCollapsedPreview()` instance, matching bash/eval `#updateDisplay()` rebuild behavior; a new preview text must not reuse the old closure cache.
- bash/eval callsite ownership: output/content changes rebuild the execution display and allocate a new collapsed-preview component; same-instance caches only serve immutable `previewText`.

`visual-truncate.test.ts` remains the exact truncation oracle. `execution-shared-preview.test.ts` validates cache invalidation/reuse only against that oracle.

If internal counters are needed, add them through a test-local wrapper or opt-in debug hook rather than production stdout/logging.


## 3. Explicit non-goals

- No bounded-tail truncation in this patch.
- No Box committed-child skip in this patch; it remains P1.3.
- No ctrl+t lazy transcript rendering in this patch.
- No session resume materialization refactor in this patch.
- No MCP lifecycle cleanup in this patch.
- No changes to committed scrollback, 3J policy, or current-turn ctrl+o semantics.
- No P0 instrumentation in this patch; instrumentation remains deferred to the separate measurement slice in `00_moc.md` / `07_hardening_addendum.md`.
- No error-summary CPU rewrite beyond removing minimized hidden full render; status description behavior remains current first-line/error/args formatting.
- P1.3 Box committed skip stays sequenced in `02_patch_roadmap.md`; this slice must not silently absorb it.

## 4. Verification plan

Focused commands after implementation:

```bash
bun test packages/coding-agent/test/modes/components/tool-execution-minimize.test.ts packages/coding-agent/test/visual-truncate.test.ts packages/coding-agent/test/execution-shared-preview.test.ts
```

If imports or shared component behavior touch broader execution rendering, also run:

```bash
bun test packages/coding-agent/test/bash-execution-clamp.test.ts packages/coding-agent/test/modes/components/tool-execution-spacing.test.ts
```

Acceptance:

- Minimized tool render remains two lines.
- Expanded render and transcript overlay still show full content.
- ctrl+o expansion remains reversible while live.
- Minimized render at a new width does not pay a hidden full render; hidden-line hint may be absent until expanded at that width.
- Collapsed preview resize output is width-correct and stale-cache free.
- The first CPU acceptance criterion is satisfied directly: repeated minimized render of a hidden tool body avoids full child `render()` / full `wrapTextWithAnsi()` work.
- P1.2 tests cover both the truncation oracle and the collapsed-preview cache/invalidation path; width changes must not serve stale cached visual lines.
- Matrix map: minimized-tool row → counting-child minimized/expanded test; ctrl+o current-turn row → retained `expansion overrides minimization and is reversible` plus existing submit-freeze tests outside this P1 slice; collapsed-preview row → `visual-truncate.test.ts` oracle plus `execution-shared-preview.test.ts` cache tests.

## 5. Risk controls

- The only visible behavior change allowed is hidden-line meta omission for a minimized tool at a width that has never had an expanded render cache.
- Exact output body, status title, error first-line description, focus marker, and transcript overlay behavior must remain unchanged.
- Cache invalidation is conservative: width miss and explicit invalidate clear cached collapsed preview output.
- Cached preview arrays are returned defensively with `slice()` on both cache hits and misses unless a stronger immutable-render-array contract is added and documented.
