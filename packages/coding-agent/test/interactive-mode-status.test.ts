import { beforeAll, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentMessage } from "@jawcode-dev/agent-core";
import { renderSegment } from "@jawcode-dev/coding-agent/modes/components/status-line/segments";
import type { SegmentContext } from "@jawcode-dev/coding-agent/modes/components/status-line/types";
import { EventController } from "@jawcode-dev/coding-agent/modes/controllers/event-controller";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";
import { UiHelpers } from "@jawcode-dev/coding-agent/modes/utils/ui-helpers";
import { buildSessionContext, type SessionContext } from "@jawcode-dev/coding-agent/session/session-manager";
import { Container } from "@jawcode-dev/tui";

function renderLastLine(container: Container, width = 120): string {
	const last = container.children[container.children.length - 1];
	if (!last) return "";
	return last.render(width).join("\n");
}

function renderContainer(container: Container, width = 120): string {
	return container.render(width).join("\n");
}

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function pabcdCtx(stage: "i" | "p"): SegmentContext {
	return { pabcd: { active: true, stage }, options: {} } as unknown as SegmentContext;
}

function createInitialRenderHarness(): { ctx: InteractiveModeContext; helpers: UiHelpers } {
	let helpers: UiHelpers;
	const ctx = {
		chatContainer: new Container(),
		pendingMessagesContainer: new Container(),
		pendingBashComponents: [],
		pendingPythonComponents: [],
		pendingTools: new Map(),
		ui: { requestRender: vi.fn() },
		isBackgrounded: false,
		sessionManager: {
			buildSessionContext: () => buildSessionContext([]),
			getEntries: () => [],
		},
		statusLine: { invalidate: vi.fn() },
		updateEditorBorderColor: vi.fn(),
		renderSessionContext: (
			context: SessionContext,
			options?: { updateFooter?: boolean; populateHistory?: boolean },
		) => helpers.renderSessionContext(context, options),
		addMessageToChat: (message: AgentMessage) => helpers.addMessageToChat(message),
		settings: { get: () => false },
		session: {
			retryAttempt: 0,
			buildDisplaySessionContext: () => buildSessionContext([]),
			getToolByName: () => undefined,
		},
		toolOutputExpanded: false,
		hideThinkingBlock: false,
	} as unknown as InteractiveModeContext;
	helpers = new UiHelpers(ctx);
	return { ctx, helpers };
}

describe("InteractiveMode.showStatus", () => {
	beforeAll(async () => {
		// showStatus uses the global theme instance
		await initTheme();
	});

	test("coalesces immediately-sequential status messages", () => {
		const ctx = {
			chatContainer: new Container(),
			ui: { requestRender: vi.fn() },
			isBackgrounded: false,
			lastStatusSpacer: undefined,
			lastStatusText: undefined,
		} as unknown as InteractiveModeContext;
		const helpers = new UiHelpers(ctx);

		helpers.showStatus("STATUS_ONE");
		expect(ctx.chatContainer.children).toHaveLength(2);
		expect(renderLastLine(ctx.chatContainer)).toContain("STATUS_ONE");

		helpers.showStatus("STATUS_TWO");
		// second status updates the previous line instead of appending
		expect(ctx.chatContainer.children).toHaveLength(2);
		expect(renderLastLine(ctx.chatContainer)).toContain("STATUS_TWO");
		expect(renderLastLine(ctx.chatContainer)).not.toContain("STATUS_ONE");
	});

	test("appends a new status line if something else was added in between", () => {
		const ctx = {
			chatContainer: new Container(),
			ui: { requestRender: vi.fn() },
			isBackgrounded: false,
			lastStatusSpacer: undefined,
			lastStatusText: undefined,
		} as unknown as InteractiveModeContext;
		const helpers = new UiHelpers(ctx);

		helpers.showStatus("STATUS_ONE");
		expect(ctx.chatContainer.children).toHaveLength(2);

		// Something else gets added to the chat in between status updates
		ctx.chatContainer.addChild({ render: () => ["OTHER"], invalidate: () => {} });
		expect(ctx.chatContainer.children).toHaveLength(3);

		helpers.showStatus("STATUS_TWO");
		// adds spacer + text
		expect(ctx.chatContainer.children).toHaveLength(5);
		expect(renderLastLine(ctx.chatContainer)).toContain("STATUS_TWO");
	});

	test("preserves startup notifications while rendering the initial transcript", () => {
		const { ctx, helpers } = createInitialRenderHarness();

		helpers.showWarning("startup notification probe");
		helpers.renderInitialMessages(undefined, { preserveExistingChat: true });

		expect(renderContainer(ctx.chatContainer)).toContain("startup notification probe");
	});

	test("preserves optimistic user signatures when rebuilding transcript state", () => {
		const ctx = {
			chatContainer: new Container(),
			pendingTools: new Map(),
			ui: { requestRender: vi.fn() },
			optimisticUserMessageSignature: "hello\u00001",
		} as unknown as InteractiveModeContext;
		const helpers = new UiHelpers(ctx);

		helpers.renderSessionContext(buildSessionContext([]));

		// renderSessionContext must not clear the signature — the message_start
		// handler owns this lifecycle and uses it to guard against clearing the
		// user's in-progress editor draft during an optimistic send (#783).
		expect(ctx.optimisticUserMessageSignature).toBe("hello\u00001");
	});
});

describe("InteractiveMode PABCD status refresh", () => {
	test("command tool completion refreshes pabcd state", async () => {
		const refreshPabcdNow = vi.fn();
		const ctx = {
			isInitialized: true,
			statusLine: { invalidate: vi.fn(), refreshPabcdNow },
			updateEditorTopBorder: vi.fn(),
			pendingTools: new Map(),
			ui: { requestRender: vi.fn() },
			setTodos: vi.fn(),
		} as unknown as InteractiveModeContext;
		const controller = new EventController(ctx);

		await controller.handleEvent({
			type: "tool_execution_end",
			toolCallId: "bash-1",
			toolName: "bash",
			result: { content: [], details: {} },
			isError: false,
		} as never);

		expect(refreshPabcdNow).toHaveBeenCalledTimes(1);
	});

	test("pabcd stage-change callback requests render with editor chrome update", async () => {
		const source = await fs.readFile(path.resolve(import.meta.dir, "../src/modes/interactive-mode.ts"), "utf-8");
		const callbackStart = source.indexOf("this.statusLine.onPabcdStageChange(() => {");
		expect(callbackStart).toBeGreaterThanOrEqual(0);
		const callbackEnd = source.indexOf("});", callbackStart);
		const callback = source.slice(callbackStart, callbackEnd);
		expect(callback).toContain("this.updateEditorChrome();");
		expect(callback).toContain("this.ui.requestRender();");
	});

	test("rendered pabcd segment changes from INTERV to PLAN", () => {
		const interview = stripAnsi(renderSegment("pabcd", pabcdCtx("i")).content);
		const plan = stripAnsi(renderSegment("pabcd", pabcdCtx("p")).content);
		expect(interview).toContain("INTERV");
		expect(plan).toContain("PLAN");
		expect(plan).not.toContain("INTERV");
	});
});
