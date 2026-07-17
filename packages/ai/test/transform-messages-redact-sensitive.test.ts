import { describe, expect, it } from "bun:test";
import { redactSensitiveInObject, transformMessages } from "@jawcode-dev/ai/providers/transform-messages";
import type { AssistantMessage, Message, Model, ToolResultMessage } from "@jawcode-dev/ai/types";

const model: Model<"openai-responses"> = {
	api: "openai-responses",
	provider: "openai",
	id: "gpt-test",
	name: "GPT Test",
	baseUrl: "https://api.openai.com/v1",
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	maxTokens: 2048,
	contextWindow: 8192,
	reasoning: true,
};

function assistant(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
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
		timestamp: 2,
	};
}

describe("transformMessages credential redaction", () => {
	it("redacts credentials from messages and invalidates signatures on mutated content", () => {
		const openAiToken = ["sk", "AbCdEf0123456789AbCdEf0123456789AbCdEf0123456789"].join("-");
		const githubToken = `ghp_${"*".repeat(36)}`;
		const messages: Message[] = [
			{ role: "user", content: `user ${githubToken}`, timestamp: 1 },
			assistant([
				{ type: "text", text: `assistant ${openAiToken}` },
				{
					type: "thinking",
					thinking: `thinking ${openAiToken}`,
					thinkingSignature: "signed-thinking",
				},
				{
					type: "toolCall",
					id: "call_1",
					name: "bash",
					arguments: { command: `echo ${githubToken}` },
					thoughtSignature: "signed-arguments",
				},
			]),
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "bash",
				content: [{ type: "text", text: `result ${githubToken}` }],
				isError: false,
				timestamp: 3,
			},
		];

		const transformed = transformMessages(messages, model);

		expect(transformed[0]).toMatchObject({ role: "user", content: "user [github_token_redacted]" });
		const assistantMessage = transformed[1] as AssistantMessage;
		expect(assistantMessage.content[0]).toEqual({ type: "text", text: "assistant [openai_token_redacted]" });
		expect(assistantMessage.content[1]).toEqual({
			type: "thinking",
			thinking: "thinking [openai_token_redacted]",
			thinkingSignature: undefined,
		});
		expect(assistantMessage.content[2]).toMatchObject({
			type: "toolCall",
			arguments: { command: "echo [github_token_redacted]" },
			thoughtSignature: undefined,
		});
		const result = transformed[2] as ToolResultMessage;
		expect(result.content).toEqual([{ type: "text", text: "result [github_token_redacted]" }]);
	});

	it("handles BigInt and cyclic tool arguments without JSON serialization", () => {
		const token = `glpat-${"*".repeat(20)}`;
		const input: Record<string, unknown> = { count: 42n, token };
		input.self = input;

		const redacted = redactSensitiveInObject(input);
		const result = redacted.result as Record<string, unknown>;

		expect(redacted.changed).toBe(true);
		expect(result.count).toBe(42n);
		expect(result.token).toBe("[gitlab_token_redacted]");
		expect(result.self).toBe(result);
	});

	it("preserves credential-shaped prose without plausible token entropy", () => {
		const lookalike = `sk-${"a".repeat(48)}`;
		const transformed = transformMessages([{ role: "user", content: `Example: ${lookalike}`, timestamp: 1 }], model);

		expect(transformed[0]).toMatchObject({ role: "user", content: `Example: ${lookalike}` });
	});
});
