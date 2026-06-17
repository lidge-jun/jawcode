import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import type { AgentMessage } from "@jawcode-dev/agent-core";
import { Agent } from "@jawcode-dev/agent-core";
import { getBundledModel, type TextContent } from "@jawcode-dev/ai";
import { createMockModel, type MockHandler } from "@jawcode-dev/ai/providers/mock";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import type { ExtensionRunner } from "@jawcode-dev/coding-agent/extensibility/extensions/runner";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { TempDir } from "@jawcode-dev/utils";

/**
 * Issue #434 — queued prompts while the agent is busy.
 *
 * A prompt submitted while the agent is streaming can either steer the active
 * turn (interrupt now) or be queued to run after the active turn completes.
 * These tests pin the two distinct behaviors and prove the two queues do not
 * conflate: steering goes to the steering queue, queued-next-turn prompts go to
 * the follow-up queue, and the queued prompts run in submission order.
 */
describe("AgentSession queued prompts (issue #434)", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let modelRegistry: ModelRegistry;
	let session: AgentSession | undefined;

	beforeEach(async () => {
		tempDir = TempDir.createSync("@pi-queued-prompts-");
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

	function buildSession(responses: MockHandler[], extensionRunner?: ExtensionRunner): AgentSession {
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
		return new AgentSession({
			agent,
			sessionManager: SessionManager.inMemory(),
			settings,
			modelRegistry,
			extensionRunner,
		});
	}

	function messageText(m: Extract<AgentMessage, { role: "user" }>): string {
		if (typeof m.content === "string") return m.content;
		return m.content
			.filter((c): c is TextContent => c.type === "text")
			.map(c => c.text)
			.join("");
	}

	function userTexts(s: AgentSession): string[] {
		return s.agent.state.messages
			.filter((m): m is Extract<AgentMessage, { role: "user" }> => m.role === "user")
			.map(messageText);
	}

	function assistantCount(s: AgentSession): number {
		return s.agent.state.messages.filter(m => m.role === "assistant").length;
	}

	async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
		const start = Date.now();
		while (!predicate()) {
			if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
			await Bun.sleep(5);
		}
	}

	it("runs prompts queued while busy after the active turn, in submission order", async () => {
		const gate = Promise.withResolvers<void>();
		session = buildSession([
			async () => {
				await gate.promise;
				return { content: ["turn 1"] };
			},
			{ content: ["turn 2"] },
			{ content: ["turn 3"] },
		]);

		// Start the first turn but do not await — it blocks on the gate so the
		// session stays busy while we queue.
		const first = session.prompt("p1");
		await waitUntil(() => session!.isStreaming);

		// Queue two prompts as next-turn work (the "queue" busy behavior).
		await session.prompt("p2", { streamingBehavior: "followUp" });
		await session.prompt("p3", { streamingBehavior: "followUp" });

		// They are queued, not delivered yet, and live in the follow-up queue.
		expect(session.getQueuedMessages().followUp).toEqual(["p2", "p3"]);
		expect(session.getQueuedMessages().steering).toEqual([]);
		expect(assistantCount(session)).toBe(0);

		gate.resolve();
		await first;
		await session.waitForIdle();

		expect(userTexts(session)).toEqual(["p1", "p2", "p3"]);
		expect(assistantCount(session)).toBe(3);
		expect(session.queuedMessageCount).toBe(0);
	});

	it("keeps steering and queued-next-turn prompts in separate queues", async () => {
		const gate = Promise.withResolvers<void>();
		session = buildSession([
			async () => {
				await gate.promise;
				return { content: ["turn 1"] };
			},
			{ content: ["after steer"] },
			{ content: ["after queue"] },
		]);

		const first = session.prompt("p1");
		await waitUntil(() => session!.isStreaming);

		await session.prompt("steer me", { streamingBehavior: "steer" });
		await session.prompt("queue me", { streamingBehavior: "followUp" });

		// Separation: the steer landed only in the steering queue, the queued
		// prompt only in the follow-up queue.
		expect(session.getQueuedMessages().steering).toEqual(["steer me"]);
		expect(session.getQueuedMessages().followUp).toEqual(["queue me"]);
		expect(session.hasQueuedSteering).toBe(true);

		gate.resolve();
		await first;
		await session.waitForIdle();

		// Steering interrupted/continued the active turn; the queued prompt ran
		// after it. Submission order across both is preserved.
		expect(userTexts(session)).toEqual(["p1", "steer me", "queue me"]);
	});

	it("delivers steering queued at the yield boundary before ending the session", async () => {
		session = buildSession([{ content: ["turn 1"] }, { content: ["after late steer"] }]);
		let queuedLateSteer = false;
		session.agent.setOnBeforeYield(() => {
			if (queuedLateSteer) return;
			queuedLateSteer = true;
			session!.agent.steer({
				role: "user",
				content: [{ type: "text", text: "late steer" }],
				attribution: "user",
				timestamp: Date.now(),
			});
		});

		await session.prompt("p1");
		await session.waitForIdle();

		expect(userTexts(session)).toEqual(["p1", "late steer"]);
		expect(assistantCount(session)).toBe(2);
		expect(session.queuedMessageCount).toBe(0);
	});

	it("drains follow-up queued while agent_end is deferred until prompt settle", async () => {
		let queuedFollowUp = false;
		const extensionRunner = {
			hasHandlers: () => false,
			emitBeforeAgentStart: async () => undefined,
			async emit(event: { type: string }): Promise<void> {
				if (event.type !== "agent_end") return;
				if (queuedFollowUp) return;
				queuedFollowUp = true;
				await session!.prompt("deferred follow-up", { streamingBehavior: "followUp" });
			},
		} as unknown as ExtensionRunner;
		session = buildSession([{ content: ["turn 1"] }, { content: ["after deferred follow-up"] }], extensionRunner);

		await session.prompt("p1");
		await session.waitForIdle();

		expect(queuedFollowUp).toBe(true);
		expect(userTexts(session)).toEqual(["p1", "deferred follow-up"]);
		expect(assistantCount(session)).toBe(2);
		expect(session.queuedMessageCount).toBe(0);
	});
});
