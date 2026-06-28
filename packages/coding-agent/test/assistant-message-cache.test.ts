import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { AssistantMessageComponent } from "@jawcode-dev/coding-agent/modes/components/assistant-message";
import { initTheme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import { Markdown } from "@jawcode-dev/tui";

/**
 * Content-block render cache (chase 10.013): `AssistantMessageComponent` caches the rendered
 * Markdown per content-block identity, reusing it across `updateContent` calls and updating
 * text in place across streaming chunks — while the thinking collapse one-line summary keeps
 * rendering a cheap `Text` that never touches the cache. These tests reuse the SAME content
 * object across renders so the cache-HIT / setText-reuse paths are actually exercised (a fresh
 * object per render would key a fresh WeakMap entry and never prove reuse).
 */

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

function renderText(component: AssistantMessageComponent, width = 120): string {
	return Bun.stripANSI(component.render(width).join("\n"));
}

/** First rendered Markdown inside the component's content container (cache reuse probe). */
function firstMarkdown(component: AssistantMessageComponent): Markdown | undefined {
	const root = component as unknown as { children: Array<{ children?: unknown[] }> };
	const contentContainer = root.children[0];
	return contentContainer?.children?.find((c): c is Markdown => c instanceof Markdown);
}

beforeAll(async () => {
	await Settings.init({ inMemory: true });
	await initTheme(false);
});

afterAll(() => {
	resetSettingsForTest();
});

describe("assistant-message content-block cache (chase 10.013)", () => {
	it("reuses the same Markdown instance for an unchanged text block across re-renders", () => {
		const textBlock = { type: "text" as const, text: "Hello cache." };
		const message = buildMessage([textBlock]);
		const component = new AssistantMessageComponent(message);
		component.render(120);
		const first = firstMarkdown(component);
		expect(first).toBeInstanceOf(Markdown);

		// Re-render with the SAME content object (e.g. a usage/streaming-triggered update).
		component.updateContent(message);
		component.render(120);
		expect(firstMarkdown(component)).toBe(first); // reused, not reconstructed
	});

	it("updates the cached text Markdown in place when the block text grows (setText path)", () => {
		const textBlock = { type: "text" as const, text: "Partial" };
		const message = buildMessage([textBlock]);
		const component = new AssistantMessageComponent(message);
		expect(renderText(component)).toContain("Partial");
		const before = firstMarkdown(component);

		// Streaming chunk grows the SAME content object's text in place.
		textBlock.text = "Partial then complete";
		component.updateContent(message);
		const text = renderText(component);

		expect(text).toContain("Partial then complete");
		expect(firstMarkdown(component)).toBe(before); // same instance, updated via setText
	});

	it("keeps thinking collapse/expand correct with caching active (expand→collapse→re-expand)", () => {
		const thinkingBlock = { type: "thinking" as const, thinking: "Line A.\nLine B.\nLine C." };
		const message = buildMessage([thinkingBlock]);
		const component = new AssistantMessageComponent(message);

		// Collapsed one-line summary by default — no cached Markdown served.
		expect(renderText(component)).toContain("Thinking … +3 lines");
		expect(renderText(component)).not.toContain("Line B.");

		// Expand: full thinking rendered through the cache.
		component.setThinkingExpanded(true);
		expect(renderText(component)).toContain("Line B.");
		const expandedMarkdown = firstMarkdown(component);
		expect(expandedMarkdown).toBeInstanceOf(Markdown);

		// Collapse: must serve the one-line summary, NOT the cached expanded Markdown.
		component.setThinkingExpanded(false);
		const collapsed = renderText(component);
		expect(collapsed).toContain("Thinking … +3 lines");
		expect(collapsed).not.toContain("Line B.");

		// Re-expand: reuses the cached expanded Markdown instance.
		component.setThinkingExpanded(true);
		expect(renderText(component)).toContain("Line B.");
		expect(firstMarkdown(component)).toBe(expandedMarkdown);
	});
});
