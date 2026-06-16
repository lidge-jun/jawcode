import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { AgentMessage } from "@jawcode-dev/agent-core";
import type { Component, TUI } from "@jawcode-dev/tui";
import { resetSettingsForTest, Settings } from "../src/config/settings";
import { FullTranscriptOverlayComponent } from "../src/modes/components/full-transcript-overlay";
import { initTheme } from "../src/modes/theme/theme";
import { buildSessionTranscriptComponents } from "../src/modes/utils/session-transcript-replay";
import { isLiveToggleEligible } from "../src/modes/utils/ui-helpers";
import { SKILL_PROMPT_MESSAGE_TYPE } from "../src/session/messages";
import type { SessionContext } from "../src/session/session-manager";

beforeAll(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, cwd: process.cwd() });
	initTheme();
});

afterAll(() => {
	resetSettingsForTest();
});

function context(messages: AgentMessage[]): SessionContext {
	return {
		messages,
		models: {},
		injectedTtsrRules: [],
		selectedMCPToolNames: [],
		hasPersistedMCPToolSelection: false,
		mode: "none",
	};
}

function build(
	messages: AgentMessage[],
	overrides: Partial<Parameters<typeof buildSessionTranscriptComponents>[1]> = {},
): Component[] {
	return buildSessionTranscriptComponents(
		context(messages),
		{
			ui: { requestRender() {} } as TUI,
			cwd: process.cwd(),
			hideThinkingBlock: false,
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
			...overrides,
		},
		{ mode: "transcript" },
	);
}

function render(items: Component[], width = 120): string {
	const overlay = new FullTranscriptOverlayComponent(
		{ kind: "session", historicalItems: items, liveItems: [], itemCount: items.length },
		{ close() {}, requestRender() {} },
	);
	return Bun.stripANSI(overlay.render(width).join("\n"));
}
function renderAll(items: Component[], width = 120): string {
	return Bun.stripANSI(
		items
			.flatMap(item => {
				const maybe = item as { renderFullTranscript?: (width: number) => string[] };
				return typeof maybe.renderFullTranscript === "function"
					? maybe.renderFullTranscript(width)
					: item.render(width);
			})
			.join("\n"),
	);
}

function markerComponent(label: string): Component {
	return {
		render: () => [label],
		renderFullTranscript: () => [label],
	} as unknown as Component;
}

describe("buildSessionTranscriptComponents", () => {
	it("preserves assistant text → tool → text ordering without raw JSON", () => {
		const output = render(
			build([
				{
					role: "assistant",
					content: [
						{ type: "text", text: "TEXT_A" },
						{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "printf 'ORDER_TOOL\\n'" } },
						{ type: "text", text: "TEXT_B" },
					],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "tool-1",
					toolName: "bash",
					content: [{ type: "text", text: "ORDER_TOOL\n" }],
					isError: false,
					timestamp: Date.now(),
				},
			] as AgentMessage[]),
		);

		expect(output.indexOf("TEXT_A")).toBeLessThan(output.indexOf("ORDER_TOOL"));
		expect(output.indexOf("ORDER_TOOL")).toBeLessThan(output.indexOf("TEXT_B"));
		expect(output).not.toContain("Tool call bash {");
		expect(output).not.toContain('"command":"printf');
	});

	it("keeps historical read groups at the original tool-call position", () => {
		const items = build([
			{
				role: "assistant",
				content: [
					{ type: "toolCall", id: "generic", name: "generic_tool", arguments: { query: "old" } },
					{ type: "toolCall", id: "read", name: "read", arguments: { path: "src/old.ts" } },
					{ type: "toolCall", id: "bash", name: "bash", arguments: { command: "printf old" } },
					{ type: "toolCall", id: "eval", name: "eval", arguments: { language: "js", code: "old" } },
				],
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "generic",
				toolName: "generic_tool",
				content: [{ type: "text", text: "ORDER_GENERIC" }],
				isError: false,
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "read",
				toolName: "read",
				content: [{ type: "text", text: "ORDER_READ" }],
				isError: false,
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "bash",
				toolName: "bash",
				content: [{ type: "text", text: "ORDER_BASH" }],
				isError: false,
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "eval",
				toolName: "eval",
				content: [{ type: "text", text: "ORDER_EVAL" }],
				isError: false,
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items, 120);

		expect(output.indexOf("ORDER_GENERIC")).toBeLessThan(output.indexOf("ORDER_READ"));
		expect(output.indexOf("ORDER_READ")).toBeLessThan(output.indexOf("ORDER_BASH"));
		expect(output.indexOf("ORDER_BASH")).toBeLessThan(output.indexOf("ORDER_EVAL"));
	});

	it("starts a new read group across visible assistant text boundaries", () => {
		const items = build([
			{
				role: "assistant",
				content: [
					{ type: "toolCall", id: "read-a", name: "read", arguments: { path: "src/a.ts" } },
					{ type: "text", text: "BETWEEN_READS" },
					{ type: "toolCall", id: "read-b", name: "read", arguments: { path: "src/b.ts" } },
				],
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "read-a",
				toolName: "read",
				content: [{ type: "text", text: "READ_A_BODY" }],
				isError: false,
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "read-b",
				toolName: "read",
				content: [{ type: "text", text: "READ_B_BODY" }],
				isError: false,
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items, 120);

		expect(output.indexOf("src/a.ts")).toBeLessThan(output.indexOf("BETWEEN_READS"));
		expect(output.indexOf("BETWEEN_READS")).toBeLessThan(output.indexOf("src/b.ts"));
		expect(output.indexOf("READ_A_BODY")).toBeLessThan(output.indexOf("BETWEEN_READS"));
		expect(output.indexOf("BETWEEN_READS")).toBeLessThan(output.indexOf("READ_B_BODY"));
	});

	it("renders paired toolCall/toolResult through a rich tool component", () => {
		const output = render(
			build([
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "printf 'PAIR\\n'" } }],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "tool-1",
					toolName: "bash",
					content: [{ type: "text", text: "PAIR\n" }],
					isError: false,
					timestamp: Date.now(),
				},
			] as AgentMessage[]),
		);

		expect(output).toMatch(/Bash|bash/);
		expect(output).toContain("PAIR");
		expect(output).not.toContain("Tool call bash");
	});

	it("groups read tool results and wires preview option", () => {
		const items = build(
			[
				{
					role: "assistant",
					content: [
						{ type: "toolCall", id: "read-1", name: "read", arguments: { path: "src/a.ts" } },
						{ type: "toolCall", id: "read-2", name: "read", arguments: { path: "src/b.ts" } },
					],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "read-1",
					toolName: "read",
					content: [{ type: "text", text: "A_CONTENT" }],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "read-2",
					toolName: "read",
					content: [{ type: "text", text: "B_CONTENT" }],
					timestamp: Date.now(),
				},
			] as AgentMessage[],
			{ readToolResultPreview: true },
		);
		const output = render(items);

		expect(items.length).toBe(1);
		expect(output).toContain("src/a.ts");
		expect(output).toContain("src/b.ts");
		expect(output).toContain("A_CONTENT");
		expect(output).toContain("B_CONTENT");
	});

	it("keeps orphan toolResult compact and non-JSON", () => {
		const output = render(
			build([
				{
					role: "toolResult",
					toolCallId: "missing",
					toolName: "bash",
					content: [{ type: "text", text: "ORPHAN_OUTPUT" }],
					isError: false,
					timestamp: Date.now(),
				},
			] as AgentMessage[]),
		);

		expect(output).toContain("Tool bash");
		expect(output).toContain("ORPHAN_OUTPUT");
		expect(output).not.toContain('"command"');
	});

	it("renders custom, skill, branch, and compaction rows as non-live components", () => {
		const items = build([
			{ role: "custom", customType: "generic", content: "CUSTOM_BODY", display: true, timestamp: Date.now() },
			{
				role: "custom",
				customType: SKILL_PROMPT_MESSAGE_TYPE,
				content: "skill",
				display: true,
				details: { name: "skill", path: "/tmp/skill", lineCount: 1 },
				timestamp: Date.now(),
			},
			{ role: "branchSummary", branchName: "main", summary: "BRANCH_SUMMARY", timestamp: Date.now() },
			{
				role: "compactionSummary",
				summary: "COMPACTION_SUMMARY",
				shortSummary: "short",
				tokensBefore: 100,
				tokensAfter: 10,
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items);

		expect(output).toContain("CUSTOM_BODY");
		expect(output).toContain("skill");
		expect(output).toContain("BRANCH_SUMMARY");
		expect(output).toContain("COMPACTION_SUMMARY");
		expect(items.every(item => !isLiveToggleEligible(item))).toBe(true);
	});

	it("renders replay edge cases without raw JSON or empty read groups", () => {
		const errorOutput = render(
			build([
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "err-1", name: "bash", arguments: { command: "printf ERR" } }],
					stopReason: "error",
					errorMessage: "ERR_SYNTHETIC_RESULT",
					timestamp: Date.now(),
				},
			] as unknown as AgentMessage[]),
		);
		expect(errorOutput).toContain("ERR_SYNTHETIC_RESULT");
		expect(errorOutput).not.toContain("Tool call bash");

		const internalReadOutput = render(
			build([
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "read-internal", name: "read", arguments: { path: "agent://abc" } }],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "read-internal",
					toolName: "read",
					content: [{ type: "text", text: "INTERNAL_READ_RESULT" }],
					isError: false,
					timestamp: Date.now(),
				},
			] as AgentMessage[]),
		);
		expect(internalReadOutput).toContain("INTERNAL_READ_RESULT");
		expect(internalReadOutput).not.toContain("Tool call read");

		const imageOnlyItems = build(
			[
				{
					role: "assistant",
					content: [
						{ type: "text", text: "IMAGE_OWNER" },
						{ type: "toolCall", id: "read-image", name: "read", arguments: { path: "image.png" } },
					],
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "read-image",
					toolName: "read",
					content: [{ type: "image", image: "base64", mediaType: "image/png" }],
					isError: false,
					timestamp: Date.now(),
				},
			] as AgentMessage[],
			{ showImages: true },
		);
		expect(imageOnlyItems).toHaveLength(1);
		expect(renderAll(imageOnlyItems)).toContain("IMAGE_OWNER");
		expect(renderAll(imageOnlyItems)).not.toContain("image.png");

		const pendingToolOutput = render(
			build([
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "pending-1", name: "bash", arguments: { command: "PENDING_CMD" } }],
					timestamp: Date.now(),
				},
			] as unknown as AgentMessage[]),
		);
		expect(pendingToolOutput).toContain("PENDING_CMD");
		expect(pendingToolOutput).not.toContain("Tool call bash");
	});

	it("renders file mentions, async results, and IRC rows as compact non-live rows", () => {
		const items = build([
			{
				role: "fileMention",
				files: [{ path: "src/file.ts", lineCount: 12, skippedReason: undefined, image: false }],
				timestamp: Date.now(),
			},
			{
				role: "custom",
				customType: "async-result",
				content: "async",
				display: true,
				details: { jobId: "job-123", type: "task", durationMs: 250 },
				timestamp: Date.now(),
			},
			{
				role: "custom",
				customType: "irc:incoming",
				content: "irc",
				display: true,
				details: { from: "peer", message: "IRC_BODY" },
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items);

		expect(output).toContain("src/file.ts");
		expect(output).toContain("job-123");
		expect(output).toContain("IRC_BODY");
		expect(items.every(item => !isLiveToggleEligible(item))).toBe(true);
	});

	it("renders an empty historical session source without falling back to committed chat strings", () => {
		const overlay = new FullTranscriptOverlayComponent(
			{
				kind: "session",
				historicalItems: [],
				liveItems: [markerComponent("LIVE_ONLY_MARKER")],
				itemCount: 1,
			},
			{ close() {}, requestRender() {} },
		);
		const output = Bun.stripANSI(overlay.render(120).join("\n"));

		expect(output).toContain("Full transcript (1 entries");
		expect(output).toContain("LIVE_ONLY_MARKER");
		expect(output).not.toContain("Tool call");
	});

	it("renders bash/eval, thinking, long lines, and rejects chat mode", () => {
		const longLine = "X".repeat(1000);
		const items = build([
			{
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "THINKING_BODY" },
					{ type: "text", text: "ANSWER_BODY" },
				],
				timestamp: Date.now(),
			},
			{
				role: "bashExecution",
				command: "printf long",
				output: `${longLine}\n`,
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
			{
				role: "pythonExecution",
				code: "print('PY_OUT')",
				output: "PY_OUT\n",
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items, 120);

		expect(output).toContain("THINKING_BODY");
		expect(output).toContain("ANSWER_BODY");
		expect(output).toContain("printf long");
		expect(output).toContain("PY_OUT");
		expect(output).toContain("X".repeat(20));
		expect(() =>
			buildSessionTranscriptComponents(
				context([]),
				{
					ui: { requestRender() {} } as TUI,
					cwd: process.cwd(),
					hideThinkingBlock: false,
					toolOutputExpanded: false,
					retryAttempt: 0,
					getToolByName: () => undefined,
					requestRender() {},
					showImages: false,
					readToolResultPreview: false,
					editFuzzyThreshold: 0.8,
					editAllowFuzzy: true,
					hashlineAutoDropPureInsertDuplicates: true,
				},
				{ mode: "chat" },
			),
		).toThrow();
	});

	it("replays completed bash and python execution output without streaming caps", () => {
		const bashOutput = Array.from({ length: 150 }, (_value, index) => `BASH_HISTORY_${index}`).join("\n");
		const pythonOutput = Array.from({ length: 150 }, (_value, index) => `PY_HISTORY_${index}`).join("\n");
		const items = build([
			{
				role: "bashExecution",
				command: "seq history",
				output: bashOutput,
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
			{
				role: "pythonExecution",
				code: "print('history')",
				output: pythonOutput,
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
		] as AgentMessage[]);
		const output = renderAll(items, 160);

		expect(output).toContain("BASH_HISTORY_0");
		expect(output).toContain("BASH_HISTORY_149");
		expect(output).toContain("PY_HISTORY_0");
		expect(output).toContain("PY_HISTORY_149");
		expect(output).not.toContain("ctrl+o to expand");
		expect(output).not.toMatch(/… \d+ more lines/);
	});
});
