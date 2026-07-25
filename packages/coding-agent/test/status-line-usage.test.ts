import { beforeAll, describe, expect, it } from "bun:test";
import { renderSegment } from "../src/modes/components/status-line/segments";
import type { SegmentContext } from "../src/modes/components/status-line/types";
import { initTheme } from "../src/modes/theme/theme";

beforeAll(async () => {
	await initTheme();
});

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function ctx(mode?: "used" | "remaining"): SegmentContext {
	return {
		options: mode ? { usage: { mode } } : {},
		usage: {
			fiveHour: { percent: 24, resetMinutes: 180 },
			sevenDay: { percent: 51, resetHours: 49 },
		},
	} as unknown as SegmentContext;
}

describe("status line usage segment", () => {
	it("renders used quota by default", () => {
		const result = renderSegment("usage", ctx());
		const text = stripAnsi(result.content);

		expect(result.visible).toBe(true);
		expect(text).toContain("5h 24% (3h)");
		expect(text).toContain("7d 51% (2d 1h)");
		expect(text).not.toContain("76%");
	});

	it("renders remaining quota when usage mode is remaining", () => {
		const result = renderSegment("usage", ctx("remaining"));
		const text = stripAnsi(result.content);

		expect(result.visible).toBe(true);
		expect(text).toContain("5h 76% (3h)");
		expect(text).toContain("7d 49% (2d 1h)");
		expect(text).not.toContain("24%");
	});
});
