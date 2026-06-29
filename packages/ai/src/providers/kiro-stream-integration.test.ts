import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AssistantMessage, Context, Model, ToolCall } from "../types";
import { crc32 } from "./aws-eventstream";
import { streamKiro } from "./kiro";

// Minimal AWS eventstream encoder for tests: a single ":message-type" = "event" string header plus a
// JSON payload, framed exactly the way decodeMessage() expects (prelude + header block + payload +
// CRCs). This lets us drive streamKiro end-to-end through a mocked fetch.
function encodeEventFrame(payloadObj: unknown): Uint8Array {
	const enc = new TextEncoder();
	const name = ":message-type";
	const value = "event";
	const nameBytes = enc.encode(name);
	const valueBytes = enc.encode(value);
	// header: [nameLen u8][name][type=7 u8][valueLen u16][value]
	const header = new Uint8Array(1 + nameBytes.length + 1 + 2 + valueBytes.length);
	const hv = new DataView(header.buffer);
	let hp = 0;
	hv.setUint8(hp, nameBytes.length);
	hp += 1;
	header.set(nameBytes, hp);
	hp += nameBytes.length;
	hv.setUint8(hp, 7);
	hp += 1;
	hv.setUint16(hp, valueBytes.length, false);
	hp += 2;
	header.set(valueBytes, hp);
	hp += valueBytes.length;

	const payload = enc.encode(JSON.stringify(payloadObj));
	const total = 4 + 4 + 4 + header.length + payload.length + 4;
	const frame = new Uint8Array(total);
	const dv = new DataView(frame.buffer);
	dv.setUint32(0, total, false);
	dv.setUint32(4, header.length, false);
	dv.setUint32(8, crc32(frame.subarray(0, 8)), false);
	frame.set(header, 12);
	frame.set(payload, 12 + header.length);
	dv.setUint32(total - 4, crc32(frame.subarray(0, total - 4)), false);
	return frame;
}

function streamResponse(frames: Uint8Array[]): Response {
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const f of frames) controller.enqueue(f);
			controller.close();
		},
	});
	return new Response(body, { status: 200 });
}

const model = {
	id: "claude-sonnet-4.5",
	provider: "kiro",
	api: "kiro-streaming",
	input: ["text", "image"],
	reasoning: false,
} as unknown as Model<"kiro-streaming">;

const ctx: Context = { messages: [{ role: "user", content: "hi", timestamp: 0 }] };

async function collectToolCalls(frames: Uint8Array[]): Promise<ToolCall[]> {
	const stream = streamKiro(model, ctx, { accessToken: "tok", profileArn: "arn", region: "us-east-1" });
	let final: AssistantMessage | undefined;
	for await (const ev of stream) {
		if (ev.type === "done") final = ev.message;
		else if (ev.type === "error") final = ev.error;
	}
	return (final?.content ?? []).filter(b => b.type === "toolCall") as ToolCall[];
}

const origFetch = globalThis.fetch;
let queuedFrames: Uint8Array[] = [];

beforeEach(() => {
	globalThis.fetch = (async () => streamResponse(queuedFrames)) as unknown as typeof fetch;
});
afterEach(() => {
	globalThis.fetch = origFetch;
	queuedFrames = [];
});

describe("streamKiro — tool call stream robustness", () => {
	test("a normal start/input/stop sequence yields one complete tool call", async () => {
		queuedFrames = [
			encodeEventFrame({ name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ input: '{"command":"ec', name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ input: 'ho hi"}', name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ name: "bash", stop: true, toolUseId: "t1" }),
		];
		const calls = await collectToolCalls(queuedFrames);
		expect(calls).toHaveLength(1);
		expect(calls[0].name).toBe("bash");
		expect(calls[0].arguments).toEqual({ command: "echo hi" });
	});

	test("a second tool starting before the first stops does not drop the first", async () => {
		queuedFrames = [
			encodeEventFrame({ name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ input: '{"command":"a"}', name: "bash", toolUseId: "t1" }),
			// No stop for t1 — t2 starts. The first must still be finalized, not overwritten.
			encodeEventFrame({ name: "grep", toolUseId: "t2" }),
			encodeEventFrame({ input: '{"pattern":"b"}', name: "grep", toolUseId: "t2" }),
			encodeEventFrame({ name: "grep", stop: true, toolUseId: "t2" }),
		];
		const calls = await collectToolCalls(queuedFrames);
		expect(calls.map(c => c.name)).toEqual(["bash", "grep"]);
		expect(calls[0].arguments).toEqual({ command: "a" });
		expect(calls[1].arguments).toEqual({ pattern: "b" });
	});

	test("input for a different toolUseId is not merged into the open tool", async () => {
		queuedFrames = [
			encodeEventFrame({ name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ input: '{"command":"a"}', name: "bash", toolUseId: "t1" }),
			// Input arrives for a different tool id without its own start.
			encodeEventFrame({ input: '{"pattern":"b"}', name: "grep", toolUseId: "t2" }),
			encodeEventFrame({ name: "grep", stop: true, toolUseId: "t2" }),
		];
		const calls = await collectToolCalls(queuedFrames);
		expect(calls.map(c => c.name)).toEqual(["bash", "grep"]);
		expect(calls[0].arguments).toEqual({ command: "a" });
		expect(calls[1].arguments).toEqual({ pattern: "b" });
	});

	test("a tool left open at end-of-stream is still finalized", async () => {
		queuedFrames = [
			encodeEventFrame({ name: "bash", toolUseId: "t1" }),
			encodeEventFrame({ input: '{"command":"x"}', name: "bash", toolUseId: "t1" }),
			// stream ends with no stop frame
		];
		const calls = await collectToolCalls(queuedFrames);
		expect(calls).toHaveLength(1);
		expect(calls[0].arguments).toEqual({ command: "x" });
	});
});
