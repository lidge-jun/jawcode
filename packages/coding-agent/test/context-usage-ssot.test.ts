import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { Agent } from "@jawcode-dev/agent-core";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { getBundledModel } from "@jawcode-dev/ai/models";
import { TempDir } from "@jawcode-dev/utils";
import { ModelRegistry } from "../src/config/model-registry";
import { Settings } from "../src/config/settings";
import { AgentSession } from "../src/session/agent-session";
import { AuthStorage } from "../src/session/auth-storage";
import { SessionManager } from "../src/session/session-manager";

describe("AgentSession context-usage SSOT", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@jwc-context-usage-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "auth.db"));
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled test model");
		session = new AgentSession({
			agent: new Agent({ initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] } }),
			sessionManager: SessionManager.create(tempDir.path(), tempDir.path()),
			settings: Settings.isolated(),
			modelRegistry: new ModelRegistry(authStorage),
		});
	});

	afterEach(async () => {
		await session.dispose();
		authStorage.close();
		tempDir.removeSync();
	});

	function providerMessage(input: number, output: number): AssistantMessage {
		return {
			role: "assistant",
			content: [{ type: "text", text: "provider response" }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4-5",
			stopReason: "stop",
			usage: {
				input,
				output,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: input + output,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			timestamp: Date.now(),
		};
	}

	it("keeps provider-reported total authoritative over a divergent full-history heuristic", () => {
		const assistant = providerMessage(150_000, 500);
		session.sessionManager.appendMessage({ role: "user", content: "large ".repeat(100_000), timestamp: 1 });
		session.sessionManager.appendMessage(assistant);
		session.agent.replaceMessages(session.buildDisplaySessionContext().messages);

		expect(session.getContextUsage()).toMatchObject({
			tokens: 150_500,
			source: "provider_anchor",
		});
	});

	it("invalidates the cached snapshot when the Agent-owned context revision changes", () => {
		const assistant = providerMessage(1_000, 100);
		session.sessionManager.appendMessage(assistant);
		session.agent.replaceMessages(session.buildDisplaySessionContext().messages);
		const before = session.getContextUsage();
		session.agent.appendMessage({ role: "user", content: "trailing delta ".repeat(1_000), timestamp: 2 });
		const after = session.getContextUsage();

		expect(before?.source).toBe("provider_anchor");
		expect(after?.source).toBe("provider_anchor");
		expect(after?.tokens).toBeGreaterThan(before?.tokens ?? Number.POSITIVE_INFINITY);
	});
});
