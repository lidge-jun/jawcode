import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import type { ContextUsage } from "../src/extensibility/extensions/types";
import { StatusLineComponent } from "../src/modes/components/status-line";
import { initTheme } from "../src/modes/theme/theme";
import type { AgentSession } from "../src/session/agent-session";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true });
	await initTheme();
});

afterAll(() => {
	resetSettingsForTest();
});

function makeSession(contextUsage: ContextUsage): { session: AgentSession; reads: () => number } {
	let readCount = 0;
	const session = {
		model: { id: "test-model", contextWindow: contextUsage.contextWindow },
		messages: [{ role: "user", content: "heuristic bait ".repeat(100_000) }],
		getContextUsage: () => {
			readCount++;
			return { ...contextUsage };
		},
	} as unknown as AgentSession;
	return { session, reads: () => readCount };
}

describe("StatusLineComponent context snapshot", () => {
	it("delegates provider-anchored totals to the session SSOT", () => {
		const { session, reads } = makeSession({
			tokens: 150_000,
			contextWindow: 200_000,
			percent: 75,
			source: "provider_anchor",
		});
		const component = new StatusLineComponent(session);

		expect(component.getCachedContextBreakdown()).toEqual({
			usedTokens: 150_000,
			contextWindow: 200_000,
			source: "provider_anchor",
		});
		expect(reads()).toBe(1);
		component.dispose();
	});

	it("preserves an unknown post-compaction snapshot", () => {
		const { session } = makeSession({
			tokens: null,
			contextWindow: 200_000,
			percent: null,
			source: "unknown",
		});
		const component = new StatusLineComponent(session);

		expect(component.getCachedContextBreakdown()).toEqual({
			usedTokens: null,
			contextWindow: 200_000,
			source: "unknown",
		});
		component.dispose();
	});
});
