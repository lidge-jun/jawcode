import { describe, expect, it, vi } from "bun:test";
import { getBundledModel } from "../src/models";
import { streamOpenAIResponses } from "../src/providers/openai-responses";
import type { AssistantMessageEvent, Context, FetchImpl, Model } from "../src/types";

const model = getBundledModel("openai", "gpt-5-mini") as Model<"openai-responses">;
const context: Context = {
	messages: [{ role: "user", content: "Use the tool", timestamp: 1_000 }],
};

function createSseResponse(events: unknown[]): Response {
	return new Response(`${events.map(event => `data: ${JSON.stringify(event)}`).join("\n\n")}\n\n`, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

function completedToolResponse(): Response {
	return createSseResponse([
		{
			type: "response.output_item.added",
			output_index: 0,
			item: {
				type: "function_call",
				id: "fc_recovered",
				call_id: "call_recovered",
				name: "read",
				arguments: "",
				status: "in_progress",
			},
		},
		{
			type: "response.output_item.done",
			output_index: 0,
			item: {
				type: "function_call",
				id: "fc_recovered",
				call_id: "call_recovered",
				name: "read",
				arguments: '{"path":"README.md"}',
				status: "completed",
			},
		},
		{ type: "response.completed", response: { id: "resp_recovered", status: "completed" } },
	]);
}

function delayedResponse(response: Response, delayMs: number): Response {
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			await Bun.sleep(delayMs);
			controller.enqueue(new Uint8Array(await response.arrayBuffer()));
			controller.close();
		},
	});
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function collectEvents(fetch: FetchImpl): Promise<{ events: AssistantMessageEvent[]; resultTypes: string[] }> {
	const responseStream = streamOpenAIResponses(model, context, {
		apiKey: "test-key",
		fetch,
		providerRetryWait: async () => {},
	});
	const events: AssistantMessageEvent[] = [];
	for await (const event of responseStream) events.push(event);
	const result = await responseStream.result();
	return { events, resultTypes: result.content.map(block => block.type) };
}

describe("OpenAI Responses stream robustness", () => {
	it("keeps an explicit zero first-event timeout disabled", async () => {
		const fetchMock = vi.fn(async () => delayedResponse(completedToolResponse(), 20)) as FetchImpl;

		const result = await streamOpenAIResponses(model, context, {
			apiKey: "test-key",
			fetch: fetchMock,
			streamFirstEventTimeoutMs: 0,
			streamIdleTimeoutMs: 100,
		}).result();

		expect(result.stopReason).toBe("toolUse");
	});

	it("keeps a compat zero first-event timeout disabled", async () => {
		const compatModel = {
			...model,
			compat: { ...model.compat, streamFirstEventTimeoutMs: 0 },
		} as Model<"openai-responses">;
		const fetchMock = vi.fn(async () => delayedResponse(completedToolResponse(), 20)) as FetchImpl;

		const result = await streamOpenAIResponses(compatModel, context, {
			apiKey: "test-key",
			fetch: fetchMock,
			streamIdleTimeoutMs: 100,
		}).result();

		expect(result.stopReason).toBe("toolUse");
	});

	it("projects terminal-only signed reasoning before its tool call", async () => {
		const reasoning = {
			type: "reasoning",
			id: "rs_signed",
			summary: [],
			encrypted_content: "signed-payload",
			status: "completed",
		};
		const fetchMock = vi.fn(async () =>
			createSseResponse([
				{ type: "response.output_item.done", output_index: 0, item: reasoning },
				{
					type: "response.output_item.added",
					output_index: 1,
					item: {
						type: "function_call",
						id: "fc_signed",
						call_id: "call_signed",
						name: "lookup",
						arguments: "{}",
						status: "in_progress",
					},
				},
				{
					type: "response.output_item.done",
					output_index: 1,
					item: {
						type: "function_call",
						id: "fc_signed",
						call_id: "call_signed",
						name: "lookup",
						arguments: "{}",
						status: "completed",
					},
				},
				{ type: "response.completed", response: { id: "resp_signed", status: "completed" } },
			]),
		) as FetchImpl;

		const { events, resultTypes } = await collectEvents(fetchMock);

		expect(resultTypes).toEqual(["thinking", "toolCall"]);
		expect(events.map(event => event.type)).toEqual([
			"start",
			"thinking_start",
			"thinking_end",
			"toolcall_start",
			"toolcall_end",
			"done",
		]);
	});

	it("retries once when a stream truncates before replay-unsafe output", async () => {
		let attempt = 0;
		const fetchMock = vi.fn(async () => {
			attempt++;
			if (attempt === 1) {
				return createSseResponse([
					{
						type: "response.output_item.added",
						output_index: 0,
						item: {
							type: "function_call",
							id: "fc_partial",
							call_id: "call_partial",
							name: "read",
							arguments: "",
							status: "in_progress",
						},
					},
				]);
			}
			return completedToolResponse();
		}) as FetchImpl;

		const { events, resultTypes } = await collectEvents(fetchMock);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(resultTypes).toEqual(["toolCall"]);
		expect(events.filter(event => event.type === "toolcall_start")).toHaveLength(1);
	});

	it("does not retry after a non-empty tool argument delta", async () => {
		const fetchMock = vi.fn(async () =>
			createSseResponse([
				{
					type: "response.output_item.added",
					output_index: 0,
					item: {
						type: "function_call",
						id: "fc_partial",
						call_id: "call_partial",
						name: "read",
						arguments: "",
						status: "in_progress",
					},
				},
				{
					type: "response.function_call_arguments.delta",
					output_index: 0,
					item_id: "fc_partial",
					delta: '{"path":"README.md"}',
				},
			]),
		) as FetchImpl;

		const responseStream = streamOpenAIResponses(model, context, {
			apiKey: "test-key",
			fetch: fetchMock,
			providerRetryWait: async () => {},
		});
		const result = await responseStream.result();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.stopReason).toBe("error");
	});

	it("does not retry a terminal provider failure", async () => {
		const fetchMock = vi.fn(async () =>
			createSseResponse([
				{
					type: "response.failed",
					response: {
						id: "resp_failed",
						status: "failed",
						error: { code: "invalid_request_error", message: "Tool schema is invalid" },
					},
				},
			]),
		) as FetchImpl;

		const result = await streamOpenAIResponses(model, context, {
			apiKey: "test-key",
			fetch: fetchMock,
			providerRetryWait: async () => {},
		}).result();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.stopReason).toBe("error");
	});
});
