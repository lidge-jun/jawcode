import { afterEach, describe, expect, it } from "bun:test";
import * as http2 from "node:http2";
import { create, toBinary } from "@bufbuild/protobuf";
import { streamCursor } from "../src/providers/cursor";
import {
	AgentServerMessageSchema,
	InteractionUpdateSchema,
	TextDeltaUpdateSchema,
	TurnEndedUpdateSchema,
} from "../src/providers/cursor/gen/agent_pb";
import type { Context, Model } from "../src/types";

const CONNECT_END_STREAM_FLAG = 0b00000010;

type Scenario =
	| "clean-without-turn-ended"
	| "coalesced"
	| "fragmented"
	| "late-connect-error"
	| "late-normal-end"
	| "silent-after-turn-ended"
	| "trailers";

let server: http2.Http2Server | undefined;
const sessions = new Set<http2.Http2Session>();
let scenario: Scenario = "coalesced";
let destroyedSessionCount = 0;
let sessionDestroyed = Promise.withResolvers<void>();

function frameConnectMessage(data: Uint8Array, flags = 0): Buffer {
	const frame = Buffer.alloc(5 + data.length);
	frame[0] = flags;
	frame.writeUInt32BE(data.length, 1);
	frame.set(data, 5);
	return frame;
}

function textDeltaFrame(text: string): Buffer {
	const message = create(AgentServerMessageSchema, {
		message: {
			case: "interactionUpdate",
			value: create(InteractionUpdateSchema, {
				message: { case: "textDelta", value: create(TextDeltaUpdateSchema, { text }) },
			}),
		},
	});
	return frameConnectMessage(toBinary(AgentServerMessageSchema, message));
}

function turnEndedFrame(): Buffer {
	const message = create(AgentServerMessageSchema, {
		message: {
			case: "interactionUpdate",
			value: create(InteractionUpdateSchema, {
				message: { case: "turnEnded", value: create(TurnEndedUpdateSchema, {}) },
			}),
		},
	});
	return frameConnectMessage(toBinary(AgentServerMessageSchema, message));
}

function connectEndErrorFrame(): Buffer {
	return frameConnectMessage(
		Buffer.from(JSON.stringify({ error: { code: "unavailable", message: "post-turn failure" } })),
		CONNECT_END_STREAM_FLAG,
	);
}

async function startServer(): Promise<string> {
	sessionDestroyed = Promise.withResolvers<void>();
	server = http2.createServer();
	server.on("session", session => {
		sessions.add(session);
		session.on("close", () => {
			sessions.delete(session);
			destroyedSessionCount++;
			sessionDestroyed.resolve();
		});
	});
	server.on("stream", (stream, headers) => {
		stream.on("data", () => undefined);
		if (headers[":path"] !== "/agent.v1.AgentService/Run") {
			stream.respond({ ":status": 404 });
			stream.end();
			return;
		}

		const responseHeaders = { ":status": 200, "content-type": "application/connect+proto" } as const;
		if (scenario === "trailers") {
			stream.respond(responseHeaders, { waitForTrailers: true });
			stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }));
			stream.write(Buffer.concat([textDeltaFrame("hello"), turnEndedFrame()]));
			stream.end();
			return;
		}

		stream.respond(responseHeaders);
		if (scenario === "clean-without-turn-ended") {
			stream.write(textDeltaFrame("legacy"));
			stream.end();
			return;
		}

		const frames = Buffer.concat([textDeltaFrame("hello"), turnEndedFrame()]);
		if (scenario === "fragmented") {
			stream.write(frames.subarray(0, 3));
			stream.write(frames.subarray(3, frames.length - 2));
			stream.write(frames.subarray(frames.length - 2));
		} else {
			stream.write(frames);
		}
		if (scenario === "silent-after-turn-ended") return;
		if (scenario === "late-connect-error") {
			setTimeout(() => {
				stream.write(connectEndErrorFrame());
				stream.end();
			}, 10);
			return;
		}
		if (scenario === "late-normal-end") {
			setTimeout(() => stream.end(), 10);
			return;
		}
		stream.end();
	});

	const listening = Promise.withResolvers<void>();
	server.once("error", listening.reject);
	server.listen(0, "127.0.0.1", listening.resolve);
	await listening.promise;
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Expected fixture server TCP address");
	return `http://127.0.0.1:${address.port}`;
}

function makeModel(baseUrl: string): Model<"cursor-agent"> {
	return {
		id: "cursor-terminal-fixture",
		name: "Cursor terminal fixture",
		api: "cursor-agent",
		provider: "cursor",
		baseUrl,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1,
		maxTokens: 1,
	};
}

const context: Context = { messages: [{ role: "user", content: "terminal lifecycle", timestamp: 1 }] };

async function runScenario(nextScenario: Scenario, postTurnEndedTimeoutMs = 50) {
	scenario = nextScenario;
	const baseUrl = await startServer();
	const stream = streamCursor(makeModel(baseUrl), context, { apiKey: "test-token", postTurnEndedTimeoutMs });
	const eventTypes: string[] = [];
	for await (const event of stream) eventTypes.push(event.type);
	return { eventTypes, result: await stream.result() };
}

afterEach(async () => {
	scenario = "coalesced";
	destroyedSessionCount = 0;
	for (const session of sessions) session.destroy();
	sessions.clear();
	if (!server) return;
	const closing = server;
	server = undefined;
	const closed = Promise.withResolvers<void>();
	closing.close(error => (error ? closed.reject(error) : closed.resolve()));
	await closed.promise;
});

describe("Cursor terminal transport lifecycle", () => {
	it("times out and destroys the session when the peer stays silent after turnEnded", async () => {
		const { eventTypes, result } = await runScenario("silent-after-turn-ended", 20);
		await sessionDestroyed.promise;
		expect(eventTypes.at(-1)).toBe("error");
		expect(result.errorMessage).toContain("did not end within 20ms after turnEnded");
		expect(destroyedSessionCount).toBe(1);
	});

	it("fails when a CONNECT protocol error arrives after turnEnded", async () => {
		const { eventTypes, result } = await runScenario("late-connect-error", 50);
		expect(eventTypes.at(-1)).toBe("error");
		expect(eventTypes).not.toContain("done");
		expect(result.errorMessage).toContain("Connect error unavailable: post-turn failure");
		expect(result.errorMessage).not.toContain("did not end within");
	});

	it("succeeds when protocol end arrives inside the post-turnEnded window", async () => {
		const { eventTypes, result } = await runScenario("late-normal-end", 50);
		expect(eventTypes.at(-1)).toBe("done");
		expect(result.stopReason).toBe("stop");
	});

	it("keeps clean protocol end without turnEnded as a successful compatibility behavior", async () => {
		const { eventTypes, result } = await runScenario("clean-without-turn-ended");
		expect(eventTypes.at(-1)).toBe("done");
		expect(result.stopReason).toBe("stop");
	});

	it.each(["coalesced", "fragmented"] as const)("handles %s turnEnded framing", async framing => {
		const { eventTypes, result } = await runScenario(framing);
		expect(eventTypes.at(-1)).toBe("done");
		expect(result.stopReason).toBe("stop");
	});

	it("settles successfully after turnEnded, trailers, and protocol end", async () => {
		const { eventTypes, result } = await runScenario("trailers");
		expect(eventTypes.at(-1)).toBe("done");
		expect(result.stopReason).toBe("stop");
	});
});
