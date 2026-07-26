import { describe, expect, it } from "bun:test";
import type { RetainOptions, RetainResponse } from "@jawcode-dev/coding-agent/hindsight/client";
import { HindsightApi } from "@jawcode-dev/coding-agent/hindsight/client";
import type { HindsightConfig } from "@jawcode-dev/coding-agent/hindsight/config";
import type { HindsightMessage } from "@jawcode-dev/coding-agent/hindsight/content";
import { HindsightSessionState } from "@jawcode-dev/coding-agent/hindsight/state";
import type { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";

interface RetainCall {
	options?: RetainOptions;
	transcript: string;
}

function makeConfig(): HindsightConfig {
	return {
		hindsightApiUrl: "http://localhost",
		hindsightApiToken: null,
		bankId: "test-bank",
		bankIdPrefix: "",
		scoping: "global",
		bankMission: "",
		retainMission: null,
		autoRecall: false,
		autoRetain: true,
		retainMode: "full-session",
		retainEveryNTurns: 1,
		retainOverlapTurns: 0,
		retainContext: "test",
		recallBudget: "mid",
		recallMaxTokens: 1024,
		recallTypes: [],
		recallContextTurns: 1,
		recallMaxQueryChars: 800,
		recallPromptPreamble: "test",
		debug: false,
		mentalModelsEnabled: false,
		mentalModelAutoSeed: false,
		mentalModelRefreshIntervalMs: 300_000,
		mentalModelMaxRenderChars: 16_000,
	};
}

class FakeHindsightApi extends HindsightApi {
	readonly calls: RetainCall[] = [];
	readonly outcomes: Array<Promise<RetainResponse>> = [];

	constructor() {
		super({ baseUrl: "http://localhost" });
	}

	override async retain(_bankId: string, transcript: string, options?: RetainOptions): Promise<RetainResponse> {
		this.calls.push({ transcript, options });
		return (await this.outcomes.shift()) ?? {};
	}
}

function makeState(client: FakeHindsightApi, entries: HindsightMessage[] = []): HindsightSessionState {
	const session = {
		sessionManager: {
			getEntries: () =>
				entries.map((message, index) => ({
					id: String(index),
					parentId: index === 0 ? null : String(index - 1),
					timestamp: new Date(0).toISOString(),
					type: "message" as const,
					message:
						message.role === "user"
							? { ...message, timestamp: 0 }
							: {
									role: "assistant" as const,
									content: [{ type: "text" as const, text: message.content }],
									api: "test",
									provider: "test",
									model: "test",
									stopReason: "stop" as const,
									timestamp: 0,
								},
				})),
		},
	} as object as AgentSession;
	return new HindsightSessionState({
		sessionId: "test-session",
		client,
		bankId: "test-bank",
		config: makeConfig(),
		session,
		missionsSet: new Set(),
	});
}

const user = (content: string): HindsightMessage => ({ role: "user", content });
const assistant = (content: string): HindsightMessage => ({ role: "assistant", content });

describe("Hindsight full-session retention cache", () => {
	it("reuses a valid append-only prefix without reformatting it", async () => {
		const client = new FakeHindsightApi();
		const state = makeState(client);
		let oldContentReads = 0;
		const first = {
			role: "user" as const,
			get content() {
				oldContentReads += 1;
				return "first";
			},
		};
		await state.retainSession([first]);
		oldContentReads = 0;
		await state.retainSession([first, assistant("second")]);

		// One read validates the old prefix and one contributes to the next
		// full-prefix digest; rebuilding its transcript would read it again.
		expect(oldContentReads).toBe(2);
		expect(client.calls.at(-1)?.transcript).toContain("first\n[user:end]\n\n[role: assistant]\nsecond");
	});

	it("rebuilds after rewind, same-length rewrite, and an older in-place edit", async () => {
		const client = new FakeHindsightApi();
		const state = makeState(client);
		const original = [user("A"), assistant("B"), user("C")];
		await state.retainSession(original);

		await state.retainSession(original.slice(0, 2));
		expect(client.calls.at(-1)?.transcript).not.toContain("C");

		const rewritten = [user("A"), assistant("B2")];
		await state.retainSession(rewritten);
		expect(client.calls.at(-1)?.transcript).not.toContain("\nB\n");
		expect(client.calls.at(-1)?.transcript).toContain("B2");

		rewritten[0].content = "A2";
		await state.retainSession([...rewritten, user("D")]);
		expect(client.calls.at(-1)?.transcript).not.toContain("\nA\n");
		expect(client.calls.at(-1)?.transcript).toContain("A2");
	});

	it("forced retain bypasses the cache and resends the complete transcript", async () => {
		const messages = [user("A"), assistant("B")];
		const client = new FakeHindsightApi();
		const state = makeState(client, messages);
		await state.retainSession(messages);
		await state.forceRetainCurrentSession();

		expect(client.calls).toHaveLength(2);
		expect(client.calls[1]?.transcript).toBe(client.calls[0]?.transcript);
	});

	it("empty and failed retains do not advance the cached cursor", async () => {
		const client = new FakeHindsightApi();
		const state = makeState(client);
		await state.retainSession([user("A")]);
		await state.retainSession([user("A"), user("<memories>ignored</memories>")]);
		expect(client.calls).toHaveLength(1);

		client.outcomes.push(Promise.reject(new Error("retain failed")));
		await expect(state.retainSession([user("A"), assistant("B")])).rejects.toThrow("retain failed");
		await state.retainSession([user("A"), assistant("B")]);
		expect(client.calls.at(-1)?.transcript).toContain("A\n[user:end]\n\n[role: assistant]\nB");
	});

	it("does not let an older completion overwrite a newer generation", async () => {
		const client = new FakeHindsightApi();
		const state = makeState(client);
		const older = Promise.withResolvers<RetainResponse>();
		const newer = Promise.withResolvers<RetainResponse>();
		client.outcomes.push(older.promise, newer.promise);

		const retainN = state.retainSession([user("A")]);
		const retainN1 = state.retainSession([user("A"), assistant("B")]);
		newer.resolve({});
		await retainN1;
		older.resolve({});
		await retainN;

		await state.retainSession([user("A"), assistant("B")]);
		expect(client.calls).toHaveLength(2);
	});
});
