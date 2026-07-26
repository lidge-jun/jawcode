import { describe, expect, it } from "bun:test";
import { formatDuration } from "../src/format";

describe("formatDuration minute boundary", () => {
	it("keeps sub-minute output below 60 seconds until the minute branch", () => {
		expect(formatDuration(59_949)).toBe("59.9s");
		expect(formatDuration(59_950)).toBe("59.9s");
		expect(formatDuration(59_999)).toBe("59.9s");
		expect(formatDuration(60_000)).toBe("1m");
	});

	it("preserves ordinary millisecond and second formatting", () => {
		expect(formatDuration(999)).toBe("999ms");
		expect(formatDuration(1_000)).toBe("1.0s");
		expect(formatDuration(1_500)).toBe("1.5s");
		expect(formatDuration(30_000)).toBe("30.0s");
	});
});
