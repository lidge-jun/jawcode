import { afterEach, describe, expect, it, vi } from "bun:test";
import { Agent } from "@jawcode-dev/agent-core";
import { getBundledModel } from "@jawcode-dev/ai/models";
import { createMockModel } from "@jawcode-dev/ai/providers/mock";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import type { ExtensionRunner } from "@jawcode-dev/coding-agent/extensibility/extensions/runner";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";

function createSession(extensionRunner: ExtensionRunner): AgentSession {
	const model = getBundledModel("anthropic", "claude-sonnet-4-5");
	if (!model) throw new Error("Expected bundled test model");
	const mock = createMockModel({ handler: () => ({ content: ["Done"] }) });
	const agent = new Agent({
		getApiKey: () => "test-key",
		initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
		streamFn: mock.stream,
	});
	return new AgentSession({
		agent,
		sessionManager: SessionManager.inMemory(),
		settings: Settings.isolated({ "compaction.enabled": false }),
		modelRegistry: { getApiKey: async () => "test-key" } as never,
		extensionRunner,
	});
}

describe("AgentSession event ordering", () => {
	let session: AgentSession | undefined;

	afterEach(async () => {
		await session?.dispose();
		session = undefined;
		vi.restoreAllMocks();
	});

	it("delivers asymmetric extension events to subscribers in FIFO order exactly once", async () => {
		const startGate = Promise.withResolvers<void>();
		const extensionRunner = {
			hasHandlers: vi.fn((type: string) => type === "message_start"),
			emit: vi.fn(async (event: { type: string }) => {
				if (event.type === "message_start") await startGate.promise;
			}),
			emitBeforeAgentStart: vi.fn().mockResolvedValue(undefined),
			emitSessionStop: vi.fn().mockResolvedValue(undefined),
		} as object as ExtensionRunner;
		session = createSession(extensionRunner);
		const order: string[] = [];
		session.subscribe(event => {
			if (event.type === "message_start" || event.type === "message_end") {
				order.push(`${event.type}:${event.message.role}`);
			}
		});

		const prompt = session.prompt("test");
		await Promise.resolve();
		startGate.resolve();
		await prompt;
		await session.waitForIdle();

		for (const role of ["user", "assistant"]) {
			expect(order.filter(item => item === `message_start:${role}`)).toHaveLength(1);
			expect(order.filter(item => item === `message_end:${role}`)).toHaveLength(1);
			expect(order.indexOf(`message_start:${role}`)).toBeLessThan(order.indexOf(`message_end:${role}`));
		}
	});

	it("does not await a slow subscriber", async () => {
		const extensionRunner = {
			hasHandlers: vi.fn(() => false),
			emit: vi.fn().mockResolvedValue(undefined),
			emitBeforeAgentStart: vi.fn().mockResolvedValue(undefined),
			emitSessionStop: vi.fn().mockResolvedValue(undefined),
		} as object as ExtensionRunner;
		session = createSession(extensionRunner);
		const subscriberGate = Promise.withResolvers<void>();
		let subscriberStarted = false;
		session.subscribe(async event => {
			if (event.type !== "message_start") return;
			subscriberStarted = true;
			await subscriberGate.promise;
		});

		await session.prompt("test");
		await session.waitForIdle();
		expect(subscriberStarted).toBe(true);
		subscriberGate.resolve();
	});
});
