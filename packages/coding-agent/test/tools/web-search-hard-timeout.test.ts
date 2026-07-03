import { afterEach, describe, expect, it } from "bun:test";
import {
	getSearchHardTimeoutMs,
	MAX_SEARCH_HARD_TIMEOUT_MS,
	MIN_SEARCH_HARD_TIMEOUT_MS,
	SEARCH_HARD_TIMEOUT_MS,
	setSearchHardTimeoutMs,
	withHardTimeout,
} from "../../src/web/search/providers/utils";

// 10.058 Slice A: configurable web-search hard timeout. The global seeds from
// the compile-time default and is clamped so a malformed setting can never
// disable the Bun/WinHTTP abort safety net.
describe("web-search configurable hard timeout", () => {
	afterEach(() => {
		// Restore class defaults so provider tests stay deterministic.
		setSearchHardTimeoutMs(undefined);
	});

	it("seeds from the compile-time default", () => {
		expect(getSearchHardTimeoutMs()).toBe(SEARCH_HARD_TIMEOUT_MS);
	});

	it("applies an in-range override", () => {
		const applied = setSearchHardTimeoutMs(300_000);
		expect(applied).toBe(300_000);
		expect(getSearchHardTimeoutMs()).toBe(300_000);
	});

	it("clamps a too-small value up to the floor", () => {
		expect(setSearchHardTimeoutMs(10)).toBe(MIN_SEARCH_HARD_TIMEOUT_MS);
	});

	it("clamps a too-large value down to the ceiling", () => {
		expect(setSearchHardTimeoutMs(10_000_000)).toBe(MAX_SEARCH_HARD_TIMEOUT_MS);
	});

	it("clears the override for non-finite input", () => {
		setSearchHardTimeoutMs(120_000);
		expect(setSearchHardTimeoutMs(Number.NaN)).toBe(SEARCH_HARD_TIMEOUT_MS);
		expect(setSearchHardTimeoutMs(Number.POSITIVE_INFINITY)).toBe(SEARCH_HARD_TIMEOUT_MS);
		expect(getSearchHardTimeoutMs()).toBe(SEARCH_HARD_TIMEOUT_MS);
	});

	it("no-arg withHardTimeout reflects the runtime override", () => {
		setSearchHardTimeoutMs(MIN_SEARCH_HARD_TIMEOUT_MS);
		const signal = withHardTimeout(undefined);
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(signal.aborted).toBe(false);
	});

	it("explicit ms argument still overrides the global", () => {
		setSearchHardTimeoutMs(300_000);
		const signal = withHardTimeout(undefined, 1);
		expect(signal).toBeInstanceOf(AbortSignal);
	});
});
