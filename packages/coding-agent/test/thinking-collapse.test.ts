import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@gajae-code/ai";
import { resetSettingsForTest, Settings } from "@gajae-code/coding-agent/config/settings";
import { AssistantMessageComponent } from "@gajae-code/coding-agent/modes/components/assistant-message";
import { initTheme } from "@gajae-code/coding-agent/modes/theme/theme";

/**
 * Thinking block collapse (devlog 083.5): completed thinking blocks render as
 * one-line summaries by default — mirroring tool minimization (083.1) — and
 * expand via setThinkingExpanded/custom remaps or the shared setExpanded
 * protocol (ctrl+o current-turn sweep). ctrl+t opens the full transcript
 * overlay, where renderFullTranscript shows the complete trace.
 */

const THINKING = "First reasoning line.\nSecond reasoning line.\nThird reasoning line.";

function buildMessage(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "thinking", thinking: THINKING }],
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
		...overrides,
	};
}

function renderText(component: AssistantMessageComponent, width = 120): string {
	return Bun.stripANSI(component.render(width).join("\n"));
}

beforeAll(async () => {
	await Settings.init({ inMemory: true });
	await initTheme(false);
});

afterAll(() => {
	resetSettingsForTest();
});

describe("thinking block collapse (083.5)", () => {
	it("collapses a completed thinking block to a one-line summary by default", () => {
		const component = new AssistantMessageComponent(buildMessage());
		const text = renderText(component);

		expect(text).toContain("Thinking … +3 lines");
		expect(text).not.toContain("Second reasoning line.");
	});

	it("expands via setThinkingExpanded (custom thinking toggle)", () => {
		const component = new AssistantMessageComponent(buildMessage());
		component.setThinkingExpanded(true);
		const text = renderText(component);

		expect(text).toContain("Second reasoning line.");
		expect(text).not.toContain("+3 lines");

		component.setThinkingExpanded(false);
		expect(renderText(component)).toContain("Thinking … +3 lines");
	});

	it("expands via the shared setExpanded protocol (ctrl+o global sweep)", () => {
		const component = new AssistantMessageComponent(buildMessage());
		component.setExpanded(true);

		expect(renderText(component)).toContain("Second reasoning line.");
	});

	it("renders full transcript without preserving expanded state", () => {
		const component = new AssistantMessageComponent(buildMessage());
		const text = Bun.stripANSI(component.renderFullTranscript(120).join("\n"));

		expect(text).toContain("Second reasoning line.");
		expect(renderText(component)).toContain("Thinking … +3 lines");
	});

	it("keeps the live streaming tail fully visible, then collapses on settle", () => {
		const component = new AssistantMessageComponent();
		component.setStreaming(true);
		component.updateContent(buildMessage());

		// Trailing thinking block of the streaming segment stays live.
		expect(renderText(component)).toContain("Second reasoning line.");

		// Once followed by visible text, the thinking block is no longer the tail.
		component.updateContent(
			buildMessage({
				content: [
					{ type: "thinking", thinking: THINKING },
					{ type: "text", text: "The answer." },
				],
			}),
		);
		const midText = renderText(component);
		expect(midText).toContain("Thinking … +3 lines");
		expect(midText).toContain("The answer.");
		expect(midText).not.toContain("Second reasoning line.");

		// Message settled with a trailing thinking block — collapses too.
		component.updateContent(buildMessage());
		component.setStreaming(false);
		expect(renderText(component)).toContain("Thinking … +3 lines");
	});

	it("keeps the legacy hideThinkingBlock setting rendering the static label", () => {
		const component = new AssistantMessageComponent(buildMessage(), true);
		const text = renderText(component);

		expect(text).toContain("Thinking...");
		expect(text).not.toContain("+3 lines");
		expect(text).not.toContain("Second reasoning line.");
	});
});
