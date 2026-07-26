import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { resetSettingsForTest, Settings, settings } from "@jawcode-dev/coding-agent/config/settings";
import { EventController } from "@jawcode-dev/coding-agent/modes/controllers/event-controller";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import type { AgentSessionEvent } from "@jawcode-dev/coding-agent/session/agent-session";
import { TERMINAL } from "@jawcode-dev/tui";

type AgentEndMessages = Extract<AgentSessionEvent, { type: "agent_end" }>["messages"];

function assistant(stopReason: "stop" | "error" | "aborted"): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: stopReason }],
		stopReason,
		usage: { inputTokens: 0, outputTokens: 0 },
		timestamp: Date.now(),
	} as unknown as AssistantMessage;
}

function makeContext(staleSuccessful: AssistantMessage): InteractiveModeContext {
	return {
		isInitialized: true,
		isBackgrounded: true,
		loadingAnimation: undefined,
		streamingComponent: undefined,
		streamingMessage: undefined,
		pendingTools: new Map<string, unknown>(),
		flushPendingModelSwitch: async () => {},
		shutdown: vi.fn(async () => {}),
		ui: { requestRender: vi.fn(), setStreamingActive: vi.fn(), flushHistoryLane: vi.fn() },
		chatContainer: { removeChild: vi.fn() },
		statusContainer: { clear: vi.fn() },
		statusLine: { invalidate: vi.fn() },
		updateEditorTopBorder: vi.fn(),
		editor: { getText: () => "" },
		sessionManager: {
			getSessionName: () => "stale-session",
			getCwd: () => process.cwd(),
			getSessionId: () => "session-test",
		},
		session: {
			isCompacting: false,
			isStreaming: false,
			queuedMessageCount: 0,
			getLastAssistantMessage: () => staleSuccessful,
			agent: { state: { messages: [staleSuccessful] } },
		},
	} as unknown as InteractiveModeContext;
}

function userMessage(): AgentEndMessages[number] {
	return { role: "user", content: "follow-up", timestamp: Date.now() } as AgentEndMessages[number];
}

function toolMessage(): AgentEndMessages[number] {
	return {
		role: "toolResult",
		toolCallId: "tool-1",
		toolName: "read",
		content: [{ type: "text", text: "result" }],
		isError: false,
		timestamp: Date.now(),
	} as AgentEndMessages[number];
}

describe("EventController settled agent_end outcome", () => {
	let notification: ReturnType<typeof vi.spyOn>;
	let successful: AssistantMessage;

	beforeEach(async () => {
		resetSettingsForTest();
		await Settings.init({ inMemory: true });
		settings.override("completion.notify", "on");
		notification = vi.spyOn(TERMINAL, "sendNotification").mockImplementation(() => {});
		successful = assistant("stop");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		resetSettingsForTest();
	});

	it("suppresses an errored settled turn even when session state is stale-successful", async () => {
		const controller = new EventController(makeContext(successful));
		await controller.handleEvent({ type: "agent_end", messages: [assistant("error")] });
		expect(notification).not.toHaveBeenCalled();
	});

	it("fails closed for an empty settled payload", () => {
		new EventController(makeContext(successful)).sendCompletionNotification([]);
		expect(notification).not.toHaveBeenCalled();
	});

	it("uses the terminal assistant when a non-assistant message is last", () => {
		new EventController(makeContext(successful)).sendCompletionNotification([assistant("error"), userMessage()]);
		expect(notification).not.toHaveBeenCalled();
	});

	it("suppresses an aborted terminal assistant", () => {
		new EventController(makeContext(successful)).sendCompletionNotification([assistant("aborted")]);
		expect(notification).not.toHaveBeenCalled();
	});

	it("fails closed for a tool-only settled tail", () => {
		new EventController(makeContext(successful)).sendCompletionNotification([toolMessage()]);
		expect(notification).not.toHaveBeenCalled();
	});

	it("threads the errored settled payload through the background path", async () => {
		const context = makeContext(successful);
		const controller = new EventController(context);
		await controller.handleBackgroundEvent({ type: "agent_end", messages: [assistant("error")] });
		expect(notification).not.toHaveBeenCalled();
		expect(context.shutdown).toHaveBeenCalledTimes(1);
	});
});
