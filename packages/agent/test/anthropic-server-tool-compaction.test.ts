import { expect, test } from "bun:test";
import { estimateTokens } from "@jawcode-dev/agent-core/compaction/compaction";
import type { AssistantMessage } from "@jawcode-dev/ai/types";

test("compaction counts preserved Anthropic web-search history payloads", () => {
	const base: AssistantMessage = {
		role: "assistant",
		content: [],
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
	const withServerTool: AssistantMessage = {
		...base,
		content: [
			{
				type: "anthropicServerTool",
				block: {
					type: "web_search_tool_result",
					tool_use_id: "srvtoolu_1",
					content: [{ encrypted_content: "encrypted-provider-history-payload".repeat(20) }],
				},
			},
		],
	};

	expect(estimateTokens(withServerTool)).toBeGreaterThan(estimateTokens(base));
});
