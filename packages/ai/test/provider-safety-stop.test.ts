import { describe, expect, it } from "bun:test";
import { streamGoogleGeminiCli } from "../src/providers/google-gemini-cli";
import { streamGoogleGenAI } from "../src/providers/google-shared";
import { streamOpenAICompletions } from "../src/providers/openai-completions";
import type { Context, Model } from "../src/types";

const context: Context = {
	messages: [{ role: "user", content: "hi", timestamp: 0 }],
	tools: [],
};

function createSseResponse(events: unknown[]): Response {
	const body = `${events
		.map(event => `data: ${typeof event === "string" ? event : JSON.stringify(event)}`)
		.join("\n\n")}\n\n`;
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const googleModel: Model<"google-generative-ai"> = {
	id: "gemini-test",
	name: "Gemini Test",
	api: "google-generative-ai",
	provider: "google",
	baseUrl: "https://google.example.test",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 8_192,
	maxTokens: 1_024,
};

const geminiCliModel: Model<"google-gemini-cli"> = {
	...googleModel,
	api: "google-gemini-cli",
	provider: "google-gemini-cli",
};

const openAIModel: Model<"openai-completions"> = {
	id: "openai-test",
	name: "OpenAI Test",
	api: "openai-completions",
	provider: "openai",
	baseUrl: "https://openai.example.test/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 8_192,
	maxTokens: 1_024,
};

describe("typed provider safety stops", () => {
	it("classifies Google candidate and prompt safety fields and keeps them sticky", async () => {
		const stream = streamGoogleGenAI({
			model: googleModel,
			api: "google-generative-ai",
			options: undefined,
			prepare: () => ({
				params: { model: googleModel.id, contents: [] },
				url: "https://google.example.test/stream",
				headers: {},
				fetch: async () =>
					createSseResponse([
						{ promptFeedback: { blockReason: "SAFETY" } },
						{ candidates: [{ finishReason: "STOP" }] },
					]),
			}),
		});

		const result = await stream.result();
		expect(result.errorKind).toBe("provider_safety_stop");
		expect(result.stopReason).toBe("error");
	});

	it("classifies Gemini CLI prompt safety fields without empty-response retries", async () => {
		let requestCount = 0;
		const stream = streamGoogleGeminiCli(geminiCliModel, context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: async () => {
				requestCount++;
				const response = createSseResponse([{ response: { promptFeedback: { blockReason: "JAILBREAK" } } }]);
				Object.defineProperty(response, "url", { value: "https://gemini-cli.example.test/stream" });
				return response;
			},
		});

		const result = await stream.result();
		expect(requestCount).toBe(1);
		expect(result.errorKind).toBe("provider_safety_stop");
		expect(result.stopReason).toBe("error");
	});

	it("classifies OpenAI content_filter finish reasons and ignores later benign finishes", async () => {
		const stream = streamOpenAICompletions(openAIModel, context, {
			apiKey: "test",
			fetch: async () =>
				createSseResponse([
					{
						id: "chatcmpl-test",
						object: "chat.completion.chunk",
						created: 0,
						model: openAIModel.id,
						choices: [{ index: 0, delta: {}, finish_reason: "content_filter" }],
					},
					{
						id: "chatcmpl-test",
						object: "chat.completion.chunk",
						created: 0,
						model: openAIModel.id,
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					},
					"[DONE]",
				]),
		});

		const result = await stream.result();
		expect(result.errorKind).toBe("provider_safety_stop");
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("Provider finish_reason: content_filter");
	});

	it("leaves non-safety provider errors untyped", async () => {
		const stream = streamOpenAICompletions(openAIModel, context, {
			apiKey: "test",
			fetch: async () =>
				new Response(
					JSON.stringify({
						error: { code: "invalid_request_error", message: "content_filter is not valid here" },
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				),
		});

		const result = await stream.result();
		expect(result.errorKind).toBeUndefined();
		expect(result.stopReason).toBe("error");
	});
});
