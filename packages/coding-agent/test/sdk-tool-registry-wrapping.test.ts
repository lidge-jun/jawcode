/**
 * Every tool an extension can see must run through `ExtensionToolWrapper`.
 *
 * The wrapper is where the `tool_call` hook fires, which is how an extension
 * blocks execution (`callResult.block`). `sdk.ts` wraps the whole registry in
 * one pass — but any tool inserted AFTER that pass lands unwrapped, and an
 * unwrapped tool executes without ever consulting the extension. Cursor's exec
 * handlers resolve straight out of this same registry via `options.tools.get`,
 * so an unwrapped entry is directly reachable.
 *
 * Upstream hit the same shape with mounted `xd://` devices (oh-my-pi #5650).
 */
import { describe, expect, it } from "bun:test";
import type { ExtensionRunner } from "@jawcode-dev/coding-agent/extensibility/extensions/runner";
import { ExtensionToolWrapper } from "@jawcode-dev/coding-agent/extensibility/extensions/wrapper";
import type { AgentTool } from "@jawcode-dev/agent-core";

const SDK_SOURCE_PATH = new URL("../src/sdk.ts", import.meta.url).pathname;

describe("tool registry wrapping order", () => {
	it("inserts no tool into the registry after the extension-wrapping pass", async () => {
		const source = await Bun.file(SDK_SOURCE_PATH).text();

		// The single pass that wraps everything already registered.
		const wrapPass = source.indexOf("toolRegistry.set(tool.name, new ExtensionToolWrapper(tool, extensionRunner));");
		expect(wrapPass).toBeGreaterThan(-1);

		// Any later `toolRegistry.set(...)` escapes that pass. Each one must
		// therefore construct the wrapper itself.
		const tail = source.slice(wrapPass + 1);
		const unwrappedInserts: string[] = [];
		const insertPattern = /toolRegistry\.set\((.*)\);/g;
		for (const match of tail.matchAll(insertPattern)) {
			const call = match[0];
			if (!call.includes("ExtensionToolWrapper")) unwrappedInserts.push(call.trim());
		}

		expect(unwrappedInserts).toEqual([]);
	});

	it("lets an extension block a wrapped tool, which is what the wrapper buys", async () => {
		// The behavioral half: without the wrapper this call just runs.
		let executed = false;
		const tool = {
			name: "resolve",
			description: "",
			label: "Resolve",
			parameters: {},
			execute: async () => {
				executed = true;
				return { content: [{ type: "text", text: "ran" }] };
			},
		} as unknown as AgentTool;

		const runner = {
			hasHandlers: (eventType: string) => eventType === "tool_call",
			emitToolCall: async () => ({ block: true, reason: "denied by policy" }),
		} as unknown as ExtensionRunner;

		const wrapped = new ExtensionToolWrapper(tool, runner);
		await expect(wrapped.execute("call-1", {} as never)).rejects.toThrow(/denied by policy/);
		expect(executed).toBe(false);

		// Same tool unwrapped: the extension is never consulted.
		await tool.execute("call-2", {} as never);
		expect(executed).toBe(true);
	});
});
