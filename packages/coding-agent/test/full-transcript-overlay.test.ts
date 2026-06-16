import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import type { Component } from "@gajae-code/tui";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import { AssistantMessageComponent } from "../src/modes/components/assistant-message";
import { FullTranscriptOverlayComponent } from "../src/modes/components/full-transcript-overlay";
import { initTheme } from "../src/modes/theme/theme";
import { buildSessionTranscriptComponents } from "../src/modes/utils/session-transcript-replay";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
	initTheme();
});

afterAll(() => {
	resetSettingsForTest();
});

function fakeComponent(lines: string[], options: { committed?: boolean } = {}): Component {
	return {
		committed: options.committed,
		render: vi.fn(() => lines),
	} as unknown as Component;
}

function longLines(count = 60): string[] {
	return Array.from({ length: count }, (_, index) => `line-${index}`);
}

function sessionContext(messages: unknown[]) {
	return {
		messages,
		models: {},
		injectedTtsrRules: [],
		selectedMCPToolNames: [],
		hasPersistedMCPToolSelection: false,
		mode: "none",
	} as never;
}

function historicalItems(messages: unknown[], options: { hideThinkingBlock?: boolean } = {}): Component[] {
	return buildSessionTranscriptComponents(
		sessionContext(messages),
		{
			ui: { requestRender() {} } as never,
			cwd: process.cwd(),
			hideThinkingBlock: options.hideThinkingBlock ?? false,
			toolOutputExpanded: false,
			retryAttempt: 0,
			getToolByName: () => undefined,
			getUserMessageText: message =>
				"content" in message && typeof message.content === "string" ? message.content : "",
			getMessageRenderer: () => undefined,
			requestRender() {},
			showImages: false,
			readToolResultPreview: false,
			editFuzzyThreshold: 0.8,
			editAllowFuzzy: true,
			hashlineAutoDropPureInsertDuplicates: true,
		},
		{ mode: "transcript" },
	);
}

function renderSession(messages: unknown[], width = 120): string {
	const items = historicalItems(messages);
	const overlay = new FullTranscriptOverlayComponent(
		{
			kind: "session",
			historicalItems: items,
			liveItems: [],
			itemCount: items.length,
		},
		{ close: vi.fn(), requestRender: vi.fn() },
	);
	return Bun.stripANSI(overlay.render(width).join("\n"));
}

describe("FullTranscriptOverlayComponent", () => {
	it("renders committed component items directly", () => {
		const component = fakeComponent(["historical line"], { committed: true });
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		expect(overlay.render(80).join("\n")).toContain("historical line");
	});

	it("uses renderFullTranscript protocol and preserves component state", () => {
		let expanded = false;
		const component = {
			render: vi.fn(() => [expanded ? "plain expanded" : "plain collapsed"]),
			renderFullTranscript: vi.fn((width: number) => {
				const previous = expanded;
				expanded = true;
				try {
					expect(width).toBe(80);
					return [expanded ? "full expanded" : "full collapsed"];
				} finally {
					expanded = previous;
				}
			}),
		} as unknown as Component;
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		expect(overlay.render(80).join("\n")).toContain("full expanded");
		expect(expanded).toBe(false);
	});

	it("rerenders source components at the same width while open", () => {
		let text = "before";
		const component = {
			render: vi.fn(() => [text]),
			renderFullTranscript: vi.fn(() => [text]),
		} as unknown as Component;
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		expect(Bun.stripANSI(overlay.render(80).join("\n"))).toContain("before");

		text = "after";
		expect(Bun.stripANSI(overlay.render(80).join("\n"))).toContain("after");
	});

	it("opens long transcripts at the bottom", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [fakeComponent(longLines())] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		const output = overlay.render(80).join("\n");

		expect(output).toContain("line-59");
		expect(output).not.toContain("line-0\n");
	});

	it("uses the TUI supplied overlay height for full-screen coverage", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [fakeComponent(longLines(20))] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(6);
		const lines = Bun.stripANSI(overlay.render(80).join("\n")).split("\n");

		expect(lines).toHaveLength(6);
		expect(lines[0]).toContain("Full transcript");
		expect(lines.at(-1)).toContain("ctrl+t/q/esc close");
		expect(lines.join("\n")).toContain("line-19");
		expect(lines.join("\n")).not.toContain("line-0");
	});

	it("pads short overlays to the supplied full-screen height", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [fakeComponent(["short transcript"])] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(6);
		const lines = overlay.render(80).map(line => Bun.stripANSI(line));

		expect(lines).toHaveLength(6);
		expect(lines[0]).toContain("Full transcript");
		expect(lines[1]).toContain("short transcript");
		expect(lines[2]).toBe(" ".repeat(80));
		expect(lines.at(-1)).toContain("ctrl+t/q/esc close");
	});

	it("can scroll upward after opening at the bottom", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [fakeComponent(longLines())] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.render(80);
		overlay.handleInput("g");

		const output = overlay.render(80).join("\n");
		expect(output).toContain("line-0");
	});

	it("preserves user scroll offset after the initial bottom pin", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [fakeComponent(longLines())] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.render(80);
		overlay.handleInput("g");
		const firstScrolledOutput = overlay.render(80).join("\n");
		const secondScrolledOutput = overlay.render(80).join("\n");

		expect(firstScrolledOutput).toContain("line-0");
		expect(secondScrolledOutput).toContain("line-0");
		expect(secondScrolledOutput).not.toContain("line-59");
	});

	it("keeps following a growing transcript while pinned to the bottom", () => {
		let lines = longLines(30);
		const component = fakeComponent(lines);
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(8);
		expect(overlay.render(80).join("\n")).toContain("line-29");

		lines = longLines(45);
		(component.render as ReturnType<typeof vi.fn>).mockImplementation(() => lines);

		const output = overlay.render(80).join("\n");
		expect(output).toContain("line-44");
		expect(output).not.toContain("line-29\n");
	});

	it("does not follow growth after the user scrolls away from bottom", () => {
		let lines = longLines(30);
		const component = fakeComponent(lines);
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(8);
		overlay.render(80);
		overlay.handleInput("g");
		expect(overlay.render(80).join("\n")).toContain("line-0");

		lines = longLines(45);
		(component.render as ReturnType<typeof vi.fn>).mockImplementation(() => lines);

		const output = overlay.render(80).join("\n");
		expect(output).toContain("line-0");
		expect(output).not.toContain("line-44");
	});

	it("re-pins growing transcripts after jumping back to bottom", () => {
		let lines = longLines(30);
		const component = fakeComponent(lines);
		const overlay = new FullTranscriptOverlayComponent(
			{ kind: "components", items: [component] },
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(8);
		overlay.render(80);
		overlay.handleInput("g");
		overlay.handleInput("G");

		lines = longLines(45);
		(component.render as ReturnType<typeof vi.fn>).mockImplementation(() => lines);

		const output = overlay.render(80).join("\n");
		expect(output).toContain("line-44");
		expect(output).not.toContain("line-0\n");
	});

	it("fresh overlay instances re-pin to the bottom", () => {
		const source = { kind: "components" as const, items: [fakeComponent(longLines())] };
		const first = new FullTranscriptOverlayComponent(source, { close: vi.fn(), requestRender: vi.fn() });
		first.render(80);
		first.handleInput("g");
		expect(first.render(80).join("\n")).toContain("line-0");

		const second = new FullTranscriptOverlayComponent(source, { close: vi.fn(), requestRender: vi.fn() });
		const output = second.render(80).join("\n");

		expect(output).toContain("line-59");
		expect(output).not.toContain("line-0\n");
	});
	it("closes with escape, q, or ctrl+t", () => {
		for (const key of ["\u001b", "q", "\u0014"]) {
			const close = vi.fn();
			const overlay = new FullTranscriptOverlayComponent(
				{ kind: "components", items: [fakeComponent(["line"])] },
				{ close, requestRender: vi.fn() },
			);

			overlay.handleInput(key);

			expect(close).toHaveBeenCalledTimes(1);
		}
	});

	it("expands collapsed live assistant thinking in session overlays", () => {
		const live = new AssistantMessageComponent(
			{
				role: "assistant",
				content: [{ type: "thinking", thinking: "LIVE_THINK_1\nLIVE_THINK_2\nLIVE_THINK_3" }],
				timestamp: Date.now(),
			} as never,
			true,
			vi.fn(),
		);
		live.setThinkingExpanded(false);
		const overlay = new FullTranscriptOverlayComponent(
			{
				kind: "session",
				historicalItems: [],
				liveItems: [live],
				itemCount: 1,
			},
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(10);
		const output = Bun.stripANSI(overlay.render(100).join("\n"));
		const normalRenderAfterOverlay = Bun.stripANSI(live.render(100).join("\n"));

		expect(output).toContain("LIVE_THINK_2");
		expect(output).not.toMatch(/Thinking … \+\d+ lines/);
		expect(live.isThinkingExpanded()).toBe(false);
		expect(normalRenderAfterOverlay).not.toContain("LIVE_THINK_2");
		expect(normalRenderAfterOverlay).toContain("Thinking...");
	});
	it("shows hidden live thinking in full transcript even when already expanded", () => {
		const live = new AssistantMessageComponent(
			{
				role: "assistant",
				content: [{ type: "thinking", thinking: "LIVE_ALREADY_1\nLIVE_ALREADY_2\nLIVE_ALREADY_3" }],
				timestamp: Date.now(),
			} as never,
			true,
			vi.fn(),
		);
		live.setThinkingExpanded(true);
		const normalRenderBeforeOverlay = Bun.stripANSI(live.render(100).join("\n"));
		const overlay = new FullTranscriptOverlayComponent(
			{
				kind: "session",
				historicalItems: [],
				liveItems: [live],
				itemCount: 1,
			},
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(10);
		const output = Bun.stripANSI(overlay.render(100).join("\n"));
		const normalRenderAfterOverlay = Bun.stripANSI(live.render(100).join("\n"));

		expect(normalRenderBeforeOverlay).toContain("Thinking...");
		expect(normalRenderBeforeOverlay).not.toContain("LIVE_ALREADY_2");
		expect(output).toContain("LIVE_ALREADY_2");
		expect(output).not.toContain("Thinking...");
		expect(live.isThinkingExpanded()).toBe(true);
		expect(normalRenderAfterOverlay).toContain("Thinking...");
		expect(normalRenderAfterOverlay).not.toContain("LIVE_ALREADY_2");
	});
	it("shows historical thinking in session overlays even when normal thinking is hidden", () => {
		const messages = [
			{
				role: "assistant",
				content: [{ type: "thinking", thinking: "HIST_THINK_1\nHIST_THINK_2\nHIST_THINK_3" }],
				timestamp: Date.now(),
			},
		];
		const items = historicalItems(messages, { hideThinkingBlock: true });
		const overlay = new FullTranscriptOverlayComponent(
			{
				kind: "session",
				historicalItems: items,
				liveItems: [],
				itemCount: items.length,
			},
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		overlay.setOverlayViewportRows(10);
		const output = Bun.stripANSI(overlay.render(100).join("\n"));
		const normalRenderAfterOverlay = Bun.stripANSI(items[0]!.render(100).join("\n"));

		expect(output).toContain("HIST_THINK_2");
		expect(output).not.toContain("Thinking...");
		expect(normalRenderAfterOverlay).not.toContain("HIST_THINK_2");
		expect(normalRenderAfterOverlay).toContain("Thinking...");
	});
	it("renders session historical items before live tail", () => {
		const live = fakeComponent(["LIVE_COMPONENT_MARKER"]);
		const historical = fakeComponent(["PRE_COMPACT_MARKER"]);
		const overlay = new FullTranscriptOverlayComponent(
			{
				kind: "session",
				historicalItems: [historical],
				liveItems: [live],
				itemCount: 2,
			},
			{ close: vi.fn(), requestRender: vi.fn() },
		);

		const output = overlay.render(80).join("\n");
		expect(output).toContain("Full transcript (2 entries,");
		expect(output.indexOf("PRE_COMPACT_MARKER")).toBeLessThan(output.indexOf("LIVE_COMPONENT_MARKER"));
	});
	it("renders session bash executions with rich component output", () => {
		const output = renderSession([
			{
				role: "bashExecution",
				command: "printf 'tool-use-test-04\\n'",
				output: "tool-use-test-04\n",
				exitCode: 0,
				cancelled: false,
				timestamp: Date.now(),
			},
		]);

		expect(output).toMatch(/Bash|shell/);
		expect(output).toContain("printf 'tool-use-test-04\\n'");
		expect(output).toContain("tool-use-test-04");
		expect(output).not.toContain("Tool call bash {");
		expect(output).not.toContain('"command":"printf');
	});

	it("does not dump assistant toolCall JSON or noisy call markers", () => {
		const output = renderSession([
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "tool-1",
						name: "bash",
						arguments: { command: "printf 'tool-use-test-hidden\\n'" },
					},
				],
				timestamp: Date.now(),
			},
		]);

		expect(output).not.toContain("Tool call bash");
		expect(output).toContain("tool-use-test-hidden");
		expect(output).not.toContain('"command":"printf');
	});

	it("combined assistant toolCall plus bashExecution renders only rich execution block", () => {
		const output = renderSession([
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "tool-1",
						name: "bash",
						arguments: { command: "printf 'tool-use-test-05\\n'" },
					},
				],
				timestamp: Date.now(),
			},
			{
				role: "bashExecution",
				command: "printf 'tool-use-test-05\\n'",
				output: "tool-use-test-05\n",
				exitCode: 0,
				cancelled: false,
				timestamp: Date.now(),
			},
		]);

		expect(output).toMatch(/Bash|shell/);
		expect(output).toContain("Full transcript (1 entries");
		expect(output).toContain("printf 'tool-use-test-05\\n'");
		expect(output).toContain("tool-use-test-05");
		expect(output).not.toContain("Tool call bash");
		expect(output).not.toContain('"command":"printf');
		expect(output).not.toMatch(/\bBash:\s+command=/);
		expect(output).not.toMatch(/command=.*cwd=.*timeout=/);
	});

	it("renders paired assistant toolCall plus toolResult through ToolExecutionComponent", () => {
		const output = renderSession([
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "tool-1",
						name: "bash",
						arguments: { command: "printf 'tool-use-test-06\\n'" },
					},
				],
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "tool-1",
				toolName: "bash",
				content: [{ type: "text", text: "tool-use-test-06\n" }],
				isError: false,
				timestamp: Date.now(),
			},
		]);

		expect(output).toMatch(/Bash|shell/);
		expect(output).toContain("Full transcript (1 entries");
		expect(output).toContain("printf");
		expect(output).toContain("tool-use-test-06");
		expect(output).not.toContain("Tool call bash");
		expect(output).not.toContain('"command":"printf');
		expect(output).not.toMatch(/\bBash:\s+command=/);
	});

	it("orphan toolResult keeps compact non-JSON fallback", () => {
		const output = renderSession([
			{
				role: "toolResult",
				toolCallId: "missing-tool",
				toolName: "bash",
				content: [{ type: "text", text: "orphan-output\n" }],
				isError: false,
				timestamp: Date.now(),
			},
		]);

		expect(output).toContain("Tool bash");
		expect(output).toContain("orphan-output");
		expect(output).not.toContain("Tool call bash");
		expect(output).not.toContain('"command"');
	});

	it("renders session python executions with rich component output", () => {
		const output = renderSession([
			{
				role: "pythonExecution",
				code: "print('eval-output')",
				output: "eval-output\n",
				exitCode: 0,
				cancelled: false,
				timestamp: Date.now(),
			},
		]);

		expect(output).toMatch(/Eval|python/);
		expect(output).toContain("print");
		expect(output).toContain("eval-output");
	});

	it("keeps bottom-start behavior with rich session rendering", () => {
		const messages = Array.from({ length: 60 }, (_, index) => {
			const label = `rich-bottom-${String(index).padStart(2, "0")}`;
			return {
				role: "bashExecution",
				command: `printf '${label}\\n'`,
				output: `${label}\n`,
				exitCode: 0,
				cancelled: false,
				timestamp: Date.now(),
			};
		});

		const output = renderSession(messages, 100);

		expect(output).toContain("rich-bottom-59");
		expect(output).not.toContain("rich-bottom-00\n");
	});
});
