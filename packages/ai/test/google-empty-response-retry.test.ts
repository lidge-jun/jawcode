import { describe, expect, it } from "bun:test";
import { streamGoogleGeminiCli } from "../src/providers/google-gemini-cli";
import type { AssistantMessageEvent, Context, FetchImpl, Model } from "../src/types";

const DAILY_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";
const SANDBOX_ENDPOINT = "https://daily-cloudcode-pa.sandbox.googleapis.com";
const context: Context = { messages: [{ role: "user", content: "hi", timestamp: 1 }] };

function model(baseUrl = ""): Model<"google-gemini-cli"> {
	return {
		id: "gemini-3-flash",
		name: "Gemini 3 Flash",
		api: "google-gemini-cli",
		provider: "google-antigravity",
		baseUrl,
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200_000,
		maxTokens: 32_000,
	};
}

function sse(text?: string, finishReason = "STOP"): Response {
	const parts = text === undefined ? [] : [{ text }];
	const body = `data: ${JSON.stringify({ response: { candidates: [{ content: { parts }, finishReason }] } })}\n\n`;
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function emptySse(): Response {
	return new Response("", { status: 200, headers: { "content-type": "text/event-stream" } });
}

function inputUrl(input: Parameters<FetchImpl>[0]): string {
	return input instanceof Request ? input.url : input.toString();
}

async function drain(stream: AsyncIterable<AssistantMessageEvent>): Promise<AssistantMessageEvent[]> {
	const events: AssistantMessageEvent[] = [];
	for await (const event of stream) events.push(event);
	return events;
}

describe("Google Gemini CLI empty-stream endpoint failover", () => {
	it("exhausts one endpoint's empty budget before succeeding on the next endpoint", async () => {
		const urls: string[] = [];
		const fetchMock: FetchImpl = async input => {
			const url = inputUrl(input);
			urls.push(url);
			return url.startsWith(DAILY_ENDPOINT) ? emptySse() : sse("Done.");
		};

		const stream = streamGoogleGeminiCli(model(), context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: fetchMock,
			streamMaxRetries: 1,
		});
		await drain(stream);
		const result = await stream.result();

		expect(urls.filter(url => url.startsWith(DAILY_ENDPOINT))).toHaveLength(2);
		expect(urls.filter(url => url.startsWith(SANDBOX_ENDPOINT))).toHaveLength(1);
		expect(result.stopReason).toBe("stop");
		expect(result.content).toEqual([{ type: "text", text: "Done." }]);
	});

	it("does not fail over after content has been emitted", async () => {
		const urls: string[] = [];
		const fetchMock: FetchImpl = async input => {
			urls.push(inputUrl(input));
			return sse("partial", "SAFETY");
		};

		const stream = streamGoogleGeminiCli(model(), context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: fetchMock,
			streamMaxRetries: 0,
		});
		await drain(stream);
		const result = await stream.result();

		expect(urls).toHaveLength(1);
		expect(urls[0]).toStartWith(DAILY_ENDPOINT);
		expect(result.stopReason).toBe("error");
	});

	it("does not fail over for a terminal policy response without emitted content", async () => {
		const urls: string[] = [];
		const fetchMock: FetchImpl = async input => {
			urls.push(inputUrl(input));
			return sse(undefined, "SAFETY");
		};

		const stream = streamGoogleGeminiCli(model(), context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: fetchMock,
			streamMaxRetries: 1,
		});
		await drain(stream);
		const result = await stream.result();

		expect(urls).toHaveLength(1);
		expect(urls[0]).toStartWith(DAILY_ENDPOINT);
		expect(result.stopReason).toBe("error");
	});

	it("caps auto-mode empty requests additively per endpoint", async () => {
		const urls: string[] = [];
		const fetchMock: FetchImpl = async input => {
			urls.push(inputUrl(input));
			return emptySse();
		};

		const stream = streamGoogleGeminiCli(model(), context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: fetchMock,
			requestMaxRetries: 3,
			streamMaxRetries: 1,
		});
		await drain(stream);
		const result = await stream.result();

		// One initial request plus one empty retry per endpoint; requestMaxRetries
		// does not multiply the empty-stream budget after the initial HTTP 200.
		expect(urls).toHaveLength(4);
		expect(urls.filter(url => url.startsWith(DAILY_ENDPOINT))).toHaveLength(2);
		expect(urls.filter(url => url.startsWith(SANDBOX_ENDPOINT))).toHaveLength(2);
		expect(result.stopReason).toBe("error");
	});

	it.each([DAILY_ENDPOINT, SANDBOX_ENDPOINT])("keeps fixed endpoint mode on %s", async baseUrl => {
		const urls: string[] = [];
		const fetchMock: FetchImpl = async input => {
			urls.push(inputUrl(input));
			return emptySse();
		};

		const stream = streamGoogleGeminiCli(model(baseUrl), context, {
			apiKey: JSON.stringify({ token: "token", projectId: "project" }),
			fetch: fetchMock,
			streamMaxRetries: 1,
		});
		await drain(stream);
		const result = await stream.result();

		expect(urls).toHaveLength(2);
		expect(urls.every(url => url.startsWith(baseUrl))).toBe(true);
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("empty response");
	});
});
