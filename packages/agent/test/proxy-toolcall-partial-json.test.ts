/**
 * Tests for proxy stream tool-call parsing + partialJson leakage.
 *
 * Contract:
 * - `streamProxy` parses streaming tool-call arguments from `toolcall_delta`.
 * - The internal `partialJson` field is present ON the block DURING streaming
 *   (renderers read it to preview tool args before the JSON object closes), but
 *   it MUST NOT survive into the finalized `AssistantMessage` content — even
 *   when the stream ends without a `toolcall_end` (abort/error).
 */
import { afterEach, describe, expect, it } from "bun:test";
import type { AssistantMessage, AssistantMessageEvent, Context, Model, ToolCall } from "@jawcode-dev/ai";
import type { ProxyAssistantMessageEvent } from "../src/proxy";
import { streamProxy } from "../src/proxy";

const mockModel: Model = {
	id: "test-model",
	name: "Test Model",
	api: "openai-completions",
	provider: "test",
	baseUrl: "http://localhost:0",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 4096,
	maxTokens: 1024,
} as unknown as Model;

const mockContext: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
} as unknown as Context;

const baseUsage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function mockFetchWith(events: ProxyAssistantMessageEvent[]): void {
	const text = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join("");
	globalThis.fetch = (async () =>
		new Response(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(text));
					controller.close();
				},
			}),
			{ status: 200, headers: { "Content-Type": "text/event-stream" } },
		)) as unknown as typeof fetch;
}

async function collect(
	events: ProxyAssistantMessageEvent[],
): Promise<{ all: AssistantMessageEvent[]; final: AssistantMessage }> {
	mockFetchWith(events);
	const stream = streamProxy(mockModel, mockContext, {
		authToken: "t",
		proxyUrl: "http://localhost:0",
	});
	const all: AssistantMessageEvent[] = [];
	for await (const ev of stream) all.push(ev);
	const final = await stream.result();
	return { all, final };
}

function finalToolCall(msg: AssistantMessage): ToolCall {
	const tc = msg.content.find((c): c is ToolCall => c.type === "toolCall");
	expect(tc).toBeDefined();
	return tc!;
}

describe("streamProxy — tool-call streaming and partialJson isolation", () => {
	it("parses complete tool-call arguments from streamed deltas", async () => {
		const { final } = await collect([
			{ type: "start" },
			{ type: "toolcall_start", contentIndex: 0, id: "call_1", toolName: "bash" },
			{ type: "toolcall_delta", contentIndex: 0, delta: '{"comm' },
			{ type: "toolcall_delta", contentIndex: 0, delta: 'and":"ls"}' },
			{ type: "toolcall_end", contentIndex: 0 },
			{ type: "done", reason: "toolUse", usage: { ...baseUsage } },
		]);
		const tc = finalToolCall(final);
		expect(tc.arguments).toEqual({ command: "ls" });
	});

	it("does not leak partialJson into the final block on normal completion", async () => {
		const { final } = await collect([
			{ type: "start" },
			{ type: "toolcall_start", contentIndex: 0, id: "call_1", toolName: "bash" },
			{ type: "toolcall_delta", contentIndex: 0, delta: '{"command":"ls"}' },
			{ type: "toolcall_end", contentIndex: 0 },
			{ type: "done", reason: "toolUse", usage: { ...baseUsage } },
		]);
		const tc = finalToolCall(final);
		expect("partialJson" in tc).toBe(false);
	});

	it("scrubs partialJson when the stream ends without toolcall_end (error)", async () => {
		const { final } = await collect([
			{ type: "start" },
			{ type: "toolcall_start", contentIndex: 0, id: "call_1", toolName: "bash" },
			{ type: "toolcall_delta", contentIndex: 0, delta: '{"command":"sle' },
			{ type: "error", reason: "error", errorMessage: "boom", usage: { ...baseUsage } },
		]);
		// stopReason is error and the in-progress tool-call block must be clean.
		expect(final.stopReason).toBe("error");
		const tc = final.content.find((c): c is ToolCall => c.type === "toolCall");
		if (tc) {
			expect("partialJson" in tc).toBe(false);
		}
	});

	it("exposes partialJson on the block DURING streaming (consumer contract)", async () => {
		mockFetchWith([
			{ type: "start" },
			{ type: "toolcall_start", contentIndex: 0, id: "call_1", toolName: "bash" },
			{ type: "toolcall_delta", contentIndex: 0, delta: '{"command":"l' },
			{ type: "toolcall_delta", contentIndex: 0, delta: 's"}' },
			{ type: "toolcall_end", contentIndex: 0 },
			{ type: "done", reason: "toolUse", usage: { ...baseUsage } },
		]);
		const stream = streamProxy(mockModel, mockContext, { authToken: "t", proxyUrl: "http://localhost:0" });
		let sawPartialDuringStreaming = false;
		for await (const ev of stream) {
			if (ev.type === "toolcall_delta") {
				const block = ev.partial.content[ev.contentIndex];
				if (block?.type === "toolCall" && "partialJson" in block) {
					sawPartialDuringStreaming = true;
				}
			}
		}
		await stream.result();
		expect(sawPartialDuringStreaming).toBe(true);
	});

	it("isolates partialJson across multiple concurrent tool calls", async () => {
		const { final } = await collect([
			{ type: "start" },
			{ type: "toolcall_start", contentIndex: 0, id: "call_1", toolName: "bash" },
			{ type: "toolcall_start", contentIndex: 1, id: "call_2", toolName: "read" },
			{ type: "toolcall_delta", contentIndex: 0, delta: '{"command":' },
			{ type: "toolcall_delta", contentIndex: 1, delta: '{"path":"a"}' },
			{ type: "toolcall_delta", contentIndex: 0, delta: '"ls"}' },
			{ type: "toolcall_end", contentIndex: 0 },
			{ type: "toolcall_end", contentIndex: 1 },
			{ type: "done", reason: "toolUse", usage: { ...baseUsage } },
		]);
		const calls = final.content.filter((c): c is ToolCall => c.type === "toolCall");
		expect(calls).toHaveLength(2);
		expect(calls[0]!.arguments).toEqual({ command: "ls" });
		expect(calls[1]!.arguments).toEqual({ path: "a" });
		for (const c of calls) expect("partialJson" in c).toBe(false);
	});
});
