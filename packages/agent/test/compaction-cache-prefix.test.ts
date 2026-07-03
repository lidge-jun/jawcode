import { afterEach, describe, expect, test, vi } from "bun:test";
import type { AgentMessage, AgentTool } from "@jawcode-dev/agent-core";
import {
	compactionBoundaryMatches,
	generateSummary,
	type SummaryOptions,
	summaryModelKey,
} from "@jawcode-dev/agent-core/compaction";
import type { AssistantMessage, Model } from "@jawcode-dev/ai";
import * as ai from "@jawcode-dev/ai";
import { getBundledModel } from "@jawcode-dev/ai/models";

function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
		provider: "mock",
		model: "mock",
		api: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
	};
}

function getAnthropicModel(): Model {
	const model = getBundledModel("anthropic", "claude-sonnet-4-5");
	if (!model) throw new Error("Expected built-in anthropic model to exist");
	return model;
}

function createCachePrefix(model: Model, messages: AgentMessage[]): NonNullable<SummaryOptions["cachePrefix"]> {
	return {
		modelKey: summaryModelKey(model),
		systemPrompt: ["Live system prompt"],
		tools: [] as AgentTool[],
		messages,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("generateSummary cache prefix", () => {
	test("replays the live prefix with tool use disabled when the model matches", async () => {
		const completeSimpleSpy = vi
			.spyOn(ai, "completeSimple")
			.mockResolvedValue(createAssistantMessage("History summary"));
		const model = getAnthropicModel();
		const headMessages: AgentMessage[] = [
			{ role: "user", content: "start work", timestamp: 1 },
			createAssistantMessage("started"),
		];
		const cachePrefix = createCachePrefix(model, headMessages);

		const summary = await generateSummary(
			[{ role: "user", content: "serialized fallback input", timestamp: 2 }],
			model,
			16384,
			"test-key",
			undefined,
			undefined,
			"previous checkpoint summary",
			{ cachePrefix },
		);

		expect(summary).toBe("History summary");
		expect(completeSimpleSpy).toHaveBeenCalledTimes(1);
		const call = completeSimpleSpy.mock.calls[0];
		if (!call) throw new Error("Expected completeSimple call");
		const [calledModel, context, options] = call;
		expect(calledModel).toBe(model);
		expect(context.systemPrompt).toBe(cachePrefix.systemPrompt);
		expect(context.tools).toBe(cachePrefix.tools);
		expect(context.messages[0]).toMatchObject({ role: "user", content: "start work" });
		expect(options).toMatchObject({ apiKey: "test-key", toolChoice: "none" });

		const lastMessage = context.messages[context.messages.length - 1];
		if (lastMessage?.role !== "user" || !Array.isArray(lastMessage.content)) {
			throw new Error("Expected trailing user instruction message");
		}
		expect(lastMessage.attribution).toBe("agent");
		const promptBlock = lastMessage.content[0];
		if (promptBlock?.type !== "text") throw new Error("Expected text prompt block");
		// Continuation guard moved from the summarization system prompt.
		expect(promptBlock.text).toContain("Do NOT continue the conversation");
		// Update-prompt selection and previous-summary block are preserved.
		expect(promptBlock.text).toContain("<previous-summary>");
		expect(promptBlock.text).toContain("previous checkpoint summary");
		// The history itself is the conversation — no serialized wrapper.
		expect(promptBlock.text).not.toContain("<conversation>");
	});

	test("falls back to the serialized path when the model key does not match", async () => {
		const completeSimpleSpy = vi
			.spyOn(ai, "completeSimple")
			.mockResolvedValue(createAssistantMessage("History summary"));
		const model = getAnthropicModel();
		const cachePrefix = {
			...createCachePrefix(model, [{ role: "user", content: "head", timestamp: 1 }]),
			modelKey: "someone|else|entirely|https://other.example",
		};

		await generateSummary(
			[{ role: "user", content: "serialized fallback input", timestamp: 2 }],
			model,
			16384,
			"test-key",
			undefined,
			undefined,
			undefined,
			{ cachePrefix },
		);

		const call = completeSimpleSpy.mock.calls[0];
		if (!call) throw new Error("Expected completeSimple call");
		const [, context, options] = call;
		expect(context.tools).toBeUndefined();
		expect(context.messages).toHaveLength(1);
		const only = context.messages[0];
		if (only?.role !== "user" || !Array.isArray(only.content) || only.content[0]?.type !== "text") {
			throw new Error("Expected single serialized prompt message");
		}
		expect(only.content[0].text).toContain("<conversation>");
		expect(options?.toolChoice).toBeUndefined();
	});
});

describe("summaryModelKey", () => {
	test("includes the endpoint in the identity", () => {
		const model = getAnthropicModel();
		expect(summaryModelKey(model)).toBe(`${model.provider}|${model.api}|${model.id}|${model.baseUrl ?? ""}`);
		expect(summaryModelKey({ ...model, baseUrl: "https://proxy.example" } as Model)).not.toBe(summaryModelKey(model));
	});
});

describe("compactionBoundaryMatches", () => {
	const timestamp = 1_700_000_000_000;

	test("ordinary roles require reference equality", () => {
		const message: AgentMessage = { role: "user", content: "hello", timestamp };
		expect(compactionBoundaryMatches(message, message)).toBe(true);
		expect(compactionBoundaryMatches({ role: "user", content: "hello", timestamp }, message)).toBe(false);
	});

	test("synthesized custom messages match on type and content identity", () => {
		const boundary: AgentMessage = {
			role: "custom",
			customType: "hook",
			content: "injected",
			display: false,
			timestamp,
		} as AgentMessage;
		const rebuiltTwin: AgentMessage = {
			role: "custom",
			customType: "hook",
			content: "injected",
			display: false,
			timestamp,
		} as AgentMessage;
		const differentContent: AgentMessage = {
			role: "custom",
			customType: "hook",
			content: "different payload",
			display: false,
			timestamp,
		} as AgentMessage;
		expect(compactionBoundaryMatches(rebuiltTwin, boundary)).toBe(true);
		expect(compactionBoundaryMatches(differentContent, boundary)).toBe(false);
	});

	test("branch summaries match on fromId and summary", () => {
		const boundary: AgentMessage = { role: "branchSummary", summary: "s", fromId: "a", timestamp } as AgentMessage;
		const twin: AgentMessage = { role: "branchSummary", summary: "s", fromId: "a", timestamp } as AgentMessage;
		const other: AgentMessage = { role: "branchSummary", summary: "s", fromId: "b", timestamp } as AgentMessage;
		expect(compactionBoundaryMatches(twin, boundary)).toBe(true);
		expect(compactionBoundaryMatches(other, boundary)).toBe(false);
	});

	test("timestamp mismatch never matches", () => {
		const boundary: AgentMessage = {
			role: "custom",
			customType: "hook",
			content: "injected",
			display: false,
			timestamp,
		} as AgentMessage;
		const shifted: AgentMessage = {
			role: "custom",
			customType: "hook",
			content: "injected",
			display: false,
			timestamp: timestamp + 1,
		} as AgentMessage;
		expect(compactionBoundaryMatches(shifted, boundary)).toBe(false);
	});
});
