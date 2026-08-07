/**
 * A thinking signature from one provider must not be replayed to another.
 *
 * Anthropic's byte-for-byte replay rule covers the TARGET provider's own
 * latest response. Several providers share the `anthropic-messages` api —
 * `anthropic`, `zai`, `opencode-zen` — so gating the latest-turn exemption on
 * api alone replays a foreign provider's signature verbatim. Anthropic then
 * 400s with `Invalid signature in thinking block`, and because the poisoned
 * turn is still the latest, every retry fails the same way: the session
 * wedges onto its fallback model.
 *
 * Upstream tracked this as oh-my-pi #6379.
 */
import { describe, expect, it } from "bun:test";
import { transformMessages } from "@jawcode-dev/ai/providers/transform-messages";
import type { AssistantMessage, Message, Model, UserMessage } from "@jawcode-dev/ai/types";

function anthropicModel(provider: string, id: string): Model<"anthropic-messages"> {
	return {
		api: "anthropic-messages",
		provider,
		id,
		name: id,
		baseUrl: "https://example.invalid",
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		maxTokens: 8_192,
		contextWindow: 200_000,
		reasoning: true,
	} as Model<"anthropic-messages">;
}

/** A latest assistant turn produced by `provider`, carrying a signed thinking block. */
function signedTurn(provider: string, id: string): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{ type: "thinking", thinking: "prior reasoning", thinkingSignature: `sig_from_${provider}` },
			{ type: "redactedThinking", data: "opaque" },
			{ type: "text", text: "answer" },
		],
		api: "anthropic-messages",
		provider,
		model: id,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
		stopReason: "stop",
		timestamp: Date.now(),
	} as unknown as AssistantMessage;
}

const user: UserMessage = { role: "user", content: "continue", timestamp: Date.now() };

function thinkingBlocks(messages: Message[]): { type: string; thinkingSignature?: string }[] {
	const assistant = messages.find(message => message.role === "assistant") as AssistantMessage | undefined;
	return (assistant?.content ?? []).filter(
		(block): block is { type: string; thinkingSignature?: string } =>
			block.type === "thinking" || block.type === "redactedThinking",
	);
}

describe("foreign thinking signatures on the latest turn", () => {
	it("strips a signature issued by a different provider on the same api", () => {
		// Latest turn came from zai; we are now requesting against anthropic.
		const transformed = transformMessages(
			[user, signedTurn("zai", "glm-4.6")],
			anthropicModel("anthropic", "claude-sonnet-4-6"),
		);

		const signatures = thinkingBlocks(transformed)
			.map(block => block.thinkingSignature)
			.filter(Boolean);
		expect(signatures).toEqual([]);
	});

	it("drops the foreign redacted sibling rather than sending it unverifiable", () => {
		const transformed = transformMessages(
			[user, signedTurn("zai", "glm-4.6")],
			anthropicModel("anthropic", "claude-sonnet-4-6"),
		);

		expect(thinkingBlocks(transformed).some(block => block.type === "redactedThinking")).toBe(false);
	});

	it("keeps the byte-for-byte latest turn for the target provider's own response", () => {
		// Same provider, different model id: Anthropic's replay rule still applies,
		// so the signature must survive. This is what stops the fix from being
		// "strip everything".
		const transformed = transformMessages(
			[user, signedTurn("anthropic", "claude-opus-4-1")],
			anthropicModel("anthropic", "claude-sonnet-4-6"),
		);

		const signatures = thinkingBlocks(transformed)
			.map(block => block.thinkingSignature)
			.filter(Boolean);
		expect(signatures).toEqual(["sig_from_anthropic"]);
	});
});
