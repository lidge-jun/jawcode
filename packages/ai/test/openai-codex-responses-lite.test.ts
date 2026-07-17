import { describe, expect, it } from "bun:test";
import { transformRequestBody } from "@jawcode-dev/ai/providers/openai-codex/request-transformer";
import { createCodexModel } from "./helpers";

describe("OpenAI Codex Responses Lite request shape", () => {
	it("downgrades hosted tool choice while preserving none and required", async () => {
		const model = createCodexModel("gpt-5.5");
		const tools = [{ type: "function", name: "handoff", parameters: { type: "object" } }];

		const hosted = await transformRequestBody(
			{ model: model.id, tools, tool_choice: { type: "web_search" } },
			model,
			{ responsesLite: true },
		);
		expect(hosted.tool_choice).toBe("auto");
		expect(hosted.tools).toBeUndefined();

		for (const toolChoice of ["none", "required"] as const) {
			const constrained = await transformRequestBody({ model: model.id, tools, tool_choice: toolChoice }, model, {
				responsesLite: true,
			});
			expect(constrained.tool_choice).toBe(toolChoice);
			expect(constrained.tools).toBeUndefined();
		}
	});

	it("moves instructions and tools into Lite input items", async () => {
		const model = createCodexModel("gpt-5.5");
		const tools = [{ type: "function", name: "shot", parameters: { type: "object" } }];
		const transformed = await transformRequestBody(
			{
				model: model.id,
				instructions: "Use tools carefully",
				tools,
				parallel_tool_calls: true,
				input: [
					{
						type: "message",
						role: "user",
						content: [{ type: "input_image", image_url: "data:image/png;base64,AA==", detail: "high" }],
					},
				],
			},
			model,
			{ responsesLite: true },
		);

		expect(transformed.instructions).toBeUndefined();
		expect(transformed.tools).toBeUndefined();
		expect(transformed.parallel_tool_calls).toBe(false);
		expect(transformed.input?.[0]).toEqual({ type: "additional_tools", role: "developer", tools });
		expect(transformed.input?.[1]).toEqual({
			type: "message",
			role: "developer",
			content: [{ type: "input_text", text: "Use tools carefully" }],
		});
		expect(transformed.input?.[2]?.content).toEqual([
			{ type: "input_image", image_url: "data:image/png;base64,AA==", detail: undefined },
		]);
	});
});
