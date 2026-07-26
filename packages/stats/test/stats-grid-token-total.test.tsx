import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatsGrid } from "../src/client/components/StatsGrid";
import type { AggregatedStats } from "../src/shared-types";

const stats: AggregatedStats = {
	totalRequests: 1,
	successfulRequests: 1,
	failedRequests: 0,
	errorRate: 0,
	totalInputTokens: 100,
	totalOutputTokens: 20,
	totalCacheReadTokens: 300,
	totalCacheWriteTokens: 40,
	cacheRate: 0.75,
	totalCost: 0,
	totalPremiumRequests: 0,
	avgDuration: 1_000,
	avgTtft: 100,
	avgTokensPerSecond: 20,
	firstTimestamp: 1,
	lastTimestamp: 1,
};

describe("StatsGrid conversation token totals", () => {
	test("reconciles the total with cache reads and writes while retaining cache labels", () => {
		const html = renderToStaticMarkup(<StatsGrid stats={stats} />);

		expect(html).toContain("460 conversation tokens total");
		expect(html).toContain("300 cache read");
		expect(html).toContain("40 cache write");
	});
});
