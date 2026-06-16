import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent } from "@jawcode-dev/agent-core";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import { TempDir } from "@jawcode-dev/utils";
import { ModelRegistry } from "../src/config/model-registry";
import { UserMessageComponent } from "../src/modes/components/user-message";
import { InteractiveMode } from "../src/modes/interactive-mode";
import { AgentSession } from "../src/session/agent-session";
import { AuthStorage } from "../src/session/auth-storage";
import type { SessionContext } from "../src/session/session-manager";
import { SessionManager } from "../src/session/session-manager";

type ExpandableProbe = {
	setExpanded: ReturnType<typeof vi.fn>;
	setMinimized: ReturnType<typeof vi.fn>;
	invalidate(): void;
	render(width: number): string[];
};

function probe(): ExpandableProbe {
	return {
		setExpanded: vi.fn(),
		setMinimized: vi.fn(),
		invalidate: vi.fn(),
		render: () => ["probe"],
	};
}

function assistantMessage(text: string): SessionContext["messages"][number] {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "test",
		provider: "test",
		model: "test",
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
	} as SessionContext["messages"][number];
}

function userMessage(text: string, synthetic = false): SessionContext["messages"][number] {
	return {
		role: "user",
		content: [{ type: "text", text }],
		...(synthetic ? { synthetic: true } : {}),
		timestamp: Date.now(),
	} as SessionContext["messages"][number];
}

function context(messages: SessionContext["messages"]): SessionContext {
	return {
		messages,
		models: {},
		injectedTtsrRules: [],
		selectedMCPToolNames: [],
		hasPersistedMCPToolSelection: false,
		mode: "none",
	};
}

describe("InteractiveMode current-turn Ctrl+O boundary", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession;
	let mode: InteractiveMode;

	beforeAll(() => {
		initTheme();
	});

	beforeEach(async () => {
		resetSettingsForTest();
		tempDir = TempDir.createSync("@jwc-ctrlo-boundary-");
		await Settings.init({ inMemory: true, cwd: tempDir.path() });
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "testauth.db"));
		const modelRegistry = new ModelRegistry(authStorage);
		const model = modelRegistry.find("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected claude-sonnet-4-5 to exist in registry");
		session = new AgentSession({
			agent: new Agent({
				initialState: {
					model,
					systemPrompt: ["Test"],
					tools: [],
					messages: [],
				},
			}),
			sessionManager: SessionManager.create(tempDir.path(), tempDir.path()),
			settings: Settings.isolated(),
			modelRegistry,
		});
		mode = new InteractiveMode(session, "test");
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		mode?.stop();
		await session?.dispose();
		authStorage?.close();
		tempDir?.removeSync();
		resetSettingsForTest();
	});

	it("moves the Ctrl+O boundary immediately after optimistic real-user submit", () => {
		const older = probe();
		mode.chatContainer.addChild(older);
		mode.currentTurnStartIndex = 0;

		mode.startPendingSubmission({ text: "next user" });

		expect(mode.currentTurnStartIndex).toBe(mode.chatContainer.children.length);
		const current = probe();
		mode.chatContainer.addChild(current);
		mode.toggleToolOutputExpansion();
		expect(older.setExpanded).not.toHaveBeenCalled();
		expect(current.setExpanded).toHaveBeenCalledWith(true);

		const previousBoundary = mode.currentTurnStartIndex;
		mode.startPendingSubmission({ text: "custom", customType: "hidden", display: false });
		expect(mode.currentTurnStartIndex).toBe(previousBoundary);
	});

	it("resets current-turn boundary after renderInitialMessages rebuilds chat", () => {
		vi.spyOn(session, "buildDisplaySessionContext").mockReturnValue(
			context([
				assistantMessage("older"),
				userMessage("replay", true),
				userMessage("real"),
				assistantMessage("current"),
			]),
		);

		mode.renderInitialMessages();

		const userIndexes = mode.chatContainer.children
			.map((child, index) => ({ child, index }))
			.filter(({ child }) => child instanceof UserMessageComponent && !child.isSyntheticUserMessage)
			.map(({ index }) => index);
		expect(userIndexes).toHaveLength(1);
		expect(mode.currentTurnStartIndex).toBe(userIndexes[0]! + 1);

		const older = probe();
		const current = probe();
		mode.chatContainer.children.splice(0, 0, older);
		mode.chatContainer.addChild(current);
		mode.toggleToolOutputExpansion();
		expect(older.setExpanded).not.toHaveBeenCalled();
		expect(current.setExpanded).toHaveBeenCalledWith(true);
	});

	it("resets current-turn boundary after rebuildChatFromMessages", () => {
		vi.spyOn(session, "buildDisplaySessionContext").mockReturnValue(
			context([assistantMessage("older"), userMessage("real"), assistantMessage("current")]),
		);

		mode.rebuildChatFromMessages();

		const realUserIndex = mode.chatContainer.children.findIndex(
			child => child instanceof UserMessageComponent && !child.isSyntheticUserMessage,
		);
		expect(realUserIndex).toBeGreaterThanOrEqual(0);
		expect(mode.currentTurnStartIndex).toBe(realUserIndex + 1);
	});
});
