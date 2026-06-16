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

interface GoalStateStub {
	goal?: { status?: string; tokensUsed?: number };
	agentPauseCount?: number;
	pauseAudit?: { actor: string; evidence: string; timestamp: string };
}

function ctx(goal: SegmentContext["goal"], goalState?: GoalStateStub): SegmentContext {
	return {
		planMode: null,
		goalMode: { enabled: true, paused: false },
		pabcd: null,
		goal,
		options: {},
		session: {
			getGoalModeState: () => goalState ?? { goal: { status: "active" } },
			settings: { get: () => false },
		},
	} as unknown as SegmentContext;
}

function strip(content: string): string {
	return content.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("goal segment ledger chips (99.04.04)", () => {
	it("shows checkpoint count when the ledger has checkpoints", () => {
		const text = strip(renderSegment("mode", ctx({ checkpointCount: 3, lastEvidenceBlank: false })).content);
		expect(text).toContain("✓3");
		expect(text).not.toContain("!ev");
	});

	it("warns when the last checkpoint evidence is blank", () => {
		const text = strip(renderSegment("mode", ctx({ checkpointCount: 2, lastEvidenceBlank: true })).content);
		expect(text).toContain("✓2");
		expect(text).toContain("!ev");
	});

	it("renders the original display when no ledger exists (regression 0)", () => {
		const result = renderSegment("mode", ctx(null));
		expect(result.visible).toBe(true);
		const text = strip(result.content);
		expect(text).toContain("Goal");
		expect(text).not.toContain("✓");
		expect(text).not.toContain("!ev");
	});

	it("shows the pending agent-pause audit chip (1-tap without audit)", () => {
		const text = strip(renderSegment("mode", ctx(null, { goal: { status: "active" }, agentPauseCount: 1 })).content);
		expect(text).toContain("audit");
	});

	it("hides the audit chip once the audit is recorded", () => {
		const text = strip(
			renderSegment(
				"mode",
				ctx(null, {
					goal: { status: "active" },
					agentPauseCount: 1,
					pauseAudit: { actor: "agent", evidence: "reviewer ok", timestamp: "t" },
				}),
			).content,
		);
		expect(text).not.toContain("audit");
	});
});
