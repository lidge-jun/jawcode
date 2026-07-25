import { afterEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent } from "@jawcode-dev/agent-core";
import * as ai from "@jawcode-dev/ai";
import { getBundledModel } from "@jawcode-dev/ai";
import { createMockModel } from "@jawcode-dev/ai/providers/mock";
import { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AgentSession } from "@jawcode-dev/coding-agent/session/agent-session";
import { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { SessionManager } from "@jawcode-dev/coding-agent/session/session-manager";
import { TempDir } from "@jawcode-dev/utils";
import { createAssistantMessage } from "./helpers/agent-session-setup";

let session: AgentSession | undefined;
let authStorage: AuthStorage | undefined;
let tempDir: TempDir | undefined;

afterEach(async () => {
	vi.restoreAllMocks();
	await session?.dispose();
	authStorage?.close();
	tempDir?.removeSync();
	session = undefined;
	authStorage = undefined;
	tempDir = undefined;
});

async function createSession(): Promise<AgentSession> {
	tempDir = TempDir.createSync("@jwc-title-lifecycle-");
	authStorage = await AuthStorage.create(path.join(tempDir.path(), "auth.db"));
	authStorage.setRuntimeApiKey("anthropic", "test-key");
	const model = getBundledModel("anthropic", "claude-sonnet-4-5");
	if (!model) throw new Error("Expected bundled Anthropic model");
	const settings = Settings.isolated({ "compaction.enabled": false });
	settings.setModelRole("default", `${model.provider}/${model.id}`);
	const agent = new Agent({
		getApiKey: () => "test-key",
		initialState: { model, systemPrompt: ["Test"], tools: [], messages: [] },
		streamFn: createMockModel({ responses: [{ content: ["Done"] }] }).stream,
	});
	return new AgentSession({
		agent,
		sessionManager: SessionManager.inMemory(),
		settings,
		modelRegistry: new ModelRegistry(authStorage),
	});
}

describe("AgentSession title generation lifecycle", () => {
	it("aborts an in-flight title request when disposal begins", async () => {
		session = await createSession();
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<ai.AssistantMessage>();
		let requestSignal: AbortSignal | undefined;
		vi.spyOn(ai, "completeSimple").mockImplementation((_model, _context, options) => {
			requestSignal = options?.signal;
			requestSignal?.addEventListener("abort", () => response.resolve(createAssistantMessage("")), { once: true });
			started.resolve();
			return response.promise;
		});

		const generation = session.generateTitle("Investigate shutdown");
		await started.promise;
		const disposal = session.dispose();

		expect(requestSignal?.aborted).toBe(true);
		expect(await generation).toBeNull();
		await disposal;
	});

	it("rejects a late title result after switching to a new session", async () => {
		session = await createSession();
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<ai.AssistantMessage>();
		let requestSignal: AbortSignal | undefined;
		vi.spyOn(ai, "completeSimple").mockImplementation((_model, _context, options) => {
			requestSignal = options?.signal;
			started.resolve();
			return response.promise;
		});

		const generation = session.generateTitle("Investigate session replacement");
		await started.promise;
		expect(await session.newSession()).toBe(true);
		expect(requestSignal?.aborted).toBe(true);

		response.resolve({
			...createAssistantMessage(""),
			content: [{ type: "toolCall", id: "title", name: "set_title", arguments: { title: "Stale title" } }],
		});
		expect(await generation).toBeNull();
		expect(session.sessionName).toBeUndefined();
	});
});
