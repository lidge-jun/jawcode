import { describe, expect, it } from "bun:test";
import { Effort } from "../src/model-thinking";
import { getBundledModel } from "../src/models";
import { streamSimple } from "../src/stream";
import type { Context, Model } from "../src/types";

describe("Kimi mandatory reasoning dispatch", () => {
	it("clamps kimi-code/kimi-k3 disabled reasoning to its lowest effort", async () => {
		const model: Model<"openai-completions"> = {
			...getBundledModel("openai", "gpt-4o-mini"),
			api: "openai-completions",
			provider: "kimi-code",
			baseUrl: "https://api.kimi.com/coding/v1",
			id: "kimi-k3",
			reasoning: true,
			thinking: { mode: "effort", minLevel: Effort.Low, maxLevel: Effort.High },
		};
		const context: Context = { messages: [{ role: "user", content: "Reply OK", timestamp: 0 }] };
		let payload: unknown;
		await streamSimple(model, context, {
			apiKey: "test-key",
			disableReasoning: true,
			kimiApiFormat: "openai",
			fetch: async () =>
				new Response("data: [DONE]\n\n", {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				}),
			onPayload: body => {
				payload = body;
			},
		}).result();
		expect(model.thinking?.minLevel).toBe(Effort.Low);
		expect(payload).toMatchObject({ thinking: { type: "enabled" } });
	});
});
