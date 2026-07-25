import { describe, expect, it } from "bun:test";
import type { AgentToolResult } from "@jawcode-dev/agent-core";
import { z } from "zod/v4";
import type { CustomTool, CustomToolContext } from "../src/extensibility/custom-tools/types";
import { CustomToolAdapter } from "../src/extensibility/custom-tools/wrapper";
import { Type } from "../src/extensibility/typebox";
import { allowedToolArgKeysFromWireSchema, rejectUnknownToolArgs, requireRecordToolArgs } from "../src/tools/jtd-utils";

const context = {} as CustomToolContext;

function makeTool(parameters: CustomTool["parameters"], strict: boolean): CustomTool {
	return {
		name: "custom_tool",
		label: "Custom Tool",
		description: "test custom tool",
		parameters,
		strict,
		async execute(_toolCallId, params) {
			return { content: [{ type: "text", text: JSON.stringify(params) }] } as AgentToolResult;
		},
	};
}

async function executeAdapter(tool: CustomTool, params: unknown): Promise<AgentToolResult> {
	const adapter = new CustomToolAdapter(tool, () => context);
	return adapter.execute("call-1", params as never, undefined, undefined, context) as Promise<AgentToolResult>;
}

function firstText(result: AgentToolResult): string {
	const first = result.content[0];
	if (first?.type !== "text") throw new Error("expected text content");
	return first.text;
}

describe("tool argument hardening", () => {
	it("requires custom tool arguments to be records", () => {
		expect(requireRecordToolArgs({ path: "a" }, "custom_tool")).toEqual({ path: "a" });
		expect(() => requireRecordToolArgs(null, "custom_tool")).toThrow("arguments must be an object");
		expect(() => requireRecordToolArgs([], "custom_tool")).toThrow("arguments must be an object");
		expect(() => requireRecordToolArgs("x", "custom_tool")).toThrow("arguments must be an object");
	});

	it("rejects unknown keys in sorted order", () => {
		expect(() => rejectUnknownToolArgs({ z: 1, a: 2 }, new Set(["known"]), "custom_tool")).toThrow("a, z");
		expect(() => rejectUnknownToolArgs({ known: 1 }, new Set(["known"]), "custom_tool")).not.toThrow();
	});

	it("derives allowed keys only from closed object wire schemas", () => {
		expect(
			allowedToolArgKeysFromWireSchema({
				type: "object",
				properties: { path: { type: "string" } },
				additionalProperties: false,
			}),
		).toEqual(new Set(["path"]));
		expect(allowedToolArgKeysFromWireSchema({ type: "object", properties: { path: { type: "string" } } })).toBeNull();
		expect(
			allowedToolArgKeysFromWireSchema({
				type: "object",
				properties: { path: { type: "string" } },
				additionalProperties: false,
				anyOf: [],
			}),
		).toBeNull();
	});

	it("forwards accepted records unchanged", async () => {
		const tool = makeTool(z.object({ path: z.string() }).strict(), true);
		const params = { path: "README.md" };
		const result = await executeAdapter(tool, params);

		expect(firstText(result)).toBe(JSON.stringify(params));
	});

	it("rejects primitive and array arguments before custom tool execution", async () => {
		const tool = makeTool(z.object({ path: z.string() }).strict(), true);

		await expect(executeAdapter(tool, "nope")).rejects.toThrow("arguments must be an object");
		await expect(executeAdapter(tool, [])).rejects.toThrow("arguments must be an object");
	});

	it("rejects unknown keys for strict Zod object tools", async () => {
		const tool = makeTool(z.object({ path: z.string() }).strict(), true);

		await expect(executeAdapter(tool, { path: "README.md", extra: true })).rejects.toThrow("extra");
	});

	it("rejects unknown keys for strict zod-backed TypeBox object tools", async () => {
		const tool = makeTool(Type.Object({ path: Type.String() }, { additionalProperties: false }), true);

		await expect(executeAdapter(tool, { path: "README.md", extra: true })).rejects.toThrow("extra");
	});

	it("rejects unknown keys for strict raw JSON Schema object tools", async () => {
		const tool = makeTool(
			{
				type: "object",
				properties: { path: { type: "string" } },
				additionalProperties: false,
			} as CustomTool["parameters"],
			true,
		);

		await expect(executeAdapter(tool, { path: "README.md", extra: true })).rejects.toThrow("extra");
	});

	it("does not reject unknown keys for non-strict custom tools", async () => {
		const tool = makeTool(z.object({ path: z.string() }).strict(), false);
		const result = await executeAdapter(tool, { path: "README.md", extra: true });

		expect(firstText(result)).toContain("extra");
	});
});
