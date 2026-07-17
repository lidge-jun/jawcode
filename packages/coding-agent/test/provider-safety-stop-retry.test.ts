import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent } from "@jawcode-dev/agent-core";
import { type AssistantMessage, getBundledModel } from "@jawcode-dev/ai";
import { AssistantMessageEventStream } from "@jawcode-dev/ai/utils/event-stream";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentSession, type AgentSessionEvent } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { TempDir } from "@jawcode-dev/utils";

type AutoRetryStartEvent = Extract<AgentSessionEvent, { type: "auto_retry_start" }>;

describe("typed provider safety-stop retry policy", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession | undefined;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@jwc-provider-safety-stop-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "anthropic-test-key");
	});

	afterEach(async () => {
		await session?.dispose();
		session = undefined;
		authStorage.close();
		tempDir.removeSync();
		vi.restoreAllMocks();
	});

	it("surfaces a typed stop without display text or retrying", async () => {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled Anthropic test model");
		const agent = new Agent({
			getApiKey: provider => `${provider}-test-key`,
			initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
			streamFn: requestedModel => {
				const stream = new AssistantMessageEventStream();
				queueMicrotask(() => {
					const message: AssistantMessage = {
						role: "assistant",
						content: [],
						api: requestedModel.api,
						provider: requestedModel.provider,
						model: requestedModel.id,
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "error",
						errorKind: "provider_safety_stop",
						timestamp: Date.now(),
					};
					stream.push({ type: "start", partial: message });
					stream.push({ type: "error", reason: "error", error: message });
				});
				return stream;
			},
		});
		const settings = Settings.isolated({
			"compaction.enabled": false,
			"retry.baseDelayMs": 1,
			"retry.maxDelayMs": 10,
			"retry.maxRetries": 1,
		});
		settings.setModelRole("default", `${model.provider}/${model.id}`);
		session = new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings,
			modelRegistry: new ModelRegistry(authStorage),
		});
		const retries: AutoRetryStartEvent[] = [];
		session.subscribe(event => {
			if (event.type === "auto_retry_start") retries.push(event);
		});

		await session.prompt("trigger typed provider safety stop");
		await session.waitForIdle();

		expect(retries).toHaveLength(0);
		const last = session.agent.state.messages.at(-1);
		expect(last?.role).toBe("assistant");
		if (last?.role !== "assistant") throw new Error("Expected assistant message");
		expect(last.stopReason).toBe("error");
		expect(last.errorKind).toBe("provider_safety_stop");
		expect(last.errorMessage).toBeUndefined();
	});
});
