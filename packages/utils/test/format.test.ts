import { describe, expect, it } from "bun:test";
import { formatBytes, formatNumber } from "../src/format";

describe("formatNumber", () => {
	it("clamps integer K/M bands below the next suffix", () => {
		expect(formatNumber(999_499)).toBe("999K");
		expect(formatNumber(999_999)).toBe("999K");
		expect(formatNumber(999_999_999)).toBe("999M");
	});

	it("preserves exact thresholds and unbounded B behavior", () => {
		expect(formatNumber(1_000_000)).toBe("1M");
		expect(formatNumber(1_000_000_000)).toBe("1B");
		expect(formatNumber(1_000_000_000_000)).toBe("1000B");
	});
});

describe("formatBytes", () => {
	it("clamps byte bands below the next suffix", () => {
		expect(formatBytes(1024 * 1024 - 1)).toBe("1023.9KB");
	});

	it("preserves exact thresholds and unbounded GB behavior", () => {
		expect(formatBytes(1024 * 1024)).toBe("1.0MB");
		expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0GB");
		expect(formatBytes(1024 ** 4)).toBe("1024.0GB");
	});
});
