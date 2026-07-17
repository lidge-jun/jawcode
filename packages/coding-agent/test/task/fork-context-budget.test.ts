import { describe, expect, it } from "bun:test";
import type { Model } from "@jawcode-dev/ai";
import type { ForkContextSeed } from "../../src/session/agent-session";
import { trimForkContextSeedForModel } from "../../src/task/executor";

function seed(): ForkContextSeed {
	const messages = Array.from({ length: 5 }, (_, index) => ({
		role: "user" as const,
		content: [{ type: "text" as const, text: `${index}:${"context ".repeat(900)}` }],
		timestamp: index,
	}));
	return {
		messages,
		agentMessages: structuredClone(messages),
		metadata: {
			sourceSessionId: "parent",
			parentMessageCount: messages.length,
			includedMessages: messages.length,
			skippedMessages: 0,
			approximateTokens: 20_000,
			maxMessages: 50,
			maxTokens: 20_000,
			skippedReasons: {},
		},
	};
}

function model(contextWindow: number, maxTokens: number): Model {
	return {
		id: "child",
		name: "child",
		provider: "test",
		api: "mock",
		baseUrl: "mock://",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow,
		maxTokens,
	};
}

describe("fork context child budget", () => {
	it("reserves child output and fixed prompt overhead while retaining newest messages", () => {
		const result = trimForkContextSeedForModel(seed(), model(16_000, 4_096));

		expect(result.metadata.maxTokens).toBe(7_808);
		expect(result.metadata.approximateTokens).toBeLessThanOrEqual(7_808);
		expect(result.metadata.includedMessages).toBe(result.messages.length);
		expect(result.metadata.skippedReasons["child-context-ceiling"]).toBeGreaterThan(0);
		expect(result.messages.at(-1)?.timestamp).toBe(4);
	});

	it("does not mutate the frozen parent seed and keeps the stricter parent cap", () => {
		const input = seed();
		input.metadata.maxTokens = 2_000;
		const before = structuredClone(input);

		const result = trimForkContextSeedForModel(input, model(200_000, 32_000));

		expect(result.metadata.maxTokens).toBe(2_000);
		expect(input).toEqual(before);
	});
});
