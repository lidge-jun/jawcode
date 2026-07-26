import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { resetSettingsForTest, Settings, settings } from "@jawcode-dev/coding-agent/config/settings";
import { EventController } from "@jawcode-dev/coding-agent/modes/controllers/event-controller";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import { TERMINAL } from "@jawcode-dev/tui";

function assistant(stopReason: "stop" | "error"): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: stopReason }],
		stopReason,
		usage: { inputTokens: 0, outputTokens: 0 },
		timestamp: Date.now(),
	} as unknown as AssistantMessage;
}

describe("EventController settled agent_end outcome", () => {
	beforeEach(async () => {
		resetSettingsForTest();
		await Settings.init({ inMemory: true });
		settings.override("completion.notify", "on");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		resetSettingsForTest();
	});

	it("suppresses false completion when settled messages end in error but session state is stale-successful", async () => {
		const successful = assistant("stop");
		const errored = assistant("error");
		const notification = vi.spyOn(TERMINAL, "sendNotification").mockImplementation(() => {});
		const context = {
			isInitialized: true,
			isBackgrounded: true,
			loadingAnimation: undefined,
			streamingComponent: undefined,
			streamingMessage: undefined,
			pendingTools: new Map<string, unknown>(),
			flushPendingModelSwitch: async () => {},
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
				getLastAssistantMessage: () => successful,
				agent: { state: { messages: [successful] } },
			},
		} as unknown as InteractiveModeContext;

		const controller = new EventController(context);
		await controller.handleEvent({ type: "agent_end", messages: [errored] });

		expect(notification).not.toHaveBeenCalled();
	});
});
