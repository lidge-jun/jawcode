import { describe, expect, test } from "bun:test";
import { getBundledModel } from "@jawcode-dev/ai/models";
import { type OpenAIResponsesOptions, streamOpenAIResponses } from "@jawcode-dev/ai/providers/openai-responses";
import type { AssistantMessage, Context, Model, Provider, Tool } from "@jawcode-dev/ai/types";
import { createOpenAIResponsesHistoryPayload } from "@jawcode-dev/ai/utils";
import * as z from "zod/v4";

const PATCH_INPUT = "*** Begin Patch\n*** End Patch\n";
const editTool: Tool = {
	name: "edit",
	customWireName: "apply_patch",
	description: "Edit files",
	parameters: z.object({ input: z.string() }),
	customFormat: { syntax: "lark", definition: 'start: "*** Begin Patch"' },
};

function createAbortedSignal(): AbortSignal {
	const controller = new AbortController();
	controller.abort();
	return controller.signal;
}

function capturePayload(
	model: Model<"openai-responses">,
	context: Context,
	options?: Omit<OpenAIResponsesOptions, "apiKey" | "signal" | "onPayload">,
): Promise<Record<string, unknown>> {
	const { promise, resolve } = Promise.withResolvers<Record<string, unknown>>();
	streamOpenAIResponses(model, context, {
		apiKey: "test-key",
		signal: createAbortedSignal(),
		...options,
		onPayload: payload => resolve(payload as unknown as Record<string, unknown>),
	});
	return promise;
}

function getXaiResponsesCompatModel(): Model<"openai-responses"> {
	const catalogModel = getBundledModel("xai", "grok-4.5");
	if (!catalogModel) throw new Error("xai/grok-4.5 must exist in the generated catalog");
	return { ...catalogModel, api: "openai-responses" } as Model<"openai-responses">;
}

function replayContext(provider: Provider, model: string): Context {
	const historyItems = [
		{
			type: "message",
			role: "user",
			content: [
				{ type: "input_text", text: "previous frame" },
				{ type: "input_image", detail: "original", image_url: "data:image/png;base64,ZmFrZQ==" },
			],
		},
		{ type: "custom_tool_call", call_id: "call_apply", name: "apply_patch", input: PATCH_INPUT },
		{ type: "custom_tool_call_output", call_id: "call_apply", output: "Done" },
	];
	const assistant: AssistantMessage = {
		role: "assistant",
		content: [{ type: "text", text: "fallback should not be replayed" }],
		api: "openai-responses",
		provider,
		model,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		providerPayload: createOpenAIResponsesHistoryPayload(provider, historyItems, false),
		timestamp: Date.now(),
	};
	return {
		messages: [assistant, { role: "user", content: "continue", timestamp: Date.now() }],
		tools: [editTool],
	};
}

function findInputItem(input: unknown, type: string): Record<string, unknown> | undefined {
	if (!Array.isArray(input)) return undefined;
	return input.find(item => item && typeof item === "object" && (item as { type?: unknown }).type === type) as
		| Record<string, unknown>
		| undefined;
}

function collectImageDetails(input: unknown): unknown[] {
	if (!Array.isArray(input)) return [];
	return input.flatMap(item => {
		if (!item || typeof item !== "object") return [];
		const record = item as { type?: unknown; detail?: unknown; content?: unknown };
		if (record.type === "input_image") return [record.detail];
		if (!Array.isArray(record.content)) return [];
		return record.content.flatMap(part =>
			part && typeof part === "object" && (part as { type?: unknown }).type === "input_image"
				? [(part as { detail?: unknown }).detail]
				: [],
		);
	});
}

describe("xAI Responses catalog compatibility", () => {
	test("reshapes replay only when catalog capabilities reject OpenAI-native items", async () => {
		const xaiModel = getXaiResponsesCompatModel();
		expect(xaiModel.compat).toMatchObject({
			supportsImageDetailOriginal: false,
			supportsReasoningSummary: false,
			includeEncryptedReasoning: false,
		});
		const xaiPayload = await capturePayload(xaiModel, replayContext("xai", xaiModel.id));

		expect(findInputItem(xaiPayload.input, "custom_tool_call")).toBeUndefined();
		expect(findInputItem(xaiPayload.input, "custom_tool_call_output")).toBeUndefined();
		expect(findInputItem(xaiPayload.input, "function_call")).toEqual({
			type: "function_call",
			call_id: "call_apply",
			name: "edit",
			arguments: JSON.stringify({ input: PATCH_INPUT }),
		});
		expect(findInputItem(xaiPayload.input, "function_call_output")).toEqual({
			type: "function_call_output",
			call_id: "call_apply",
			output: "Done",
		});
		expect(collectImageDetails(xaiPayload.input)).toEqual(["auto"]);

		const openaiModel = getBundledModel("openai", "gpt-5-mini") as Model<"openai-responses">;
		expect(openaiModel.applyPatchToolType).toBe("freeform");
		const openaiPayload = await capturePayload(openaiModel, replayContext("openai", openaiModel.id));
		expect(findInputItem(openaiPayload.input, "custom_tool_call")).toMatchObject({
			type: "custom_tool_call",
			call_id: "call_apply",
			name: "apply_patch",
			input: PATCH_INPUT,
		});
		expect(findInputItem(openaiPayload.input, "custom_tool_call_output")).toMatchObject({
			type: "custom_tool_call_output",
			call_id: "call_apply",
			output: "Done",
		});
		expect(collectImageDetails(openaiPayload.input)).toEqual(["original"]);
	});

	test("preserves xAI default reasoning and strips unsupported summary fields", async () => {
		const context: Context = { messages: [{ role: "user", content: "hello", timestamp: Date.now() }] };
		const xaiModel = getXaiResponsesCompatModel();
		const defaultPayload = await capturePayload(xaiModel, context);
		expect(defaultPayload.reasoning).toBeUndefined();
		expect(defaultPayload.include).toBeUndefined();

		const explicitPayload = await capturePayload(xaiModel, context, {
			reasoning: "high",
			reasoningSummary: "auto",
		});
		expect(explicitPayload.reasoning).toEqual({ effort: "high" });
		expect(explicitPayload.include).toBeUndefined();

		const openaiModel = getBundledModel("openai", "gpt-5-mini") as Model<"openai-responses">;
		const openaiPayload = await capturePayload(openaiModel, context, {
			reasoning: "high",
			reasoningSummary: "auto",
		});
		expect(openaiPayload.reasoning).toEqual({ effort: "high", summary: "auto" });
		expect(openaiPayload.include).toEqual(["reasoning.encrypted_content"]);
	});
});
