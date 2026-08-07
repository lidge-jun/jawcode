/**
 * Two defects, one cycle.
 *
 * 1. LOADER: `edit/diff.ts` resolved the native addon with `createRequire`, but
 *    `@jawcode-dev/natives` declares an `import`-only `exports` condition. The
 *    require therefore always threw MODULE_NOT_FOUND and was swallowed as
 *    "native unavailable", so every diff silently ran the pure-JS path the
 *    native port exists to replace.
 *
 * 2. DECODER: napi's default `String` conversion replaces an unpaired surrogate
 *    with U+FFFD instead of rejecting it, so the native and JS engines returned
 *    different text for the same input.
 *
 * These tests deliberately FAIL rather than skip when native is unavailable.
 * The pre-existing parity test silently `return`s in that case, which is exactly
 * how the dead loader went unnoticed.
 */
import { describe, expect, it } from "bun:test";
import { diffLines as nativeDiffLines } from "@jawcode-dev/natives";
import { __clearDiffLinesForTest, __getNativeDiffLinesForTest, generateDiffString } from "../src/edit/diff";

const LONE_SURROGATE = "\uD800";

describe("native diff loader", () => {
	it("actually resolves the native diffLines export", () => {
		__clearDiffLinesForTest();
		// No skip: an unresolved native export is the bug under test.
		expect(typeof __getNativeDiffLinesForTest()).toBe("function");
	});
});

describe("native diff UTF-16 boundary", () => {
	it("rejects an unpaired surrogate instead of substituting U+FFFD", () => {
		expect(() => nativeDiffLines("a\n", `a${LONE_SURROGATE}\n`)).toThrow(/ill-formed UTF-16/);
	});

	it("still accepts a valid surrogate pair", () => {
		const parts = nativeDiffLines("x\n", "x\u{1F600}\n");
		expect(parts.map(part => part.value).join("")).toContain("\u{1F600}");
	});

	it("preserves an embedded U+0000 rather than treating it as a terminator", () => {
		const base = "a\u0000b\n";
		const parts = nativeDiffLines(base, `${base}c\n`);
		expect(parts.map(part => part.value).join("")).toContain("\u0000");
	});
});

describe("generateDiffString with ill-formed UTF-16", () => {
	it("falls back to the JS diff instead of surfacing the native error", () => {
		__clearDiffLinesForTest();
		const result = generateDiffString("a\n", `a${LONE_SURROGATE}\n`);
		// The native side throws; the caller must degrade to jsdiff, not blow up.
		expect(result.diff.length).toBeGreaterThan(0);
		expect(result.firstChangedLine).toBe(1);
	});

	it("produces identical output to the JS path for well-formed input", () => {
		__clearDiffLinesForTest();
		const native = generateDiffString("line1\nline2\n", "line1\nline2\nline3\n");
		expect(native.firstChangedLine).toBe(3);
		expect(native.diff).toContain("line3");
	});
});
