import { describe, expect, it } from "bun:test";
import { transformMessages } from "@jawcode-dev/ai/providers/transform-messages";
import type { AssistantMessage, Model } from "@jawcode-dev/ai/types";

const anthropicModel: Model<"anthropic-messages"> = {
	api: "anthropic-messages",
	provider: "anthropic",
	id: "claude-sonnet-4-5",
	name: "Claude Sonnet 4.5",
	baseUrl: "https://api.anthropic.com",
	input: ["text"],
	cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
	maxTokens: 8192,
	contextWindow: 200000,
	reasoning: true,
};

const openAiModel: Model<"openai-responses"> = {
	...anthropicModel,
	api: "openai-responses",
	provider: "openai",
	id: "gpt-5",
	name: "GPT-5",
	baseUrl: "https://api.openai.com/v1",
};

const assistant: AssistantMessage = {
	role: "assistant",
	content: [
		{
			type: "anthropicServerTool",
			block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "JWC" } },
		},
		{
			type: "anthropicServerTool",
			block: { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ encrypted_content: "x" }] },
		},
		{ type: "text", text: "result" },
	],
	api: "anthropic-messages",
	provider: "anthropic",
	model: "claude-sonnet-4-5",
	usage: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "stop",
	timestamp: 0,
};

describe("Anthropic server-tool replay", () => {
	it("preserves blocks only for the issuing Anthropic provider", () => {
		const sameProvider = transformMessages([assistant], anthropicModel)[0];
		expect(sameProvider?.role).toBe("assistant");
		if (sameProvider?.role !== "assistant") throw new Error("expected assistant replay");
		expect(sameProvider.content).toEqual(assistant.content);

		const crossProvider = transformMessages([assistant], openAiModel)[0];
		expect(crossProvider?.role).toBe("assistant");
		if (crossProvider?.role !== "assistant") throw new Error("expected assistant replay");
		expect(crossProvider.content).toEqual([{ type: "text", text: "result" }]);
	});
});
