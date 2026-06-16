import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@gajae-code/ai";
import { resetSettingsForTest, Settings, settings } from "@gajae-code/coding-agent/config/settings";
import { EventController } from "@gajae-code/coding-agent/modes/controllers/event-controller";
import * as themeModule from "@gajae-code/coding-agent/modes/theme/theme";
import type { InteractiveModeContext } from "@gajae-code/coding-agent/modes/types";
import type { AgentSessionEvent } from "@gajae-code/coding-agent/session/agent-session";
import { Container } from "@gajae-code/tui";

/**
 * 99.20.04 commit-time folding: in "commit" render mode an active tool
 * previews in the live zone (liveToolContainer) and enters chat history as a
 * collapsed line only when it finishes — history grows monotonically. The
 * legacy "verbose" mode keeps the 083.1 inline-then-minimize behavior.
 */

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
	await themeModule.initTheme(false, undefined, undefined, "red-claw", "blue-crab");
});

afterAll(() => {
	resetSettingsForTest();
});

function createFixture() {
	const chatContainer = new Container();
	const liveToolContainer = new Container();
	const ctx = {
		isInitialized: true,
		init: async () => {},
		ui: { requestRender() {}, compactViewportFill() {} },
		statusLine: { invalidate() {} },
		updateEditorTopBorder() {},
		flushPendingModelSwitch: async () => {},
		loadingAnimation: undefined,
		streamingComponent: undefined,
		streamingMessage: undefined,
		statusContainer: new Container(),
		editor: { getText: () => "x" }, // non-empty → idle compaction not scheduled
		isBackgrounded: true, // completion notification short-circuits
		chatContainer,
		liveToolContainer,
		pendingTools: new Map(),
		lastToolComponent: undefined,
		toolOutputExpanded: false,
		setWorkingMessage() {},
		settings,
		session: {
			getToolByName: () => undefined,
			isTtsrAbortPending: false,
			retryAttempt: 0,
		},
		sessionManager: { getCwd: () => process.cwd(), getSessionName: () => "test" },
		setTodos() {},
		showWarning() {},
	} as unknown as InteractiveModeContext;
	return { controller: new EventController(ctx), ctx, chatContainer, liveToolContainer };
}

function startEvent(toolCallId: string): Extract<AgentSessionEvent, { type: "tool_execution_start" }> {
	return {
		type: "tool_execution_start",
		toolCallId,
		toolName: "bash",
		args: { command: "ls -la" },
	} as Extract<AgentSessionEvent, { type: "tool_execution_start" }>;
}

function endEvent(toolCallId: string): Extract<AgentSessionEvent, { type: "tool_execution_end" }> {
	return {
		type: "tool_execution_end",
		toolCallId,
		toolName: "bash",
		isError: false,
		result: { content: [{ type: "text", text: "a\nb\nc" }] },
	} as Extract<AgentSessionEvent, { type: "tool_execution_end" }>;
}

function readInternalStartEvent(toolCallId: string): Extract<AgentSessionEvent, { type: "tool_execution_start" }> {
	return {
		type: "tool_execution_start",
		toolCallId,
		toolName: "read",
		args: { path: "agent://audit-output" },
	} as Extract<AgentSessionEvent, { type: "tool_execution_start" }>;
}

function readInternalEndEvent(toolCallId: string): Extract<AgentSessionEvent, { type: "tool_execution_end" }> {
	return {
		type: "tool_execution_end",
		toolCallId,
		toolName: "read",
		isError: false,
		result: { content: [{ type: "text", text: '{\n  "verdict": "FAIL",\n  "findings": []\n}' }] },
	} as Extract<AgentSessionEvent, { type: "tool_execution_end" }>;
}

function assistantToolMessage(toolCallId: string): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{
				type: "toolCall",
				id: toolCallId,
				name: "bash",
				arguments: { command: "echo streamed" },
			},
		],
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
		stopReason: "toolUse",
		timestamp: Date.now(),
	} as unknown as AssistantMessage;
}

function messageStartEvent(message: AssistantMessage): Extract<AgentSessionEvent, { type: "message_start" }> {
	return {
		type: "message_start",
		message,
	} as Extract<AgentSessionEvent, { type: "message_start" }>;
}

function messageUpdateEvent(message: AssistantMessage): Extract<AgentSessionEvent, { type: "message_update" }> {
	return {
		type: "message_update",
		message,
		assistantMessageEvent: { type: "toolcall_delta", contentIndex: 0, delta: "echo" },
	} as Extract<AgentSessionEvent, { type: "message_update" }>;
}

describe("commit-time folding (99.20.04)", () => {
	it("commit mode: active tool previews in the live zone, commits collapsed on completion", async () => {
		settings.set("tool.renderMode", "commit");
		const { controller, chatContainer, liveToolContainer } = createFixture();

		await controller.handleEvent(startEvent("t1"));
		expect(liveToolContainer.children.length).toBe(1);
		expect(chatContainer.children.length).toBe(0); // history untouched while running

		const component = liveToolContainer.children[0];

		await controller.handleEvent(endEvent("t1"));
		expect(liveToolContainer.children.length).toBe(0);
		expect(chatContainer.children).toContain(component);
		// Committed collapsed: rendered height is the minimized two-line form
		// (blank spacer + one summary line), never the multi-line output.
		const committedHeight = (component as { render(width: number): string[] }).render(80).length;
		expect(committedHeight).toBeLessThanOrEqual(2);
	});
	it("commit mode: internal-url read previews in the live zone, commits collapsed on completion", async () => {
		settings.set("tool.renderMode", "commit");
		const { controller, chatContainer, liveToolContainer } = createFixture();

		await controller.handleEvent(readInternalStartEvent("read-internal"));
		expect(liveToolContainer.children.length).toBe(1);
		expect(chatContainer.children.length).toBe(0);

		const component = liveToolContainer.children[0];

		await controller.handleEvent(readInternalEndEvent("read-internal"));
		expect(liveToolContainer.children.length).toBe(0);
		expect(chatContainer.children).toContain(component);
		expect(chatContainer.children.length).toBe(1);
		const committedHeight = (component as { render(width: number): string[] }).render(80).length;
		expect(committedHeight).toBeLessThanOrEqual(2);
	});

	it("commit mode: provider-streamed tool calls preview in the live zone before tool_execution_start", async () => {
		settings.set("tool.renderMode", "commit");
		const { controller, chatContainer, liveToolContainer } = createFixture();
		const message = assistantToolMessage("t-streamed");

		await controller.handleEvent(messageStartEvent(message));
		expect(chatContainer.children.length).toBe(1); // assistant streaming shell only
		expect(liveToolContainer.children.length).toBe(0);

		await controller.handleEvent(messageUpdateEvent(message));
		expect(chatContainer.children.length).toBe(1); // active preview must not mutate history
		expect(liveToolContainer.children.length).toBe(1);

		const component = liveToolContainer.children[0];

		await controller.handleEvent(endEvent("t-streamed"));
		expect(liveToolContainer.children.length).toBe(0);
		expect(chatContainer.children).toContain(component);
		expect(chatContainer.children.length).toBe(2);
	});

	it("commit mode: agent_end commits any leftover live-zone tools (abort path)", async () => {
		settings.set("tool.renderMode", "commit");
		const { controller, chatContainer, liveToolContainer } = createFixture();

		await controller.handleEvent(startEvent("t2"));
		expect(liveToolContainer.children.length).toBe(1);

		await controller.handleEvent({ type: "agent_end", messages: [] } as unknown as AgentSessionEvent);
		expect(liveToolContainer.children.length).toBe(0);
		expect(chatContainer.children.length).toBe(1);
	});

	it("verbose mode: tools render inline in the chat as before (083.1)", async () => {
		settings.set("tool.renderMode", "verbose");
		const { controller, chatContainer, liveToolContainer } = createFixture();

		await controller.handleEvent(startEvent("t3"));
		expect(chatContainer.children.length).toBe(1);
		expect(liveToolContainer.children.length).toBe(0);

		await controller.handleEvent(endEvent("t3"));
		expect(chatContainer.children.length).toBe(1); // stays where it was
		expect(liveToolContainer.children.length).toBe(0);
	});
});
