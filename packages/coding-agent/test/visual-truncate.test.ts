import { describe, expect, it } from "bun:test";
import { truncateToVisualLines } from "@gajae-code/coding-agent/modes/components/visual-truncate";

const red = "\u001b[31m";
const reset = "\u001b[39m";

describe("truncateToVisualLines", () => {
	it("returns empty output for empty text", () => {
		const result = truncateToVisualLines("", 3, 10);

		expect(result.visualLines).toEqual([]);
		expect(result.skippedCount).toBe(0);
	});

	it("truncates to the last visual lines after wrapping", () => {
		const text = "one two three four";
		const result = truncateToVisualLines(text, 1, 10, 0);

		expect(result.visualLines).toEqual(["three four"]);
		expect(result.skippedCount).toBe(1);
	});

	it("applies horizontal padding to rendered lines", () => {
		const text = "one";
		const result = truncateToVisualLines(text, 1, 5, 1);

		expect(result.visualLines).toEqual([" one "]);
		expect(result.skippedCount).toBe(0);
	});

	it("recomputes wrapping for width changes", () => {
		const text = "one two three four five six";
		const wide = truncateToVisualLines(text, 2, 80, 0);
		const narrow = truncateToVisualLines(text, 2, 10, 0);
		const wideAgain = truncateToVisualLines(text, 2, 80, 0);

		expect(wideAgain.visualLines).toEqual(wide.visualLines);
		expect(narrow.visualLines).not.toEqual(wide.visualLines);
	});

	it("preserves ANSI text content across truncation", () => {
		const text = `${red}alpha beta gamma delta${reset}`;
		const result = truncateToVisualLines(text, 1, 12, 0);

		expect(Bun.stripANSI(result.visualLines.join("\n"))).toContain("gamma delta");
	});

	it("bounds wide Unicode output to the requested visual line count", () => {
		const result = truncateToVisualLines("한글 한글 한글 한글", 1, 8, 0);

		expect(result.visualLines.length).toBeLessThanOrEqual(1);
		expect(Bun.stripANSI(result.visualLines.join(""))).toContain("한글");
	});

	it("keeps tab-expanded output width-specific", () => {
		const text = "a\tb c d e";
		const narrow = truncateToVisualLines(text, 1, 6, 0);
		const wide = truncateToVisualLines(text, 1, 80, 0);

		expect(narrow.visualLines).not.toEqual(wide.visualLines);
	});
});
