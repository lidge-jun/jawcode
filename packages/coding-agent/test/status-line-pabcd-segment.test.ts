import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import { renderSegment } from "../src/modes/components/status-line/segments";
import type { SegmentContext } from "../src/modes/components/status-line/types";
import { initTheme } from "../src/modes/theme/theme";

beforeAll(async () => {
	await initTheme();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
});
afterAll(() => {
	resetSettingsForTest();
});

function ctx(pabcd: SegmentContext["pabcd"]): SegmentContext {
	return { pabcd, options: {} } as unknown as SegmentContext;
}

function strip(content: string): string {
	return content.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("pabcd strip segment (99.04.02)", () => {
	it("is invisible without state, when inactive, or on unknown stage", () => {
		expect(renderSegment("pabcd", ctx(null)).visible).toBe(false);
		expect(renderSegment("pabcd", ctx({ stage: "b", active: false })).visible).toBe(false);
		expect(renderSegment("pabcd", ctx({ stage: "zz", active: true })).visible).toBe(false);
	});

	it("renders the band with the current stage marked", () => {
		const result = renderSegment("pabcd", ctx({ stage: "b", active: true, verificationStatus: "done" }));
		expect(result.visible).toBe(true);
		const text = strip(result.content);
		expect(text).toContain("BUILD");
		expect(text).not.toContain("INTERV");
	});

	it("renders current-session stage changes from INTERV to PLAN labels", () => {
		const interview = strip(renderSegment("pabcd", ctx({ stage: "i", active: true })).content);
		const plan = strip(renderSegment("pabcd", ctx({ stage: "p", active: true })).content);
		expect(interview).toContain("INTERV");
		expect(plan).toContain("PLAN");
		expect(plan).not.toContain("INTERV");
	});
	it("shows pending gate chips for A and B stages", () => {
		const a = strip(renderSegment("pabcd", ctx({ stage: "a", active: true, auditStatus: "pending" })).content);
		expect(a).toContain("audit");
		const b = strip(renderSegment("pabcd", ctx({ stage: "b", active: true, verificationStatus: "pending" })).content);
		expect(b).toContain("verify");
	});

	it("shows failure chips with round numbers", () => {
		const a = strip(
			renderSegment("pabcd", ctx({ stage: "a", active: true, auditStatus: "fail", aRound: 2 })).content,
		);
		expect(a).toContain("✗a2");
		const b = strip(
			renderSegment("pabcd", ctx({ stage: "b", active: true, verificationStatus: "needs_fix" })).content,
		);
		expect(b).toContain("✗b");
	});

	it("omits the chip when gates are satisfied", () => {
		const a = strip(renderSegment("pabcd", ctx({ stage: "a", active: true, auditStatus: "pass" })).content);
		expect(a).not.toContain("audit");
		expect(a).toContain("AUDIT");
	});

	it("stays within the 22-column width budget (ANSI stripped)", () => {
		for (const stage of ["i", "p", "a", "b", "c", "d"]) {
			const result = renderSegment(
				"pabcd",
				ctx({ stage, active: true, auditStatus: "pending", verificationStatus: "needs_fix", aRound: 3 }),
			);
			expect(strip(result.content).length).toBeLessThanOrEqual(22);
		}
	});
});
