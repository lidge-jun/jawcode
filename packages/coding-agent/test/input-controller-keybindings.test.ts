import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import type { Component, OverlayHandle } from "@gajae-code/tui";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import { BashExecutionComponent } from "../src/modes/components/bash-execution";
import { EvalExecutionComponent } from "../src/modes/components/eval-execution";
import { ToolExecutionComponent } from "../src/modes/components/tool-execution";
import { InputController } from "../src/modes/controllers/input-controller";
import { initTheme } from "../src/modes/theme/theme";
import type { InteractiveModeContext } from "../src/modes/types";
import { SessionManager } from "../src/session/session-manager";
import { MemorySessionStorage } from "../src/session/session-storage";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
	initTheme();
});

afterAll(() => {
	resetSettingsForTest();
});

type FakeEditor = {
	onEscape?: () => void;
	shouldBypassAutocompleteOnEscape?: () => boolean;
	onClear?: () => void;
	onExit?: () => void;
	onSuspend?: () => void;
	onCycleThinkingLevel?: () => void;
	onCycleModelForward?: () => void;
	onCycleModelBackward?: () => void;
	onSelectModelTemporary?: () => void;
	onSelectModel?: () => void;
	onHistorySearch?: () => void;
	onShowHotkeys?: () => void;
	onPasteImage?: () => Promise<boolean>;
	onPasteText?: (text: string) => boolean | Promise<boolean>;
	onCopyPrompt?: () => void;
	onExpandTools?: () => void;
	onToggleThinking?: () => void;
	onFullTranscript?: () => void;
	onExternalEditor?: () => void;
	onDequeue?: () => void;
	onHangulCtrlChordHint?: (jamo: string, chord: string) => void;
	onChange?: (text: string) => void;
	onSubmit?: (text: string) => void | Promise<void>;
	setText(text: string): void;
	getText(): string;
	insertText(text: string): void;
	addToHistory(text: string): void;
	setActionKeys(action: string, keys: string[]): void;
	setCustomKeyHandler(key: string, handler: () => void): void;
	clearCustomKeyHandlers(): void;
};

async function createContext() {
	let editorText = "";
	const keyMap: Record<string, string[]> = {
		"app.model.selectTemporary": ["ctrl+y"],
		"app.model.select": ["ctrl+l"],
		"app.transcript.full": ["ctrl+t"],
	};
	const setActionKeys = vi.fn();
	const showModelSelector = vi.fn();
	const prompt = vi.fn(async () => {});
	const updatePendingMessagesDisplay = vi.fn();
	const handleBashCommand = vi.fn(async () => {});
	const showStatus = vi.fn();
	const requestRender = vi.fn();
	const setHookStatus = vi.fn();
	const overlayHandle: OverlayHandle = {
		hide: vi.fn(),
		setHidden: vi.fn(),
		isHidden: vi.fn(() => false),
	};
	const showOverlay = vi.fn(
		(_component: Component, _options?: { anchor?: string; width?: string; maxHeight?: string; margin?: number }) =>
			overlayHandle,
	);
	const editorContainerClear = vi.fn();
	const editorContainerAddChild = vi.fn();
	const editor: FakeEditor = {
		setText(text: string) {
			editorText = text;
		},
		getText() {
			return editorText;
		},
		insertText(text: string) {
			editorText += text;
		},
		addToHistory: vi.fn(),
		setActionKeys,
		setCustomKeyHandler: vi.fn(),
		clearCustomKeyHandlers: vi.fn(),
	};
	const ctx = {
		editor: editor as unknown as InteractiveModeContext["editor"],
		ui: {
			requestRender,
			setFocus: vi.fn(),
			compactViewportFill: vi.fn(),
			commitLines: vi.fn(() => true),
			showOverlay,
			terminal: { columns: 80 },
		} as unknown as InteractiveModeContext["ui"],
		loadingAnimation: undefined,
		autoCompactionLoader: undefined,
		retryLoader: undefined,
		autoCompactionEscapeHandler: undefined,
		retryEscapeHandler: undefined,
		session: {
			isStreaming: false,
			isCompacting: false,
			isGeneratingHandoff: false,
			isBashRunning: false,
			isEvalRunning: false,
			abortBash: vi.fn(),
			extensionRunner: undefined,
			prompt,
			getToolByName: vi.fn(() => undefined),
			buildDisplaySessionContext: vi.fn(() => ({
				messages: [{ role: "user", content: "SESSION_MARKER", timestamp: Date.now() }],
				models: {},
				injectedTtsrRules: [],
				selectedMCPToolNames: [],
				hasPersistedMCPToolSelection: false,
				mode: "none",
			})),
		} as unknown as InteractiveModeContext["session"],
		getUserMessageText(message: { content?: unknown }) {
			return typeof message.content === "string" ? message.content : "";
		},
		keybindings: {
			getKeys(action: string) {
				return keyMap[action] ? [...keyMap[action]] : [];
			},
		} as InteractiveModeContext["keybindings"],
		pendingImages: [],
		settings: {
			get(path: string) {
				if (path === "images.autoResize") return false;
				return undefined;
			},
		} as unknown as InteractiveModeContext["settings"],
		sessionManager: {
			getCwd() {
				return "/";
			},
		} as unknown as InteractiveModeContext["sessionManager"],
		locallySubmittedUserSignatures: new Set<string>(),
		isKnownSlashCommand: () => false,
		recordLocalSubmission(this: InteractiveModeContext, text: string, imageCount = 0) {
			if (this.isKnownSlashCommand(text)) return () => {};
			const sig = `${text}\u0000${imageCount}`;
			this.locallySubmittedUserSignatures.add(sig);
			let disposed = false;
			return () => {
				if (disposed) return;
				disposed = true;
				this.locallySubmittedUserSignatures.delete(sig);
			};
		},
		async withLocalSubmission<T>(
			this: InteractiveModeContext,
			text: string,
			fn: () => Promise<T>,
			options?: { imageCount?: number },
		): Promise<T> {
			const dispose = this.recordLocalSubmission(text, options?.imageCount ?? 0);
			try {
				return await fn();
			} catch (err) {
				dispose();
				throw err;
			}
		},
		updatePendingMessagesDisplay,
		isBashMode: false,
		isBashNoContext: false,
		isPythonMode: false,
		handleHotkeysCommand: vi.fn(),
		handlePlanModeCommand: vi.fn(),
		handleClearCommand: vi.fn(),
		showTreeSelector: vi.fn(),
		showUserMessageSelector: vi.fn(),
		showSessionSelector: vi.fn(),
		handleSTTToggle: vi.fn(),
		showDebugSelector: vi.fn(),
		showHistorySearch: vi.fn(),
		toggleThinkingBlockVisibility: vi.fn(),
		hideThinkingBlock: false,
		showModelSelector,
		updateEditorBorderColor: vi.fn(),
		handleBashCommand,
		showWarning: vi.fn(),
		showStatus,
		hasActiveBtw: vi.fn(() => false),
		statusLine: { setHookStatus } as unknown as InteractiveModeContext["statusLine"],
		chatContainer: { children: [] },
		liveToolContainer: { children: [] },
		pendingTools: new Map(),
		currentTurnStartIndex: 0,
		toolOutputExpanded: false,
		streamingComponent: undefined,
		editorContainer: { clear: editorContainerClear, addChild: editorContainerAddChild },
		// 99.20.06: footer disabled in this harness — exercises the legacy hook-status fallback path.
		composerFooter: { isEnabled: () => false } as unknown as InteractiveModeContext["composerFooter"],
	} as unknown as InteractiveModeContext;

	return {
		InputController,
		ctx,
		editor,
		spies: {
			setActionKeys,
			showModelSelector,
			prompt,
			updatePendingMessagesDisplay,
			handleBashCommand,
			showStatus,
			setHookStatus,
			showOverlay,
			editorContainerClear,
			editorContainerAddChild,
			requestRender,
		},
	};
}

function transcriptComponent(
	label: string,
	liveToggleEligible: boolean,
	options: { committed?: boolean } = {},
): Component {
	return {
		committed: options.committed,
		liveToggleEligible,
		render: () => [label],
		renderFullTranscript: () => [label],
	} as unknown as Component;
}

function shownOverlay(spies: { showOverlay: { mock: { calls: Array<[Component, unknown?]> } } }): Component {
	const overlay = spies.showOverlay.mock.calls[0]?.[0];
	if (!overlay) throw new Error("Expected full transcript overlay to be shown");
	return overlay;
}

describe("InputController keybinding setup", () => {
	it("registers temporary and persisted model selector actions separately", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();

		expect(spies.setActionKeys).toHaveBeenCalledWith("app.model.selectTemporary", ["ctrl+y"]);
		expect(spies.setActionKeys).toHaveBeenCalledWith("app.model.select", ["ctrl+l"]);
		expect(editor.onSelectModelTemporary).toBeDefined();
		expect(editor.onSelectModel).toBeDefined();
		expect(editor.onSelectModelTemporary).not.toBe(editor.onSelectModel);

		editor.onSelectModelTemporary?.();
		editor.onSelectModel?.();

		expect(spies.showModelSelector).toHaveBeenNthCalledWith(1, { temporaryOnly: true });
		expect(spies.showModelSelector).toHaveBeenNthCalledWith(2);
	});

	it("registers full transcript as an editor action before custom shortcut handlers", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();

		expect(spies.setActionKeys).toHaveBeenCalledWith("app.transcript.full", ["ctrl+t"]);
		expect(editor.onFullTranscript).toBeDefined();
	});

	it("opens full transcript from display session context", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		expect(ctx.session.buildDisplaySessionContext().messages[0]?.role).toBe("user");
		expect(spies.showOverlay).toHaveBeenCalledWith(expect.any(Object), {
			anchor: "bottom-center",
			width: "100%",
			maxHeight: "100%",
			margin: 0,
		});
		expect(spies.editorContainerClear).not.toHaveBeenCalled();
		expect(spies.editorContainerAddChild).not.toHaveBeenCalled();
	});

	it("includes out-of-band live surfaces without duplicating session-backed live chat", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const liveChat = transcriptComponent("LIVE_CHAT_MARKER", true);
		const committedChat = transcriptComponent("COMMITTED_CHAT_MARKER", false);
		const liveTool = transcriptComponent("LIVE_TOOL_MARKER", true);
		const streaming = transcriptComponent("STREAMING_MARKER", true);
		(ctx.chatContainer.children as Component[]).push(liveChat, committedChat);
		(ctx.liveToolContainer.children as Component[]).push(liveTool);
		ctx.streamingComponent = streaming as InteractiveModeContext["streamingComponent"];
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("SESSION_MARKER");
		expect(output).not.toContain("LIVE_CHAT_MARKER");
		expect(output).toContain("LIVE_TOOL_MARKER");
		expect(output).toContain("STREAMING_MARKER");
		expect(output).not.toContain("COMMITTED_CHAT_MARKER");
	});

	it("omits committed live tail rows from session-backed full transcript", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const committedLiveTool = transcriptComponent("COMMITTED_LIVE_TOOL_MARKER", true, { committed: true });
		const liveTool = transcriptComponent("TRUE_LIVE_TOOL_MARKER", true);
		const committedStreaming = transcriptComponent("COMMITTED_STREAMING_MARKER", true, { committed: true });
		(ctx.liveToolContainer.children as Component[]).push(committedLiveTool, liveTool);
		ctx.streamingComponent = committedStreaming as InteractiveModeContext["streamingComponent"];
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("SESSION_MARKER");
		expect(output).toContain("TRUE_LIVE_TOOL_MARKER");
		expect(output).not.toContain("COMMITTED_LIVE_TOOL_MARKER");
		expect(output).not.toContain("COMMITTED_STREAMING_MARKER");
	});

	it("assembles session replay dependencies and item count through the controller path", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const getToolByName = vi.fn(() => undefined);
		const getMessageRenderer = vi.fn(() => undefined);
		const getUserMessageText = vi.fn((message: { content?: unknown }) =>
			typeof message.content === "string" ? `TEXT:${message.content}` : "",
		);
		const settingsGet = vi.fn((path: string) => {
			if (path === "terminal.showImages") return true;
			if (path === "read.toolResultPreview") return true;
			if (path === "edit.fuzzyThreshold") return 0.7;
			if (path === "edit.fuzzyMatch") return false;
			if (path === "edit.hashlineAutoDropPureInsertDuplicates") return false;
			return undefined;
		});
		(
			ctx.session as unknown as {
				getToolByName: typeof getToolByName;
				extensionRunner: { getMessageRenderer: typeof getMessageRenderer };
				buildDisplaySessionContext: ReturnType<typeof vi.fn>;
				retryAttempt: number;
			}
		).getToolByName = getToolByName;
		(
			ctx.session as unknown as {
				extensionRunner: { getMessageRenderer: typeof getMessageRenderer; getShortcuts: () => [] };
			}
		).extensionRunner = {
			getMessageRenderer,
			getShortcuts: () => [],
		};
		(ctx.session as unknown as { buildDisplaySessionContext: ReturnType<typeof vi.fn> }).buildDisplaySessionContext =
			vi.fn(() => ({
				messages: [
					{ role: "user", content: "SESSION_DEPS", timestamp: Date.now() },
					{
						role: "custom",
						customType: "custom-deps",
						content: "CUSTOM_DEPS",
						display: true,
						timestamp: Date.now(),
					},
					{
						role: "assistant",
						content: [
							{
								type: "toolCall",
								id: "deps-tool",
								name: "bash",
								arguments: { command: "printf DEPS" },
							},
						],
						timestamp: Date.now(),
					},
				],
				models: {},
				injectedTtsrRules: [],
				selectedMCPToolNames: [],
				hasPersistedMCPToolSelection: false,
				mode: "none",
			}));
		(ctx as unknown as { getUserMessageText: typeof getUserMessageText }).getUserMessageText = getUserMessageText;
		(ctx.settings as unknown as { get: typeof settingsGet }).get = settingsGet;
		(ctx.chatContainer.children as Component[]).push(transcriptComponent("LIVE_DEP_MARKER", true));
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("Full transcript (3 entries");
		expect(output).toContain("TEXT:SESSION_DEPS");
		expect(output).toContain("CUSTOM_DEPS");
		expect(output).not.toContain("LIVE_DEP_MARKER");
		expect(getUserMessageText).toHaveBeenCalled();
		expect(getToolByName).toHaveBeenCalledWith("bash");
		expect(getMessageRenderer).toHaveBeenCalledWith("custom-deps");
		expect(settingsGet).toHaveBeenCalledWith("terminal.showImages");
		expect(settingsGet).toHaveBeenCalledWith("edit.fuzzyThreshold");
		expect(settingsGet).toHaveBeenCalledWith("edit.fuzzyMatch");
		expect(settingsGet).toHaveBeenCalledWith("edit.hashlineAutoDropPureInsertDuplicates");
	});

	it("forces expanded read and compaction content in full transcript", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const settingsGet = vi.fn((path: string) => {
			if (path === "terminal.showImages") return false;
			if (path === "read.toolResultPreview") return false;
			if (path === "edit.fuzzyThreshold") return 0.8;
			if (path === "edit.fuzzyMatch") return true;
			if (path === "edit.hashlineAutoDropPureInsertDuplicates") return true;
			return undefined;
		});
		(ctx.settings as unknown as { get: typeof settingsGet }).get = settingsGet;
		(ctx.session as unknown as { buildDisplaySessionContext: ReturnType<typeof vi.fn> }).buildDisplaySessionContext =
			vi.fn(() => ({
				messages: [
					{
						role: "assistant",
						content: [{ type: "toolCall", id: "read-full", name: "read", arguments: { path: "src/full.ts" } }],
						timestamp: Date.now(),
					},
					{
						role: "toolResult",
						toolCallId: "read-full",
						toolName: "read",
						content: [
							{
								type: "text",
								text: "READ_FULL_LINE_1\nREAD_FULL_LINE_2\nREAD_FULL_LINE_3\nREAD_FULL_LINE_4",
							},
						],
						isError: false,
						timestamp: Date.now(),
					},
					{
						role: "compactionSummary",
						summary: "COMPACTION_FULL_SUMMARY",
						shortSummary: "COMPACTION_SHORT_SUMMARY",
						tokensBefore: 1000,
						tokensAfter: 100,
						timestamp: Date.now(),
					},
				],
				models: {},
				injectedTtsrRules: [],
				selectedMCPToolNames: [],
				hasPersistedMCPToolSelection: false,
				mode: "none",
			}));
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("READ_FULL_LINE_1");
		expect(output).toContain("READ_FULL_LINE_4");
		expect(output).toContain("COMPACTION_FULL_SUMMARY");
		expect(output).not.toContain("COMPACTION_SHORT_SUMMARY");
		expect(output).not.toContain("ctrl+o to expand");
		expect(settingsGet).not.toHaveBeenCalledWith("read.toolResultPreview");
	});

	it("expands historical content from a reopened persisted session in full transcript", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const settingsGet = vi.fn((path: string) => {
			if (path === "terminal.showImages") return false;
			if (path === "read.toolResultPreview") return false;
			if (path === "edit.fuzzyThreshold") return 0.8;
			if (path === "edit.fuzzyMatch") return true;
			if (path === "edit.hashlineAutoDropPureInsertDuplicates") return true;
			return undefined;
		});
		(ctx.settings as unknown as { get: typeof settingsGet }).get = settingsGet;
		const getToolByName = vi.fn(() => undefined);
		(ctx.session as unknown as { getToolByName: typeof getToolByName }).getToolByName = getToolByName;
		(
			ctx.session as unknown as {
				extensionRunner: { getMessageRenderer: ReturnType<typeof vi.fn>; getShortcuts: ReturnType<typeof vi.fn> };
			}
		).extensionRunner = {
			getMessageRenderer: vi.fn(() => undefined),
			getShortcuts: vi.fn(() => []),
		};
		(ctx as unknown as { getUserMessageText: (message: { content?: unknown }) => string }).getUserMessageText =
			message => `TEXT:${typeof message.content === "string" ? message.content : ""}`;
		(ctx as unknown as { hideThinkingBlock: boolean }).hideThinkingBlock = true;

		const zeroUsage = {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			premiumRequests: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};
		const toolLines = (prefix: string) =>
			Array.from({ length: 20 }, (_value, index) => `${prefix}_${index}`).join("\n");
		const storage = new MemorySessionStorage();
		const session = SessionManager.create("/cwd", "/sessions", storage);
		session.appendMessage({ role: "user", content: "old prompt", timestamp: 1 });
		session.appendMessage({
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "OLD_THINK_1\nOLD_THINK_2\nOLD_THINK_3" },
				{ type: "toolCall", id: "old-generic", name: "generic_tool", arguments: { query: "old" } },
				{ type: "toolCall", id: "old-read", name: "read", arguments: { path: "src/old.ts" } },
				{ type: "toolCall", id: "old-bash", name: "bash", arguments: { command: "printf old" } },
				{ type: "toolCall", id: "old-eval", name: "eval", arguments: { language: "js", code: "old" } },
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-test",
			usage: zeroUsage,
			stopReason: "stop",
			timestamp: 2,
		});
		session.appendMessage({
			role: "toolResult",
			toolCallId: "old-generic",
			toolName: "generic_tool",
			content: [{ type: "text", text: toolLines("OLD_TOOL_LINE") }],
			isError: false,
			timestamp: 3,
		});
		session.appendMessage({
			role: "toolResult",
			toolCallId: "old-read",
			toolName: "read",
			content: [{ type: "text", text: toolLines("OLD_READ_LINE") }],
			isError: false,
			timestamp: 4,
		});
		session.appendMessage({
			role: "toolResult",
			toolCallId: "old-bash",
			toolName: "bash",
			content: [{ type: "text", text: toolLines("OLD_BASH_LINE") }],
			isError: false,
			timestamp: 5,
		});
		session.appendMessage({
			role: "toolResult",
			toolCallId: "old-eval",
			toolName: "eval",
			content: [{ type: "text", text: toolLines("OLD_EVAL_LINE") }],
			isError: false,
			timestamp: 6,
		});
		await session.flush();
		const sessionFile = session.getSessionFile()!;
		await session.close();
		const reopened = await SessionManager.open(sessionFile, "/sessions", storage);

		(ctx.session as unknown as { buildDisplaySessionContext: ReturnType<typeof vi.fn> }).buildDisplaySessionContext =
			vi.fn(() => reopened.buildVisibleTranscriptContext());
		(ctx.chatContainer.children as Component[]).push(transcriptComponent("LIVE_CHAT_MARKER", true));
		(ctx.liveToolContainer.children as Component[]).push(transcriptComponent("LIVE_TOOL_MARKER", true));

		const controller = new InputController(ctx);
		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies) as Component & {
			setOverlayViewportRows(rows: number): void;
			handleInput(data: string): void;
		};
		overlay.setOverlayViewportRows(500);
		const all = Bun.stripANSI(overlay.render(160).join("\n"));
		expect(all).toContain("OLD_THINK_2");
		expect(all).toContain("OLD_TOOL_LINE_19");
		expect(all).toContain("OLD_READ_LINE_19");
		expect(all).toContain("OLD_BASH_LINE_19");
		expect(all).toContain("OLD_EVAL_LINE_19");
		expect(all).not.toMatch(/Thinking … \+\d+ lines/);
		expect(all).not.toContain("ctrl+o to expand");
		expect(all).not.toContain("LIVE_CHAT_MARKER");
		expect(all).toContain("LIVE_TOOL_MARKER");
		expect(all.indexOf("OLD_TOOL_LINE_19")).toBeLessThan(all.indexOf("OLD_READ_LINE_19"));
		expect(all.indexOf("OLD_READ_LINE_19")).toBeLessThan(all.indexOf("OLD_BASH_LINE_19"));
		expect(all.indexOf("OLD_BASH_LINE_19")).toBeLessThan(all.indexOf("OLD_EVAL_LINE_19"));
		expect(all.indexOf("OLD_EVAL_LINE_19")).toBeLessThan(all.indexOf("LIVE_TOOL_MARKER"));

		overlay.setOverlayViewportRows(10);
		overlay.handleInput("g");
		const top = Bun.stripANSI(overlay.render(160).join("\n"));
		expect(top).toContain("OLD_THINK_2");
		overlay.handleInput("G");
		const tail = Bun.stripANSI(overlay.render(160).join("\n"));
		expect(tail).toContain("OLD_EVAL_LINE_19");
		expect(tail).toContain("LIVE_TOOL_MARKER");
		expect(tail).not.toContain("OLD_THINK_2");
	});

	it("keeps session-source live tail when historical replay produces no components", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		(ctx.session as unknown as { buildDisplaySessionContext: ReturnType<typeof vi.fn> }).buildDisplaySessionContext =
			vi.fn(() => ({
				messages: [{ role: "custom", customType: "hidden", content: "HIDDEN_HISTORY", display: false }],
				models: {},
				injectedTtsrRules: [],
				selectedMCPToolNames: [],
				hasPersistedMCPToolSelection: false,
				mode: "none",
			}));
		(ctx.chatContainer.children as Component[]).push(
			transcriptComponent("LIVE_EMPTY_HISTORY_MARKER", true),
			transcriptComponent("COMMITTED_EMPTY_HISTORY_MARKER", false),
		);
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.onFullTranscript?.();

		const overlay = shownOverlay(spies);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("Full transcript (1 entries");
		expect(output).toContain("LIVE_EMPTY_HISTORY_MARKER");
		expect(output).not.toContain("COMMITTED_EMPTY_HISTORY_MARKER");
		expect(output).not.toContain("HIDDEN_HISTORY");
	});
	it("expands and collapses the current assistant turn since the previous user boundary", async () => {
		const { InputController, ctx } = await createContext();
		const olderSetExpanded = vi.fn();
		const currentSetExpanded = vi.fn();
		const currentSetMinimized = vi.fn();
		const liveToolSetExpanded = vi.fn();
		const liveToolSetMinimized = vi.fn();
		(ctx.chatContainer.children as unknown[]).push(
			{ liveToggleEligible: true, setExpanded: olderSetExpanded, setMinimized: vi.fn() },
			{ render: () => ["user boundary"] },
			{ liveToggleEligible: false, setExpanded: currentSetExpanded, setMinimized: currentSetMinimized },
		);
		ctx.currentTurnStartIndex = 2;
		(ctx.liveToolContainer.children as unknown[]).push({
			setExpanded: liveToolSetExpanded,
			setMinimized: liveToolSetMinimized,
		});
		const controller = new InputController(ctx);

		controller.toggleToolOutputExpansion();
		controller.toggleToolOutputExpansion();

		expect(olderSetExpanded).not.toHaveBeenCalled();
		expect(currentSetExpanded).toHaveBeenNthCalledWith(1, true);
		expect(currentSetExpanded).toHaveBeenNthCalledWith(2, false);
		expect(currentSetMinimized).toHaveBeenCalledWith(true);
		expect(liveToolSetExpanded).toHaveBeenNthCalledWith(1, true);
		expect(liveToolSetExpanded).toHaveBeenNthCalledWith(2, false);
		expect(ctx.ui.requestRender).toHaveBeenNthCalledWith(1, false, "tools expand");
		expect(ctx.ui.requestRender).toHaveBeenNthCalledWith(2, true, "tools collapse");
		expect(liveToolSetMinimized).not.toHaveBeenCalled();
	});

	it("collapses committed current-turn output even after it becomes ineligible", async () => {
		const { InputController, ctx } = await createContext();
		const setExpanded = vi.fn();
		const setMinimized = vi.fn();
		const child = {
			liveToggleEligible: true,
			setExpanded,
			setMinimized,
		};
		(ctx.chatContainer.children as unknown[]).push({ render: () => ["older turn"] }, child);
		ctx.currentTurnStartIndex = 1;
		const controller = new InputController(ctx);

		controller.toggleToolOutputExpansion();
		child.liveToggleEligible = false;
		controller.toggleToolOutputExpansion();

		expect(setExpanded).toHaveBeenNthCalledWith(1, true);
		expect(setExpanded).toHaveBeenNthCalledWith(2, false);
		expect(setMinimized).toHaveBeenCalledWith(true);
	});

	it("collapses a completed tool component to minimized summary mode", async () => {
		const { InputController, ctx } = await createContext();
		const tool = new ToolExecutionComponent(
			"bash",
			{ command: "printf lots" },
			{},
			undefined,
			ctx.ui,
			"/",
			"tool-current",
		);
		tool.updateResult({
			content: [{ type: "text", text: Array.from({ length: 20 }, (_, i) => `line-${i}`).join("\n") }],
			isError: false,
		});
		(ctx.chatContainer.children as unknown[]).push({ render: () => ["older turn"] }, tool);
		ctx.currentTurnStartIndex = 1;
		const controller = new InputController(ctx);

		const previewLines = tool.render(80);
		controller.toggleToolOutputExpansion();
		const expandedLines = tool.render(80);
		controller.toggleToolOutputExpansion();
		const minimizedLines = tool.render(80);

		expect(expandedLines.length).toBeGreaterThan(previewLines.length);
		expect(minimizedLines.length).toBeLessThan(previewLines.length);
		expect(minimizedLines.length).toBeLessThanOrEqual(2);
	});

	it("collapses completed bash execution output to a summary", async () => {
		const { InputController, ctx } = await createContext();
		const bash = new BashExecutionComponent("bun run check", ctx.ui);
		bash.setComplete(0, false, {
			output: Array.from({ length: 30 }, (_, i) => `line-${i}`).join("\n"),
		});
		(ctx.chatContainer.children as unknown[]).push({ render: () => ["older turn"] }, bash);
		ctx.currentTurnStartIndex = 1;
		const controller = new InputController(ctx);

		controller.toggleToolOutputExpansion();
		expect(Bun.stripANSI(bash.render(80).join("\n"))).toContain("line-29");

		controller.toggleToolOutputExpansion();
		const collapsed = Bun.stripANSI(bash.render(80).join("\n"));

		expect(collapsed).not.toContain("line-29");
		expect(collapsed).toContain("30 more lines");
	});

	it("collapses completed eval execution output to a summary", async () => {
		const { InputController, ctx } = await createContext();
		const evalExecution = new EvalExecutionComponent("print('lots')", ctx.ui);
		evalExecution.setComplete(0, false, {
			output: Array.from({ length: 30 }, (_, i) => `line-${i}`).join("\n"),
		});
		(ctx.chatContainer.children as unknown[]).push({ render: () => ["older turn"] }, evalExecution);
		ctx.currentTurnStartIndex = 1;
		const controller = new InputController(ctx);

		controller.toggleToolOutputExpansion();
		expect(Bun.stripANSI(evalExecution.render(80).join("\n"))).toContain("line-29");

		controller.toggleToolOutputExpansion();
		const collapsed = Bun.stripANSI(evalExecution.render(80).join("\n"));

		expect(collapsed).not.toContain("line-29");
		expect(collapsed).toContain("30 more lines");
	});

	it("marks streaming follow-up submissions as local", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const session = ctx.session as unknown as { isStreaming: boolean };
		session.isStreaming = true;
		editor.setText("follow up after current response");
		const controller = new InputController(ctx);

		await controller.handleFollowUp();

		expect(ctx.locallySubmittedUserSignatures.has("follow up after current response\u00000")).toBe(true);
		expect(spies.prompt).toHaveBeenCalledWith("follow up after current response", {
			streamingBehavior: "followUp",
		});
		expect(spies.updatePendingMessagesDisplay).toHaveBeenCalledTimes(1);
	});

	it("marks idle follow-up submissions as local", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		// Default fake session is idle.
		editor.setText("plain idle submit");
		const controller = new InputController(ctx);

		await controller.handleFollowUp();

		expect(ctx.locallySubmittedUserSignatures.has("plain idle submit\u00000")).toBe(true);
		// Idle submit calls prompt() with no streamingBehavior.
		expect(spies.prompt).toHaveBeenCalledWith("plain idle submit");
	});

	it("removes the signature when an idle follow-up submission rejects", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		spies.prompt.mockImplementationOnce(async () => {
			throw new Error("boom");
		});
		editor.setText("doomed submit");
		const controller = new InputController(ctx);

		await expect(controller.handleFollowUp()).rejects.toThrow("boom");

		// Contract: a thrown delivery error must not leave a stale signature
		// behind, otherwise the next attempt with the same text would silently
		// suppress the editor-clear protection that was meant for the failed call.
		expect(ctx.locallySubmittedUserSignatures.has("doomed submit\u00000")).toBe(false);
	});

	it("removes the signature when a streaming follow-up rejects", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const session = ctx.session as unknown as { isStreaming: boolean };
		session.isStreaming = true;
		spies.prompt.mockImplementationOnce(async () => {
			throw new Error("queue full");
		});
		editor.setText("queued during stream");
		const controller = new InputController(ctx);

		await expect(controller.handleFollowUp()).rejects.toThrow("queue full");

		expect(ctx.locallySubmittedUserSignatures.has("queued during stream\u00000")).toBe(false);
	});
});

describe("InputController Hangul IME chord hint", () => {
	it("shows a transient hint under the input and auto-clears it", async () => {
		vi.useFakeTimers();
		try {
			const { InputController, ctx, editor, spies } = await createContext();
			const controller = new InputController(ctx);
			controller.setupKeyHandlers();

			editor.onHangulCtrlChordHint?.("ㅊ", "ctrl+c");

			expect(spies.setHookStatus).toHaveBeenCalledWith(
				"ime-hangul-chord",
				expect.stringContaining("switch to English (한/A)"),
			);
			expect(spies.setHookStatus).toHaveBeenCalledWith("ime-hangul-chord", expect.stringContaining("ctrl+c"));

			vi.advanceTimersByTime(4_000);
			expect(spies.setHookStatus).toHaveBeenLastCalledWith("ime-hangul-chord", undefined);
		} finally {
			vi.useRealTimers();
		}
	});

	it("extends the hint window when the chord is retried before it clears", async () => {
		vi.useFakeTimers();
		try {
			const { InputController, ctx, editor, spies } = await createContext();
			const controller = new InputController(ctx);
			controller.setupKeyHandlers();

			editor.onHangulCtrlChordHint?.("ㅇ", "ctrl+d");
			vi.advanceTimersByTime(3_000);
			editor.onHangulCtrlChordHint?.("ㅇ", "ctrl+d");
			vi.advanceTimersByTime(3_000);

			// 6s after the first press, but only 3s after the retry — still visible.
			expect(spies.setHookStatus).not.toHaveBeenLastCalledWith("ime-hangul-chord", undefined);

			vi.advanceTimersByTime(1_000);
			expect(spies.setHookStatus).toHaveBeenLastCalledWith("ime-hangul-chord", undefined);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("InputController pasted clipboard image paths", () => {
	const RED_1X1_PNG_BASE64 =
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

	it("attaches terminal-pasted clipboard temp images and inserts a compact placeholder", async () => {
		const imagePath = `/tmp/clipboard-2026-06-04-120441-${process.pid.toString(36)}CAC144E7.png`;
		await Bun.write(imagePath, Buffer.from(RED_1X1_PNG_BASE64, "base64"));
		try {
			const { InputController, ctx, editor, spies } = await createContext();
			const controller = new InputController(ctx);

			controller.setupKeyHandlers();
			const handled = await editor.onPasteText?.(`${imagePath}\n`);

			expect(handled).toBe(true);
			expect(editor.getText()).toBe("[image 1] ");
			expect(ctx.pendingImages).toHaveLength(1);
			expect(ctx.pendingImages[0]?.mimeType).toBe("image/png");
			expect(spies.showStatus).toHaveBeenCalledWith(`Attached image: ${imagePath.split("/").at(-1)}`, { dim: true });
		} finally {
			await fs.rm(imagePath, { force: true });
		}
	});

	it("leaves ordinary pasted text for the editor", async () => {
		const { InputController, ctx, editor } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		const handled = await editor.onPasteText?.("/tmp/not-a-clipboard-image.png");

		expect(handled).toBe(false);
		expect(editor.getText()).toBe("");
		expect(ctx.pendingImages).toHaveLength(0);
	});
});

describe("InputController shell mode cues", () => {
	it("marks leading bang input as shell mode without rewriting editor text", async () => {
		const { InputController, ctx, editor } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.setText("!pwd");
		editor.onChange?.("!pwd");

		expect(ctx.isBashMode).toBe(true);
		expect(ctx.isBashNoContext).toBe(false);
		expect(ctx.isPythonMode).toBe(false);
		expect(editor.getText()).toBe("!pwd");
		expect(ctx.updateEditorBorderColor).toHaveBeenCalled();
	});

	it("marks double bang input as no-context shell mode", async () => {
		const { InputController, ctx, editor } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		editor.setText("!!pwd");
		editor.onChange?.("!!pwd");

		expect(ctx.isBashMode).toBe(true);
		expect(ctx.isBashNoContext).toBe(true);
		expect(ctx.updateEditorBorderColor).toHaveBeenCalled();
	});

	it("keeps existing shell submit and history semantics", async () => {
		const { InputController, ctx, editor, spies } = await createContext();
		const controller = new InputController(ctx);

		controller.setupKeyHandlers();
		controller.setupEditorSubmitHandler();
		await editor.onSubmit?.("!!pwd");

		expect(spies.handleBashCommand).toHaveBeenCalledWith("pwd", true);
		expect(editor.addToHistory).toHaveBeenCalledWith("!!pwd");
		expect(ctx.isBashMode).toBe(false);
		expect(ctx.isBashNoContext).toBe(false);
	});
});
