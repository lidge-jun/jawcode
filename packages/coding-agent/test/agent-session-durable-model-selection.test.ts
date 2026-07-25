import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Agent, ThinkingLevel } from "@jawcode-dev/agent-core";
import { getBundledModel } from "@jawcode-dev/ai";
import { AssistantMessageEventStream } from "@jawcode-dev/ai/utils/event-stream";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { resolveDurableModelThinkingLevel } from "@jawcode-dev/coding-agent/config/model-resolver";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { TempDir } from "@jawcode-dev/utils";
import { YAML } from "bun";
import { createAssistantMessage } from "./helpers/agent-session-setup";

function getAnthropicModel(id: string) {
	const model = getBundledModel("anthropic", id);
	if (!model) throw new Error(`Expected bundled model anthropic/${id}`);
	return model;
}

describe("durable model thinking resolution", () => {
	it("preserves explicit off and clamps explicit effort", () => {
		const model = getAnthropicModel("claude-sonnet-4-6");

		expect(resolveDurableModelThinkingLevel(model, ThinkingLevel.Off, ThinkingLevel.High)).toBe(ThinkingLevel.Off);
		expect(resolveDurableModelThinkingLevel(model, ThinkingLevel.XHigh, ThinkingLevel.Off)).toBe(ThinkingLevel.High);
	});
});

describe("Settings durable default model role", () => {
	let tempDir: TempDir;
	let agentDir: string;
	let projectDir: string;
	let configPath: string;

	beforeEach(async () => {
		resetSettingsForTest();
		tempDir = TempDir.createSync("@jwc-durable-model-settings-");
		agentDir = path.join(tempDir.path(), "agent");
		projectDir = path.join(tempDir.path(), "project");
		configPath = path.join(agentDir, "config.yml");
		await fs.mkdir(agentDir, { recursive: true });
		await fs.mkdir(projectDir, { recursive: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		resetSettingsForTest();
		tempDir.removeSync();
	});

	it("rolls back a rejected default so a later save cannot retry it", async () => {
		await Bun.write(configPath, YAML.stringify({ modelRoles: { default: "anthropic/original:low" } }));
		const settings = await Settings.init({ cwd: projectDir, agentDir });
		const originalWrite = Bun.write.bind(Bun);
		let rejectConfigWrite = true;
		vi.spyOn(Bun, "write").mockImplementation(async (destination, input) => {
			if (typeof destination === "string" && destination === configPath && rejectConfigWrite) {
				rejectConfigWrite = false;
				throw new Error("injected config write failure");
			}
			if (typeof destination !== "string" || typeof input !== "string") {
				throw new Error("unexpected non-string settings write");
			}
			return originalWrite(destination, input);
		});

		await expect(settings.setGlobalModelRoleAndFlush("default", "anthropic/rejected:high")).rejects.toThrow(
			"injected config write failure",
		);
		expect(settings.getGlobal("modelRoles")).toEqual({ default: "anthropic/original:low" });

		settings.set("theme.dark", "amber-claw");
		await settings.flush();
		expect(YAML.parse(await Bun.file(configPath).text())).toEqual({
			modelRoles: { default: "anthropic/original:low" },
			theme: { dark: "amber-claw" },
		});
	});
});

describe("AgentSession durable default model selection", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession;
	let sessionManager: SessionManager;
	let settings: Settings;
	let activeStream: AssistantMessageEventStream | undefined;
	let streamCreated: PromiseWithResolvers<void>;
	const initialModel = getAnthropicModel("claude-sonnet-4-5");
	const targetModel = getAnthropicModel("claude-sonnet-4-6");

	beforeEach(async () => {
		tempDir = TempDir.createSync("@jwc-durable-model-session-");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "auth.db"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		streamCreated = Promise.withResolvers<void>();
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model: initialModel,
				systemPrompt: ["Test"],
				tools: [],
			},
			streamFn: () => {
				activeStream = new AssistantMessageEventStream();
				streamCreated.resolve();
				return activeStream;
			},
		});
		sessionManager = SessionManager.inMemory(tempDir.path());
		settings = Settings.isolated();
		session = new AgentSession({
			agent,
			sessionManager,
			settings,
			modelRegistry: new ModelRegistry(authStorage),
			thinkingLevel: ThinkingLevel.Off,
		});
		sessionManager.appendMessage({ role: "user", content: "existing transcript", timestamp: Date.now() });
	});

	afterEach(async () => {
		if (activeStream) {
			const message = createAssistantMessage("cleanup");
			activeStream.push({ type: "done", reason: "stop", message });
			activeStream.end(message);
			activeStream = undefined;
		}
		await session.dispose();
		authStorage.close();
		vi.restoreAllMocks();
		tempDir.removeSync();
	});

	it("defers transcript mutation until the active response ends and persists unchanged thinking", async () => {
		const prompt = session.prompt("in flight");
		await streamCreated.promise;
		const entriesBeforeSelection = sessionManager.getEntries();

		const selection = session.setModel(targetModel, "default", { thinkingLevel: ThinkingLevel.Off });
		await Bun.sleep(0);

		expect(session.model).toBe(initialModel);
		expect(sessionManager.getEntries()).toEqual(entriesBeforeSelection);

		const message = createAssistantMessage("complete");
		activeStream?.push({ type: "done", reason: "stop", message });
		activeStream?.end(message);
		activeStream = undefined;
		await prompt;
		await selection;

		const entries = sessionManager.getEntries();
		const assistantIndex = entries.findIndex(entry => entry.type === "message" && entry.message.role === "assistant");
		const temporaryIndex = entries.findIndex(
			entry => entry.type === "model_change" && entry.role === "temporary" && entry.model.endsWith(targetModel.id),
		);
		const thinkingIndex = entries.findIndex(entry => entry.type === "thinking_level_change");
		const defaultIndex = entries.findIndex(
			entry => entry.type === "model_change" && entry.role === "default" && entry.model.endsWith(targetModel.id),
		);
		expect(temporaryIndex).toBeGreaterThan(assistantIndex);
		expect(thinkingIndex).toBeGreaterThan(temporaryIndex);
		expect(defaultIndex).toBeGreaterThan(thinkingIndex);
		expect(session.thinkingLevel).toBe(ThinkingLevel.Off);
		expect(settings.getGlobal("modelRoles")).toEqual({
			default: `anthropic/${targetModel.id}:off`,
		});
	});

	it("leaves live and transcript state unchanged when the durable save fails", async () => {
		const entriesBeforeSelection = sessionManager.getEntries();
		vi.spyOn(settings, "setGlobalModelRoleAndFlush").mockRejectedValue(new Error("durable write failed"));

		await expect(session.setModel(targetModel, "default", { thinkingLevel: ThinkingLevel.High })).rejects.toThrow(
			"durable write failed",
		);

		expect(session.model).toBe(initialModel);
		expect(session.thinkingLevel).toBe(ThinkingLevel.Off);
		expect(sessionManager.getEntries()).toEqual(entriesBeforeSelection);
	});

	it("restores the prior durable, live, and transcript defaults when live apply fails", async () => {
		const previousSelector = `anthropic/${initialModel.id}:off`;
		settings.setGlobalModelRole("default", previousSelector);
		sessionManager.appendModelChange(`anthropic/${initialModel.id}`, "default");
		const entriesBeforeSelection = sessionManager.getEntries();
		const liveApplyError = new Error("late live apply failure");
		const originalLiveApply = session.setModelTemporary.bind(session);
		vi.spyOn(session, "setModelTemporary").mockImplementation(async (...args) => {
			await originalLiveApply(...args);
			throw liveApplyError;
		});

		await expect(session.setModel(targetModel, "default", { thinkingLevel: ThinkingLevel.High })).rejects.toBe(
			liveApplyError,
		);

		expect(settings.getGlobal("modelRoles")).toEqual({ default: previousSelector });
		expect(session.model).toBe(initialModel);
		expect(session.thinkingLevel).toBe(ThinkingLevel.Off);
		expect(sessionManager.getEntries()).toEqual(entriesBeforeSelection);
	});

	it("restores an unchanged explicit thinking level after reopening the session", async () => {
		const sourceManager = SessionManager.create(tempDir.path(), tempDir.path());
		const sourceSession = new AgentSession({
			agent: new Agent({
				getApiKey: () => "test-key",
				initialState: { model: initialModel, systemPrompt: ["Test"], tools: [] },
			}),
			sessionManager: sourceManager,
			settings,
			modelRegistry: session.modelRegistry,
			thinkingLevel: ThinkingLevel.Off,
		});
		const resumedSession = new AgentSession({
			agent: new Agent({
				getApiKey: () => "test-key",
				initialState: { model: initialModel, systemPrompt: ["Test"], tools: [] },
			}),
			sessionManager: SessionManager.create(tempDir.path(), tempDir.path()),
			settings,
			modelRegistry: session.modelRegistry,
			thinkingLevel: ThinkingLevel.High,
		});

		try {
			const sourceFile = sourceSession.sessionFile;
			if (!sourceFile) throw new Error("Expected persisted source session");
			await sourceSession.setModel(targetModel, "default", { thinkingLevel: ThinkingLevel.Off });
			await sourceManager.flush();

			expect(await resumedSession.switchSession(sourceFile)).toBe(true);
			expect(resumedSession.model?.id).toBe(targetModel.id);
			expect(resumedSession.thinkingLevel).toBe(ThinkingLevel.Off);
		} finally {
			await sourceSession.dispose();
			await resumedSession.dispose();
		}
	});
});
