import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AssistantMessageComponent } from "@jawcode-dev/coding-agent/modes/components/assistant-message";
import { ToolExecutionComponent } from "@jawcode-dev/coding-agent/modes/components/tool-execution";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import { Text } from "@jawcode-dev/tui";

/**
 * 260703 WP6a — fixed-height streaming preview. RUNNING tool blocks and the
 * live streaming thinking tail render a bounded window (head/marker/tail)
 * instead of growing with every streamed chunk, so long executions cannot
 * overflow the live zone (which would disable the commit lane and arm the
 * overflow machinery). Completion and ctrl+o expansion render in full.
 * Plan: devlog/_plan/260703_tui_resize_stability/61_wp6a_streaming_preview.md
 */

beforeAll(async () => {
	await Settings.init({ inMemory: true });
	await initTheme(false);
});

afterAll(() => {
	resetSettingsForTest();
});

function outputLines(count: number): string {
	return Array.from({ length: count }, (_, i) => `out-${i}`).join("\n");
}

function partialResult(text: string) {
	return { content: [{ type: "text" as const, text }], isError: false };
}

function renderPlain(component: { render(width: number): string[] }, width = 80): string[] {
	return component.render(width).map(line => Bun.stripANSI(line));
}

function buildMessage(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-test",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: 0,
	};
}

/**
 * A custom tool whose renderResult echoes the full streamed output — the
 * unbounded-growth class (generic fallback tools already self-cap to 4/12
 * lines, bash/eval cap via previewLines; custom/edit renderers do not).
 */
function tallTool() {
	return {
		label: "BigTool",
		renderResult: (result: { content: Array<{ type: string; text?: string }> }) =>
			new Text(result.content.map(c => c.text ?? "").join("\n"), 0, 0),
	} as never;
}

function tallComponent(): ToolExecutionComponent {
	return new ToolExecutionComponent("bigtool", { arg: 1 }, {}, tallTool(), undefined as never);
}

describe("streaming tool preview cap (260703 WP6a)", () => {
	it("caps a running tool's body to the fixed window with an elision marker", () => {
		const component = tallComponent();
		component.updateResult(partialResult(outputLines(40)), true);

		const lines = renderPlain(component);
		// HEAD(2) + marker + TAIL(5) = 8 rows maximum while streaming.
		expect(lines.length).toBeLessThanOrEqual(8);
		expect(lines.some(l => /… \+\d+ lines/.test(l))).toBe(true);
		// The tail shows the LATEST output.
		expect(lines.at(-1)).toContain("out-39");
	});

	it("ctrl+o expansion bypasses the cap", () => {
		const component = tallComponent();
		component.updateResult(partialResult(outputLines(40)), true);
		component.setExpanded(true);

		const lines = renderPlain(component);
		expect(lines.length).toBeGreaterThan(8);
		expect(lines.some(l => l.includes("out-0"))).toBe(true);
	});

	it("a completed result renders through the existing paths unchanged", () => {
		const component = tallComponent();
		component.updateResult(partialResult(outputLines(40)), false);

		// Completion is owned by the existing policies (commit-mode minimize /
		// verbose full render) — the streaming cap must not apply.
		const lines = renderPlain(component);
		expect(lines.length).toBeGreaterThan(8);
		expect(lines.some(l => l.includes("out-0"))).toBe(true);
		expect(lines.some(l => /… \+\d+ lines/.test(l))).toBe(false);
	});

	it("caps the live streaming thinking tail and expands in full via ctrl+o", () => {
		const thinking = Array.from({ length: 30 }, (_, i) => `thought-${i}`).join("\n");
		const message = buildMessage([{ type: "thinking" as const, thinking }]);
		const component = new AssistantMessageComponent(message);
		component.setStreaming(true);
		component.updateContent(message);

		let text = renderPlain(component, 120).join("\n");
		expect(text).toContain("Thinking … +26 lines");
		expect(text).toContain("thought-29");
		expect(text).not.toContain("thought-0");

		component.setThinkingExpanded(true);
		component.updateContent(message);
		text = renderPlain(component, 120).join("\n");
		expect(text).toContain("thought-0");
	});
});
