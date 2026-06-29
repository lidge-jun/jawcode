import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import type { AgentMessage } from "@jawcode-dev/agent-core";
import { Agent } from "@jawcode-dev/agent-core";
import { getBundledModel, type TextContent } from "@jawcode-dev/ai";
import { createMockModel } from "@jawcode-dev/ai/providers/mock";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { TempDir } from "@jawcode-dev/utils";

function userMessage(text: string) {
	return { role: "user" as const, content: text, timestamp: Date.now() };
}

/**
 * Chase 20.005 — stranded steer/follow-up delivery guarantee (omp 42ffc83).
 *
 * A steer/follow-up that lands in the settle window — after the agent loop's
 * final queue poll but before the session reports idle (e.g. from an `agent_end`
 * subscriber) — is owned by the agent-core queue with no loop left to deliver
 * it. `#drainStrandedQueuedMessages` (called at every settle) recovers it via
 * the existing idle-path auto-continue gate, without double-continuing.
 */
describe("AgentSession stranded steer/follow-up delivery (20.005)", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;
	let session: AgentSession | undefined;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@pi-queued-steer-delivery-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		authStorage.setRuntimeApiKey("anthropic", "anthropic-test-key");
		modelRegistry = new ModelRegistry(authStorage);
	});

	afterEach(async () => {
		if (session) {
			await session.dispose();
			session = undefined;
		}
		authStorage.close();
		tempDir.removeSync();
	});

	function buildSession(responses: Array<{ content: string[] }>): AgentSession {
		const model = getBundledModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected bundled Anthropic test model to exist");
		const mock = createMockModel({ responses });
		const agent = new Agent({
			getApiKey: provider => `${provider}-test-key`,
			initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
			streamFn: mock.stream,
		});
		const settings = Settings.isolated({ "compaction.enabled": false });
		settings.setModelRole("default", `${model.provider}/${model.id}`);
		return new AgentSession({ agent, sessionManager: SessionManager.inMemory(), settings, modelRegistry });
	}

	function assistantCount(s: AgentSession): number {
		return s.agent.state.messages.filter(m => m.role === "assistant").length;
	}

	function userTexts(s: AgentSession): string[] {
		return s.agent.state.messages
			.filter((m): m is Extract<AgentMessage, { role: "user" }> => m.role === "user")
			.map(m =>
				typeof m.content === "string"
					? m.content
					: m.content
							.filter((c): c is TextContent => c.type === "text")
							.map(c => c.text)
							.join(""),
			);
	}

	it("delivers a steer that lands at the settle window without a manual prompt", async () => {
		session = buildSession([{ content: ["first done"] }, { content: ["handled late steer"] }]);
		let injected = false;
		session.subscribe(event => {
			if (event.type === "agent_end" && !injected) {
				injected = true;
				session?.agent.steer(userMessage("late steer"));
			}
		});

		await session.prompt("hello");
		await session.waitForIdle();

		// Without the settle-time drain the steer strands (assistantCount stays 1).
		expect(session.agent.hasQueuedSteering()).toBe(false);
		expect(assistantCount(session)).toBe(2);
		expect(userTexts(session)).toContain("late steer");
	});

	it("delivers a follow-up that lands at the settle window", async () => {
		session = buildSession([{ content: ["first done"] }, { content: ["handled late follow-up"] }]);
		let injected = false;
		session.subscribe(event => {
			if (event.type === "agent_end" && !injected) {
				injected = true;
				session?.agent.followUp(userMessage("late follow-up"));
			}
		});

		await session.prompt("hello");
		await session.waitForIdle();

		expect(session.agent.hasQueuedMessages()).toBe(false);
		expect(assistantCount(session)).toBe(2);
		expect(userTexts(session)).toContain("late follow-up");
	});

	it("drains a stranded steer in a single continue (no double-continue)", async () => {
		// Three responses available, but a single stranded steer must produce
		// exactly one extra turn — not two.
		session = buildSession([{ content: ["first done"] }, { content: ["second"] }, { content: ["third"] }]);
		let injected = false;
		session.subscribe(event => {
			if (event.type === "agent_end" && !injected) {
				injected = true;
				session?.agent.steer(userMessage("only steer"));
			}
		});

		await session.prompt("hello");
		await session.waitForIdle();

		expect(session.agent.hasQueuedMessages()).toBe(false);
		expect(assistantCount(session)).toBe(2);
	});
});
