/**
 * Git segment branch truncation (99.20 band). Branch names up to 6 chars
 * render in full ("agent"/"main" stay readable); longer names collapse to a
 * 3-char stem + ellipsis so the segment stays compact on narrow terminals.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import type { SegmentContext } from "../src/modes/components/status-line/segments";
import { renderSegment } from "../src/modes/components/status-line/segments";
import { EMPTY_JOBS_SNAPSHOT } from "../src/modes/jobs-observer";
import { initTheme } from "../src/modes/theme/theme";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true });
	await initTheme();
});

afterAll(() => {
	resetSettingsForTest();
});

function createCtx(branch: string): SegmentContext {
	return {
		session: {
			state: {},
			isFastModeEnabled: () => false,
			modelRegistry: { isUsingOAuth: () => false },
			sessionManager: undefined,
		} as unknown as SegmentContext["session"],
		width: 120,
		options: {},
		planMode: null,
		goalMode: null,
		pabcd: null,
		goal: null,
		usageStats: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			premiumRequests: 0,
			cost: 0,
			tokensPerSecond: null,
		},
		contextPercent: 0,
		contextWindow: 0,
		autoCompactEnabled: false,
		subagentCount: 0,
		jobs: EMPTY_JOBS_SNAPSHOT,
		sessionStartTime: Date.now(),
		git: {
			branch,
			status: { staged: 0, unstaged: 0, untracked: 0 },
			pr: null,
		},
		usage: null,
	} as unknown as SegmentContext;
}

function strip(content: string): string {
	return content.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("git segment branch truncation", () => {
	it("renders branches up to 6 chars in full", () => {
		for (const branch of ["agent", "main", "dev", "agents"]) {
			const { content, visible } = renderSegment("git", createCtx(branch));
			expect(visible).toBe(true);
			expect(strip(content)).toContain(branch);
		}
	});

	it("collapses branches longer than 6 chars to a 3-char stem + ellipsis", () => {
		const { content } = renderSegment("git", createCtx("feature/long-branch-name"));
		const text = strip(content);
		expect(text).toContain("fea…");
		expect(text).not.toContain("feature");
	});

	it("keeps a 7-char branch at exactly stem + ellipsis", () => {
		const { content } = renderSegment("git", createCtx("develop"));
		const text = strip(content);
		expect(text).toContain("dev…");
		expect(text).not.toContain("develop");
	});
});
