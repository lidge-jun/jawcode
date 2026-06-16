/**
 * Spark request guard (99.30.04 S3). gpt-5.3-codex-spark rejects
 * `reasoning.*` parameters with 400 "unsupported_parameter" (cli-jaw
 * precedent), so the request transformer must strip reasoning config and the
 * reasoning include for spark ids — even when a caller passes an effort.
 */
import { describe, expect, it } from "bun:test";
import { isCodexSparkModel, transformRequestBody } from "../src/providers/openai-codex/request-transformer";
import type { Model } from "../src/types";

function codexModel(id: string): Model<"openai-codex-responses"> {
	return {
		id,
		name: id,
		api: "openai-codex-responses",
		provider: "openai-codex",
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 128000,
		thinking: {
			mode: "effort",
			minLevel: "low",
			maxLevel: "xhigh",
			defaultLevel: "medium",
		} as Model<"openai-codex-responses">["thinking"],
	};
}

describe("codex spark request guard", () => {
	it("detects spark ids", () => {
		expect(isCodexSparkModel("gpt-5.3-codex-spark")).toBe(true);
		expect(isCodexSparkModel("gpt-5.5")).toBe(false);
	});

	it("strips reasoning config and include for spark even when an effort is passed", async () => {
		const body = await transformRequestBody(
			{ model: "gpt-5.3-codex-spark", input: [] },
			codexModel("gpt-5.3-codex-spark"),
			{
				reasoningEffort: "medium",
				reasoningSummary: "detailed",
			},
		);
		expect(body.reasoning).toBeUndefined();
		expect(body.include).not.toContain("reasoning.encrypted_content");
	});

	it("keeps reasoning config for non-spark models", async () => {
		const body = await transformRequestBody({ model: "gpt-5.5", input: [] }, codexModel("gpt-5.5"), {
			reasoningEffort: "medium",
			reasoningSummary: "detailed",
		});
		expect(body.reasoning).toMatchObject({ effort: "medium", summary: "detailed" });
		expect(body.include).toContain("reasoning.encrypted_content");
	});
});
