/**
 * Regression test for terminal-title attention ownership.
 *
 * Bug class: JWC runs shared tools concurrently (`agent-loop.ts` collects
 * `sharedTasks` and awaits `Promise.allSettled`), so two `ask` prompts can block
 * the user at the same time. Tracking a single "is an ask open" flag lets the
 * FIRST prompt to resolve clear the attention title while the SECOND is still
 * waiting — the terminal then claims it is working when it is actually blocked.
 * The fix tracks a set of tool call ids and only restores `working` when the last
 * one resolves.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { EventController } from "@jawcode-dev/coding-agent/modes/controllers/event-controller";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import * as titleGenerator from "@jawcode-dev/coding-agent/utils/title-generator";

beforeAll(() => {
	initTheme();
});

beforeEach(async () => {
	resetSettingsForTest();
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-title-attention-"));
	await Settings.init({ inMemory: true, cwd: tempDir });
});

afterEach(() => {
	vi.restoreAllMocks();
	resetSettingsForTest();
});

function makeContext(): InteractiveModeContext {
	return {
		isInitialized: true,
		isBackgrounded: false,
		pendingTools: new Map(),
		statusLine: { invalidate: () => {}, markActivityStart: () => {} },
		ui: { requestRender: () => {} },
		setWorkingMessage: () => {},
		updateEditorTopBorder: () => {},
		toolOutputExpanded: false,
		liveToolContainer: { addChild: () => {}, removeChild: () => {}, clear: () => {} },
		chatContainer: { addChild: () => {}, removeChild: () => {}, clear: () => {} },
		statusContainer: { addChild: () => {}, removeChild: () => {}, clear: () => {} },
		sessionManager: {
			getSessionName: () => "test-session",
			getCwd: () => process.cwd(),
			getSessionId: () => "session-test",
		},
		session: {
			getToolByName: () => undefined,
		},
	} as unknown as InteractiveModeContext;
}

function askStart(toolCallId: string) {
	return { type: "tool_execution_start", toolCallId, toolName: "ask", args: {} } as never;
}

function askEnd(toolCallId: string) {
	return {
		type: "tool_execution_end",
		toolCallId,
		toolName: "ask",
		isError: false,
		result: { content: [], details: undefined },
	} as never;
}

describe("EventController — terminal title attention ownership", () => {
	it("keeps attention until the LAST concurrent ask resolves", async () => {
		const states: string[] = [];
		vi.spyOn(titleGenerator, "setTerminalTitleState").mockImplementation(state => {
			states.push(state);
		});
		const controller = new EventController(makeContext());

		await controller.handleEvent(askStart("ask-1"));
		await controller.handleEvent(askStart("ask-2"));
		expect(states.at(-1)).toBe("attention");

		// First prompt resolves while the second still blocks the user.
		await controller.handleEvent(askEnd("ask-1"));
		expect(states.at(-1)).toBe("attention");

		// Only the last resolution hands the turn back to the agent.
		await controller.handleEvent(askEnd("ask-2"));
		expect(states.at(-1)).toBe("working");
	});

	it("ignores an unknown tool call id instead of clearing attention", async () => {
		const states: string[] = [];
		vi.spyOn(titleGenerator, "setTerminalTitleState").mockImplementation(state => {
			states.push(state);
		});
		const controller = new EventController(makeContext());

		await controller.handleEvent(askStart("ask-1"));
		await controller.handleEvent(askEnd("stale-id"));
		expect(states.at(-1)).toBe("attention");
	});
});
