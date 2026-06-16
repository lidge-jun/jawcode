/**
 * jwc fork (devlog 081.9 §3): the compaction reserve and the actual request
 * output budget must read the same number. effectiveMaxOutputTokens is that
 * single source: caller's explicit maxTokens, else catalog maxTokens capped
 * at DEFAULT_MAX_OUTPUT_TOKENS_CAP (32k) — matching mapOptionsForApi.
 */
import { describe, expect, it } from "bun:test";
import { DEFAULT_MAX_OUTPUT_TOKENS_CAP, effectiveMaxOutputTokens } from "@jawcode-dev/ai";

describe("effectiveMaxOutputTokens", () => {
	it("caps catalog maxTokens above the default cap", () => {
		expect(effectiveMaxOutputTokens({ maxTokens: 64_000 })).toBe(32_000);
		expect(effectiveMaxOutputTokens({ maxTokens: 128_000 })).toBe(32_000);
	});

	it("keeps catalog maxTokens at or below the cap unchanged", () => {
		expect(effectiveMaxOutputTokens({ maxTokens: 8192 })).toBe(8192);
		expect(effectiveMaxOutputTokens({ maxTokens: DEFAULT_MAX_OUTPUT_TOKENS_CAP })).toBe(
			DEFAULT_MAX_OUTPUT_TOKENS_CAP,
		);
	});

	it("lets an explicit request override the cap", () => {
		expect(effectiveMaxOutputTokens({ maxTokens: 64_000 }, 50_000)).toBe(50_000);
		expect(effectiveMaxOutputTokens({ maxTokens: 64_000 }, 1024)).toBe(1024);
	});

	it("falls back on a zero/undefined request (|| semantics of the request default)", () => {
		expect(effectiveMaxOutputTokens({ maxTokens: 64_000 }, 0)).toBe(32_000);
		expect(effectiveMaxOutputTokens({ maxTokens: 64_000 }, undefined)).toBe(32_000);
	});

	it("composer scenario: 200k window threshold moves from 136k to 168k", () => {
		// threshold = window − max(15%·window, reserveTokens 16384, effective output)
		const window = 200_000;
		const reserve = Math.max(Math.floor(window * 0.15), 16_384, effectiveMaxOutputTokens({ maxTokens: 64_000 }));
		expect(window - reserve).toBe(168_000);
	});
});
