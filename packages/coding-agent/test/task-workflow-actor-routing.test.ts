import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Message, Model } from "@gajae-code/ai";
import { AsyncJobManager } from "../src/async";
import { Settings } from "../src/config/settings";
import { readActorRegistry } from "../src/jwc-runtime/actor-registry";
import { runNativeOrchestrateCommand } from "../src/jwc-runtime/orchestrate-runtime";
import type { CreateAgentSessionOptions, CreateAgentSessionResult } from "../src/sdk";
import * as sdkModule from "../src/sdk";
import type { AgentSession, AgentSessionEvent } from "../src/session/agent-session";
import { SessionManager } from "../src/session/session-manager";
import { TaskTool } from "../src/task";
import * as discoveryModule from "../src/task/discovery";
import type { AgentDefinition, TaskParams } from "../src/task/types";
import type { ToolSession } from "../src/tools";
import { EventBus } from "../src/utils/event-bus";

type CapturedCreateOptions = CreateAgentSessionOptions & {
	sessionFile?: string;
	runMode?: string;
	resumeMessage?: string;
};

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
		tools: ["read"],
	};
}

describe("TaskTool PABCD workflow actor routing", () => {
	let cwd: string;
	let sessionFile: string;
	const sessionId = "session.one";

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "task-workflow-actor-"));
		sessionFile = path.join(cwd, ".jwc", "sessions", "parent.jsonl");
		await fs.mkdir(path.dirname(sessionFile), { recursive: true });
		await Bun.write(sessionFile, "");
		AsyncJobManager.resetForTests();
		await runNativeOrchestrateCommand(["p", "--session-id", sessionId], cwd);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		AsyncJobManager.resetForTests();
		await fs.rm(cwd, { recursive: true, force: true });
	});

	function createTool(agentName = "critic"): { tool: Promise<TaskTool>; options: CapturedCreateOptions[] } {
		vi.spyOn(discoveryModule, "discoverAgents").mockResolvedValue({
			agents: [agent(agentName)],
			projectAgentsDir: null,
		});
		const options: CapturedCreateOptions[] = [];
		vi.spyOn(sdkModule, "createAgentSession").mockImplementation(async createOptions => {
			options.push((createOptions ?? {}) as CapturedCreateOptions);
			return {
				session: createYieldingSession(),
				extensionsResult: {} as CreateAgentSessionResult["extensionsResult"],
				setToolUIContext: () => {},
				eventBus: new EventBus(),
			} satisfies CreateAgentSessionResult;
		});
		const toolSession = {
			cwd,
			hasUI: false,
			settings: Settings.isolated({ "async.enabled": false, "task.isolation.mode": "none" }),
			getSessionFile: () => sessionFile,
			getSessionId: () => sessionId,
			getSessionSpawns: () => "*",
			model: { contextWindow: 1_000 } as Model,
			modelRegistry: {
				authStorage: undefined,
				refresh: async () => {},
				getAvailable: () => [],
				getApiKey: async () => null,
			},
		} as unknown as ToolSession;
		return { tool: TaskTool.create(toolSession), options };
	}

	it("resumes the same compatible actor session with message mode", async () => {
		const { tool } = createTool();
		const taskTool = await tool;
		const openSpy = vi.spyOn(SessionManager, "open");
		const manager = new AsyncJobManager({ onJobComplete: async () => {} });
		AsyncJobManager.setInstance(manager);
		const params = (assignment: string): TaskParams => ({
			agent: "critic",
			tasks: [{ id: "PlanReview", description: "review plan", assignment }],
		});

		await taskTool.execute("call-1", params("review once"));
		await manager.waitForAll();
		const registryAfterFirst = await readActorRegistry(cwd, sessionId);
		const actor = registryAfterFirst.actors[0];
		expect(actor).toBeDefined();
		if (!actor?.sessionFile) throw new Error("Expected actor session file");
		const actorSessionFile = actor.sessionFile;
		expect(openSpy.mock.calls[0]?.[0]).toBe(actorSessionFile);
		await Bun.write(actorSessionFile, "");

		await taskTool.execute("call-2", params("review twice"));
		await manager.waitForAll();
		expect(openSpy.mock.calls[1]?.[0]).toBe(actorSessionFile);
		await manager.dispose({ timeoutMs: 100 });
		expect(openSpy.mock.calls).toHaveLength(2);
	});

	it("does not silently resume when the actor session file is unavailable", async () => {
		const { tool, options } = createTool();
		const taskTool = await tool;
		const openSpy = vi.spyOn(SessionManager, "open");
		const manager = new AsyncJobManager({ onJobComplete: async () => {} });
		AsyncJobManager.setInstance(manager);
		const params: TaskParams = {
			agent: "critic",
			tasks: [{ id: "PlanReview", description: "review plan", assignment: "review" }],
		};

		await taskTool.execute("call-1", params);
		await manager.waitForAll();
		const actor = (await readActorRegistry(cwd, sessionId)).actors[0];
		await fs.rm(actor!.sessionFile, { force: true });
		await taskTool.execute("call-2", params);
		await manager.waitForAll();
		const secondJob = manager.getRecentJobs(1)[0];
		await manager.dispose({ timeoutMs: 100 });

		expect(options).toHaveLength(1);
		expect(openSpy.mock.calls).toHaveLength(1);
		expect(secondJob?.resultText).toContain("context_unavailable");
	});

	it("does not route executor_ext through PABCD workflow actors", async () => {
		const { tool } = createTool("executor");
		const taskTool = await tool;
		vi.spyOn(SessionManager, "open");
		const manager = new AsyncJobManager({ onJobComplete: async () => {} });
		AsyncJobManager.setInstance(manager);

		await taskTool.execute("call-ext", {
			agent: "executor_ext",
			tasks: [{ id: "External", description: "external", assignment: "Do external work." }],
		});
		await manager.waitForAll();
		expect((await readActorRegistry(cwd, sessionId)).actors).toHaveLength(0);
		await manager.dispose({ timeoutMs: 100 });
	});
});
