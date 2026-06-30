// Regression: some models occasionally emit a `toolCall` with an empty `name`
// (`{ "name": "", "arguments": "{}" }`). The agent loop rejects it at execution
// time (`Tool  not found`), but the malformed block + its error tool-result
// otherwise remain in the replayed history and 400 every provider on
// `tool_use.name` / `tool_calls[i].function.name` validation, wedging the
// session in an unrecoverable loop until a manual clear.
//
// `transformMessages` is the canonical sanitize boundary every provider funnels
// through, so the defensive filter lives there.
import { describe, expect, it } from "bun:test";
import { transformMessages } from "@jawcode-dev/ai/providers/transform-messages";
import type { AssistantMessage, Message, Model, ToolCall, ToolResultMessage } from "@jawcode-dev/ai/types";

const model: Model<"anthropic-messages"> = {
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

function assistant(content: AssistantMessage["content"], timestamp: number): AssistantMessage {
	return {
		role: "assistant",
		content,
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
		stopReason: "toolUse",
		timestamp,
	};
}

function toolResult(toolCallId: string, text: string, timestamp: number, toolName = "read"): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName,
		content: [{ type: "text", text }],
		isError: false,
		timestamp,
	};
}

function getToolCalls(messages: Message[]): ToolCall[] {
	return messages.flatMap(msg =>
		msg.role === "assistant" ? msg.content.filter((block): block is ToolCall => block.type === "toolCall") : [],
	);
}

describe("transformMessages drops malformed (empty-name) tool calls", () => {
	it("removes the empty-name toolCall block, its matched toolResult, and keeps surviving content", () => {
		const messages: Message[] = [
			{ role: "user", content: "Help me out", timestamp: 1 },
			assistant(
				[
					{ type: "text", text: "Working on it." },
					{ type: "toolCall", id: "call_empty", name: "", arguments: {} },
				],
				2,
			),
			{
				role: "toolResult",
				toolCallId: "call_empty",
				toolName: "",
				content: [{ type: "text", text: "Tool  not found" }],
				isError: true,
				timestamp: 3,
			},
			{ role: "user", content: "continue", timestamp: 4 },
		];

		const transformed = transformMessages(messages, model);

		const empties = getToolCalls(transformed).filter(tc => !tc.name || tc.name.trim() === "");
		expect(empties).toHaveLength(0);

		// Surviving text content is preserved.
		const assistantMsgs = transformed.filter((m): m is AssistantMessage => m.role === "assistant");
		expect(assistantMsgs).toHaveLength(1);
		expect(assistantMsgs[0]!.content).toEqual([{ type: "text", text: "Working on it." }]);

		// The malformed call's error result is gone.
		const toolResults = transformed.filter((m): m is ToolResultMessage => m.role === "toolResult");
		expect(toolResults).toHaveLength(0);
	});

	it("drops a whitespace-only tool-call name", () => {
		const messages: Message[] = [
			assistant([{ type: "toolCall", id: "call_ws", name: "   ", arguments: {} }], 1),
			{
				role: "toolResult",
				toolCallId: "call_ws",
				toolName: "   ",
				content: [{ type: "text", text: "Tool  not found" }],
				isError: true,
				timestamp: 2,
			},
		];

		const transformed = transformMessages(messages, model);
		expect(getToolCalls(transformed)).toHaveLength(0);
		expect(transformed.filter(m => m.role === "toolResult")).toHaveLength(0);
	});

	it("drops an assistant turn that becomes empty after removing the malformed call", () => {
		const messages: Message[] = [
			{ role: "user", content: "go", timestamp: 1 },
			assistant([{ type: "toolCall", id: "call_only", name: "", arguments: {} }], 2),
			{ role: "user", content: "again", timestamp: 3 },
		];

		const transformed = transformMessages(messages, model);
		expect(transformed.filter(m => m.role === "assistant")).toHaveLength(0);
		expect(transformed.filter(m => m.role === "user")).toHaveLength(2);
	});

	it("leaves valid tool calls and their results untouched", () => {
		const messages: Message[] = [
			{ role: "user", content: "read foo", timestamp: 1 },
			assistant([{ type: "toolCall", id: "call_ok", name: "read", arguments: { path: "foo" } }], 2),
			toolResult("call_ok", "file contents", 3),
		];

		const transformed = transformMessages(messages, model);
		const calls = getToolCalls(transformed);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ name: "read" });
		expect(transformed.filter(m => m.role === "toolResult")).toHaveLength(1);
	});

	it("is idempotent on an already-sanitized history", () => {
		const messages: Message[] = [
			{ role: "user", content: "go", timestamp: 1 },
			assistant(
				[
					{ type: "text", text: "ok" },
					{ type: "toolCall", id: "call_empty", name: "", arguments: {} },
				],
				2,
			),
			{
				role: "toolResult",
				toolCallId: "call_empty",
				toolName: "",
				content: [{ type: "text", text: "Tool  not found" }],
				isError: true,
				timestamp: 3,
			},
		];

		const once = transformMessages(messages, model);
		const twice = transformMessages(once, model);
		expect(twice).toEqual(once);
	});

	it("drops two malformed calls in one assistant turn while keeping a valid sibling", () => {
		const messages: Message[] = [
			{ role: "user", content: "do three things", timestamp: 1 },
			assistant(
				[
					{ type: "toolCall", id: "call_a", name: "", arguments: {} },
					{ type: "toolCall", id: "call_b", name: "read", arguments: { path: "foo" } },
					{ type: "toolCall", id: "call_c", name: "", arguments: {} },
				],
				2,
			),
			{
				role: "toolResult",
				toolCallId: "call_a",
				toolName: "",
				content: [{ type: "text", text: "Tool  not found" }],
				isError: true,
				timestamp: 3,
			},
			toolResult("call_b", "file contents", 4),
			{
				role: "toolResult",
				toolCallId: "call_c",
				toolName: "",
				content: [{ type: "text", text: "Tool  not found" }],
				isError: true,
				timestamp: 5,
			},
		];

		const transformed = transformMessages(messages, model);
		const calls = getToolCalls(transformed);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ name: "read" });

		const toolResults = transformed.filter((m): m is ToolResultMessage => m.role === "toolResult");
		expect(toolResults).toHaveLength(1);
		expect(toolResults[0]!.toolCallId).toBe("call_b");
	});

	it("does not let a missing malformed-result consume a later valid call with the same id", () => {
		const sharedId = "toolu_reused";
		const messages: Message[] = [
			{ role: "user", content: "first read", timestamp: 1 },
			assistant([{ type: "toolCall", id: sharedId, name: "", arguments: {} }], 2),
			// No `Tool  not found` result arrived for the malformed call before the
			// conversation moved on. That stale malformed occurrence must not drop
			// the next valid call's real output when the id is reused.
			{ role: "user", content: "second read", timestamp: 3 },
			assistant([{ type: "toolCall", id: sharedId, name: "read", arguments: { path: "foo" } }], 4),
			toolResult(sharedId, "real file contents", 5),
		];

		const transformed = transformMessages(messages, model);

		const survivingCalls = getToolCalls(transformed);
		expect(survivingCalls).toHaveLength(1);
		expect(survivingCalls[0]).toMatchObject({ name: "read" });

		const toolResults = transformed.filter((m): m is ToolResultMessage => m.role === "toolResult");
		expect(toolResults).toHaveLength(1);
		expect(toolResults[0]!.content).toEqual([{ type: "text", text: "real file contents" }]);
		expect(toolResults[0]!.toolName).toBe("read");
	});
});
