import { afterEach, describe, expect, it } from "bun:test";
import { applyBackgroundToLine, ROW_BG_MARKER, visibleWidth } from "../src/utils";

/**
 * 260704 WP5.3 — full-row backgrounds without literal padding. Under BCE the
 * producer emits a zero-width row-bg marker instead of trailing spaces; the
 * renderer's prepare path swaps the marker for EL right after the background
 * SGR activates, painting the row via BCE. No trailing cells → terminal
 * reflow on width changes has nothing to shred.
 */

afterEach(() => {
	delete Bun.env.JWC_TUI_BCE;
});

const bg = (text: string) => `\x1b[48;5;236m${text}\x1b[49m`;

describe("row background via BCE (260704 WP5.3)", () => {
	it("BCE path: marker instead of padding — zero trailing cells", () => {
		Bun.env.JWC_TUI_BCE = "1";
		const line = applyBackgroundToLine("content", 40, bg);
		expect(line).toContain(ROW_BG_MARKER);
		expect(visibleWidth(line)).toBe(visibleWidth("content"));
		expect(Bun.stripANSI(line)).toBe(Bun.stripANSI(line).trimEnd());
	});

	it("no-BCE fallback keeps the literal padding contract", () => {
		Bun.env.JWC_TUI_BCE = "0";
		const line = applyBackgroundToLine("content", 40, bg);
		expect(line).not.toContain(ROW_BG_MARKER);
		expect(visibleWidth(line)).toBe(40);
	});
});
