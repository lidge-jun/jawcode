import { afterEach, describe, expect, it, vi } from "bun:test";
import { getBundledModel } from "../src/models";
import { streamOpenAIResponses } from "../src/providers/openai-responses";
import type { Context, Model } from "../src/types";

const originalFetch = global.fetch;

// Canonical api.openai.com model (official endpoint).
const officialModel = getBundledModel("openai", "gpt-4o-mini") as Model<"openai-responses">;
// Same provider but routed through a non-official OpenAI-compatible proxy.
const proxyModel = {
	...officialModel,
	baseUrl: "https://my-proxy.example.com/v1",
} as Model<"openai-responses">;

function createSseResponse(): Response {
	const events = [
		{
			type: "response.output_item.added",
			item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
		},
		{ type: "response.content_part.added", part: { type: "output_text", text: "" } },
		{ type: "response.output_text.delta", delta: "Hi" },
		{
			type: "response.output_item.done",
			item: {
				type: "message",
				id: "msg_1",
				role: "assistant",
				status: "completed",
				content: [{ type: "output_text", text: "Hi" }],
			},
		},
		{
			type: "response.completed",
			response: {
				status: "completed",
				usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4, input_tokens_details: { cached_tokens: 0 } },
			},
		},
	];
	const payload = `${events.map(e => `data: ${JSON.stringify(e)}`).join("\n\n")}\n\n`;
	return new Response(payload, { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function captureRequestBody(
	model: Model<"openai-responses">,
	textVerbosity: "low" | "medium" | "high" | undefined,
): Promise<Record<string, unknown>> {
	let captured: Record<string, unknown> = {};
	const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
		captured = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
		return createSseResponse();
	});
	global.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect }) as typeof fetch;

	const context: Context = {
		messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
	};
	const stream = streamOpenAIResponses(model, context, { apiKey: "test-key", textVerbosity });
	for await (const event of stream) {
		if (event.type === "done" || event.type === "error") break;
	}
	return captured;
}

afterEach(() => {
	global.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe("openai-responses text.verbosity", () => {
	it("maps textVerbosity to text.verbosity on the official endpoint", async () => {
		const body = await captureRequestBody(officialModel, "high");
		expect((body.text as { verbosity?: string } | undefined)?.verbosity).toBe("high");
	});

	it("omits text.verbosity when no textVerbosity is requested", async () => {
		const body = await captureRequestBody(officialModel, undefined);
		expect((body.text as { verbosity?: string } | undefined)?.verbosity).toBeUndefined();
	});

	it("does not send text.verbosity to a non-official proxy base URL", async () => {
		const body = await captureRequestBody(proxyModel, "low");
		expect((body.text as { verbosity?: string } | undefined)?.verbosity).toBeUndefined();
	});
});
