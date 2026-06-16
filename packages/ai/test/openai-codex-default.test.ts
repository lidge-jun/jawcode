import { describe, expect, it } from "bun:test";
import { Effort, getBundledModel } from "@jawcode-dev/ai";
import { DEFAULT_MODEL_PER_PROVIDER } from "@jawcode-dev/ai/provider-models";

describe("OpenAI Codex defaults", () => {
	it("pins provider default to GPT-5.5", () => {
		expect(DEFAULT_MODEL_PER_PROVIDER["openai-codex"]).toBe("gpt-5.5");
	});

	it("represents GPT-5.5 as the xhigh default effort", () => {
		const model = getBundledModel("openai-codex", "gpt-5.5");

		expect(model.thinking).toMatchObject({
			mode: "effort",
			minLevel: Effort.Low,
			maxLevel: Effort.XHigh,
			defaultLevel: Effort.XHigh,
		});
		// OpenAI code backend enforces a 272K window for gpt-5.5 (the 1M capacity
		// is gpt-5.4-only per backend discovery max_context_window).
		expect(model.contextWindow).toBe(272000);
		expect(model.contextPromotionTarget).toBeUndefined();
	});
});
