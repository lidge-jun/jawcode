import { describe, expect, it } from "bun:test";
import { createCollapsedPreview } from "@gajae-code/coding-agent/modes/components/execution-shared";
import { truncateToVisualLines } from "@gajae-code/coding-agent/modes/components/visual-truncate";

describe("createCollapsedPreview", () => {
	it("keeps same-width cached output stable", () => {
		const preview = createCollapsedPreview("one two three four five", 2);

		const first = preview.render(14);
		const second = preview.render(14);

		expect(second).toEqual(first);
		expect(second).not.toBe(first);
	});

	it("misses cache on width changes and restores width-specific output", () => {
		const preview = createCollapsedPreview("alpha beta gamma delta epsilon zeta", 3);

		const wide = preview.render(80);
		const narrow = preview.render(12);
		const wideAgain = preview.render(80);

		expect(narrow).not.toEqual(wide);
		expect(wideAgain).toEqual(wide);
		expect(wideAgain).not.toBe(wide);
	});

	it("clears cached output on invalidate", () => {
		const text = "one two three four";
		const width = 10;
		const preview = createCollapsedPreview(text, 2);
		const first = preview.render(width);

		preview.invalidate?.();
		const afterInvalidate = preview.render(width);
		const oracle = truncateToVisualLines(text, 2, width, 1).visualLines;

		expect(afterInvalidate).toEqual(oracle);
		expect(afterInvalidate).toEqual(first);
		expect(afterInvalidate).not.toBe(first);
	});

	it("uses a separate component instance for changed content", () => {
		const first = createCollapsedPreview("old output line", 2);
		const second = createCollapsedPreview("new output line", 2);

		expect(second.render(80)).not.toEqual(first.render(80));
	});
});
