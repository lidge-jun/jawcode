import { describe, expect, it } from "bun:test";
import { type RequestBody, transformRequestBody } from "@jawcode-dev/ai/providers/openai-codex/request-transformer";
import { createCodexModel } from "./helpers";

// Guards GJC #1208 (drop invalid Codex encrypted_content) adapted into JWC's
// single body.input.map pass. A lone high surrogate is malformed UTF-16; the
// guard must well-form it for transport, and must drop non-string values.
const LONE_SURROGATE = "valid\uD800tail";

function reasoningItem(encrypted: unknown): Record<string, unknown> {
	return { type: "reasoning", encrypted_content: encrypted };
}

describe("openai-codex encrypted_content guard", () => {
	it("well-forms a lone-surrogate string and keeps the field", async () => {
		const body: RequestBody = {
			model: "gpt-5.1-codex",
			input: [reasoningItem(LONE_SURROGATE)],
		};
		const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
		const item = (transformed.input as Array<Record<string, unknown>>)[0];
		expect(typeof item.encrypted_content).toBe("string");
		expect(item.encrypted_content).toBe(LONE_SURROGATE.toWellFormed());
		// toWellFormed replaces the lone surrogate with U+FFFD (well-formed).
		expect((item.encrypted_content as string).isWellFormed()).toBe(true);
	});

	it("preserves an already well-formed encrypted_content string verbatim", async () => {
		const body: RequestBody = {
			model: "gpt-5.1-codex",
			input: [reasoningItem("clean-cipher-text")],
		};
		const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
		const item = (transformed.input as Array<Record<string, unknown>>)[0];
		expect(item.encrypted_content).toBe("clean-cipher-text");
	});

	it("drops non-string encrypted_content (number, object, null)", async () => {
		for (const bad of [42, { nested: true }, null]) {
			const body: RequestBody = {
				model: "gpt-5.1-codex",
				input: [reasoningItem(bad)],
			};
			const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
			const item = (transformed.input as Array<Record<string, unknown>>)[0];
			expect("encrypted_content" in item).toBe(false);
		}
	});

	it("leaves items without encrypted_content untouched", async () => {
		const body: RequestBody = {
			model: "gpt-5.1-codex",
			input: [{ type: "message", role: "user", content: "hi" }],
		};
		const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
		const item = (transformed.input as Array<Record<string, unknown>>)[0];
		expect("encrypted_content" in item).toBe(false);
		expect(item.content).toBe("hi");
	});

	it("does not disturb function_call / function_call_output pairing", async () => {
		const body: RequestBody = {
			model: "gpt-5.1-codex",
			input: [
				{ type: "function_call", call_id: "c1", name: "read", arguments: "{}" },
				{ type: "function_call_output", call_id: "c1", output: "result" },
				reasoningItem(123),
			],
		};
		const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
		const input = transformed.input as Array<Record<string, unknown>>;
		// matched function_call_output stays a function_call_output (not rewritten to a message)
		const fco = input.find(i => i.call_id === "c1" && i.type === "function_call_output");
		expect(fco).toBeDefined();
		expect(fco?.output).toBe("result");
		// the bad reasoning item had its non-string encrypted_content dropped
		const reasoning = input.find(i => i.type === "reasoning");
		expect(reasoning).toBeDefined();
		expect("encrypted_content" in (reasoning as Record<string, unknown>)).toBe(false);
	});

	it("rewrites orphan function_call_output to a message without injecting encrypted_content", async () => {
		const body: RequestBody = {
			model: "gpt-5.1-codex",
			input: [{ type: "function_call_output", call_id: "orphan", name: "read", output: "x" }],
		};
		const transformed = await transformRequestBody(body, createCodexModel(body.model), {});
		const item = (transformed.input as Array<Record<string, unknown>>)[0];
		expect(item.type).toBe("message");
		expect("encrypted_content" in item).toBe(false);
	});
});
