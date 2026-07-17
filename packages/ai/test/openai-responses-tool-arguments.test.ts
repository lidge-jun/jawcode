import { describe, expect, it } from "bun:test";
import { convertResponsesAssistantMessage } from "@jawcode-dev/ai/providers/openai-responses-shared";
import type { AssistantMessage, Model, ToolCall } from "@jawcode-dev/ai/types";

const model: Model<"openai-responses"> = {
	id: "gpt-5",
	name: "GPT-5",
	api: "openai-responses",
	provider: "openai",
	baseUrl: "https://api.openai.com/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128_000,
	maxTokens: 8_192,
};

function convertArguments(argumentsValue: unknown): string {
	const toolCall: ToolCall = {
		type: "toolCall",
		id: "call_1|fc_1",
		name: "read",
		arguments: argumentsValue as ToolCall["arguments"],
	};
	const message: AssistantMessage = {
		role: "assistant",
		content: [toolCall],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: 0,
	};
	const items = convertResponsesAssistantMessage(message, model, 0, new Set<string>());
	const item = items[0] as { arguments?: string };
	return item.arguments ?? "";
}

describe("OpenAI Responses tool argument serialization", () => {
	it("sanitizes nested malformed Unicode before replay", () => {
		expect(convertArguments({ path: "bad\ud800path", nested: { value: "ok\udfff" } })).toBe(
			'{"path":"bad�path","nested":{"value":"ok�"}}',
		);
	});

	it("normalizes undefined, null, arrays, and malformed JSON to an object", () => {
		for (const value of [undefined, null, [], "", "not json", "[1,2]"]) {
			expect(convertArguments(value)).toBe("{}");
		}
	});

	it("accepts a JSON object string and rejects cyclic structures", () => {
		expect(convertArguments('{"path":"README.md"}')).toBe('{"path":"README.md"}');
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		expect(convertArguments(cyclic)).toBe("{}");
	});

	it("sanitizes custom tool input without changing its freeform shape", () => {
		const toolCall: ToolCall = {
			type: "toolCall",
			id: "call_1|ctc_1",
			name: "edit",
			arguments: { input: "patch\ud800" },
			customWireName: "apply_patch",
		};
		const message: AssistantMessage = {
			role: "assistant",
			content: [toolCall],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: 0,
		};
		const items = convertResponsesAssistantMessage(message, model, 0, new Set<string>());
		expect(items[0]).toMatchObject({ type: "custom_tool_call", input: "patch�" });
	});
});
