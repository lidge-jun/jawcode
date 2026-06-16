import { afterEach, describe, expect, it, vi } from "bun:test";
import { Effort, type Message, type Model } from "@jawcode-dev/ai";
import { AsyncJobManager } from "../../src/async";
import { Settings } from "../../src/config/settings";
import type { CreateAgentSessionOptions, CreateAgentSessionResult } from "../../src/sdk";
import * as sdkModule from "../../src/sdk";
import type { AgentSession, AgentSessionEvent } from "../../src/session/agent-session";
import { TaskTool } from "../../src/task";
import * as discoveryModule from "../../src/task/discovery";
import type { AgentDefinition, TaskParams } from "../../src/task/types";
import type { ToolSession } from "../../src/tools";
import { EventBus } from "../../src/utils/event-bus";

function assistantDone(text: string): Message {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

function createYieldingSession(): AgentSession {
	const listeners: Array<(event: AgentSessionEvent) => void> = [];
	const state = { messages: [] as Message[] };
	return {
		state,
		agent: { state: { systemPrompt: ["child-system"] } },
		model: undefined,
		extensionRunner: undefined,
		sessionManager: { appendSessionInit: () => {} },
		getActiveToolNames: () => [],
		setActiveToolsByName: async () => {},
		subscribe: (listener: (event: AgentSessionEvent) => void) => {
			listeners.push(listener);
			return () => {};
		},
		prompt: async () => {
			state.messages.push(assistantDone("done"));
		},
		waitForIdle: async () => {},
		getLastAssistantMessage: () => state.messages.at(-1),
		abort: async () => {},
		dispose: async () => {},
	} as unknown as AgentSession;
}

function agent(name: string): AgentDefinition {
	return {
		name,
		description: `${name} agent`,
		systemPrompt: `${name} prompt`,
		source: "bundled",
	};
}

function model(provider: string, id: string): Model {
	return { provider, id, contextWindow: 100_000 } as Model;
}

function createSession(agentModelOverrides: Record<string, string> = {}, activeModelPattern?: string): ToolSession {
	return {
		cwd: "/tmp",
		hasUI: false,
		settings: Settings.isolated({
			"async.enabled": false,
			"task.isolation.mode": "none",
			"task.agentModelOverrides": agentModelOverrides,
		}),
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		getActiveModelString: () => activeModelPattern,
		model: { contextWindow: 1_000 } as Model,
		modelRegistry: {
			authStorage: undefined,
			refresh: async () => {},
			getAvailable: () => [
				model("openai-codex", "gpt-5.5"),
				model("openai", "external-default"),
				model("openai", "example-model"),
				model("anthropic", "legacy-executor"),
			],
			getApiKey: async (candidate: Model) => (candidate.provider === "anthropic" ? undefined : "test-key"),
		},
	} as unknown as ToolSession;
}

async function executeWith(
	agentModelOverrides: Record<string, string>,
	task: TaskParams["tasks"][number],
	activeModelPattern?: string,
): Promise<void> {
	const manager = new AsyncJobManager({ onJobComplete: async () => {} });
	AsyncJobManager.setInstance(manager);
	const tool = await TaskTool.create(createSession(agentModelOverrides, activeModelPattern));
	await tool.execute("tool-call", { agent: "executor_ext", tasks: [task] });
	await manager.waitForAll();
	await manager.dispose({ timeoutMs: 100 });
}

describe("executor_ext model routing", () => {
	afterEach(() => {
		AsyncJobManager.resetForTests();
		vi.restoreAllMocks();
	});

	it("applies executor_ext overrides, per-task models, and legacy executor fallback", async () => {
		const createOptions: CreateAgentSessionOptions[] = [];
		vi.spyOn(discoveryModule, "discoverAgents").mockResolvedValue({
			agents: [agent("executor")],
			projectAgentsDir: null,
		});
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async (options = {}) => {
			createOptions.push(options);
			return {
				session: createYieldingSession(),
				extensionsResult: {} as CreateAgentSessionResult["extensionsResult"],
				setToolUIContext: () => {},
				eventBus: new EventBus(),
			} satisfies CreateAgentSessionResult;
		});

		await executeWith(
			{ executor_ext: "openai/external-default:high" },
			{ id: "ExternalDefault", description: "external", assignment: "Do external work." },
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai");
		expect(createOptions.at(-1)?.model?.id).toBe("external-default");
		expect(createOptions.at(-1)?.thinkingLevel).toBe(Effort.High);

		await executeWith(
			{ executor_ext: "openai/external-default:high" },
			{
				id: "ExternalPerTask",
				description: "external",
				assignment: "Do external work.",
				model: "openai/example-model:high",
			},
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai");
		expect(createOptions.at(-1)?.model?.id).toBe("example-model");
		expect(createOptions.at(-1)?.thinkingLevel).toBe(Effort.High);

		await executeWith(
			{ executor_ext: "openai/external-default:high" },
			{
				id: "ExternalEmptyModel",
				description: "external",
				assignment: "Do external work.",
				model: "",
			},
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai");
		expect(createOptions.at(-1)?.model?.id).toBe("external-default");
		expect(createOptions.at(-1)?.thinkingLevel).toBe(Effort.High);

		await executeWith(
			{ executor: "anthropic/legacy-executor:medium" },
			{ id: "ExternalLegacy", description: "external", assignment: "Do external work." },
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("anthropic");
		expect(createOptions.at(-1)?.model?.id).toBe("legacy-executor");
		expect(createOptions.at(-1)?.thinkingLevel).toBe(Effort.Medium);
	});

	it("falls back unresolved executor_ext selectors to the active parent model", async () => {
		const createOptions: CreateAgentSessionOptions[] = [];
		vi.spyOn(discoveryModule, "discoverAgents").mockResolvedValue({
			agents: [agent("executor")],
			projectAgentsDir: null,
		});
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async (options = {}) => {
			createOptions.push(options);
			return {
				session: createYieldingSession(),
				extensionsResult: {} as CreateAgentSessionResult["extensionsResult"],
				setToolUIContext: () => {},
				eventBus: new EventBus(),
			} satisfies CreateAgentSessionResult;
		});

		await executeWith(
			{ executor_ext: "xai/grok-composer-2.5-fast:low" },
			{ id: "ExternalFallback", description: "external", assignment: "Do external work." },
			"openai-codex/gpt-5.5",
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai-codex");
		expect(createOptions.at(-1)?.model?.id).toBe("gpt-5.5");

		await executeWith(
			{ executor_ext: "openai/external-default:low" },
			{
				id: "ExternalConfiguredFallback",
				description: "external",
				assignment: "Do external work.",
				model: "xai/grok-composer-2.5-fast:low",
			},
			"openai-codex/gpt-5.5",
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai");
		expect(createOptions.at(-1)?.model?.id).toBe("external-default");

		await executeWith(
			{},
			{ id: "ExternalSelf", description: "external", assignment: "Do external work." },
			"openai-codex/gpt-5.5",
		);
		expect(createOptions.at(-1)?.model?.provider).toBe("openai-codex");
		expect(createOptions.at(-1)?.model?.id).toBe("gpt-5.5");
	});
});
