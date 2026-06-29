import { describe, expect, test } from "bun:test";
import type { Context, Message, Usage } from "../types";
import { contextUsageTotalTokens, estimateKiroInputTokens, estimateKiroTokens, finalizeKiroUsage } from "./kiro-usage";

const user = (text: string): Message => ({ role: "user", content: text, timestamp: 0 });
const assistant = (text: string): Message =>
	({
		role: "assistant",
		content: [{ type: "text", text }],
		api: "kiro-streaming",
		provider: "kiro",
		model: "claude-sonnet-4.5",
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
	}) as Message;

const freshUsage = (): Usage => ({
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

describe("kiro usage estimation", () => {
	test("estimateKiroTokens: empty is 0, non-empty is at least 1, kiro family uses a tighter ratio", () => {
		expect(estimateKiroTokens("", "claude-sonnet-4.5")).toBe(0);
		expect(estimateKiroTokens("x", "claude-sonnet-4.5")).toBe(1);
		// 40 chars: claude (3.5) -> ceil(40/3.5)=12; a non-kiro model (4.0) -> 10.
		const text = "x".repeat(40);
		expect(estimateKiroTokens(text, "claude-sonnet-4.5")).toBe(12);
		expect(estimateKiroTokens(text, "gpt-4o")).toBe(10);
	});

	test("contextUsageTotalTokens: percentage of the window, guarded against missing inputs", () => {
		expect(contextUsageTotalTokens(50, 200_000)).toBe(100_000);
		expect(contextUsageTotalTokens(0, 200_000)).toBeUndefined();
		expect(contextUsageTotalTokens(50, undefined)).toBeUndefined();
		expect(contextUsageTotalTokens(undefined, 200_000)).toBeUndefined();
	});

	test("estimateKiroInputTokens: fresh session counts system prompt + tools once", () => {
		const ctx: Context = {
			systemPrompt: ["you are helpful"],
			tools: [
				{ name: "read", description: "d", parameters: { type: "object", properties: {} } },
			] as unknown as Context["tools"],
			messages: [user("hello")],
		};
		const withOverhead = estimateKiroInputTokens(ctx, "claude-sonnet-4.5");
		const withoutOverhead = estimateKiroInputTokens({ messages: [user("hello")] }, "claude-sonnet-4.5");
		expect(withOverhead).toBeGreaterThan(withoutOverhead);
	});

	test("estimateKiroInputTokens: resumed turn (history has assistant) excludes stable overhead", () => {
		const ctx: Context = {
			systemPrompt: ["you are helpful"],
			tools: [
				{ name: "read", description: "d", parameters: { type: "object", properties: {} } },
			] as unknown as Context["tools"],
			messages: [user("hello"), assistant("hi"), user("again")],
		};
		// Only "again" (the current turn) is counted, not the system prompt/tools or prior turns.
		expect(estimateKiroInputTokens(ctx, "claude-sonnet-4.5")).toBe(estimateKiroTokens("again", "claude-sonnet-4.5"));
	});

	test("estimateKiroInputTokens: counts only the tool wire surface, not handler/metadata bloat", () => {
		// Regression: factory tools carry handler closures + framework metadata. Counting the whole
		// object (JSON.stringify(context.tools)) over-estimated a greeting to >1M tokens and tripped
		// the usage-based context-overflow check. Only name/description/parameters are on the wire.
		const bloat = "X".repeat(200_000); // simulates non-wire fields on a factory tool object
		const wireTool = { name: "read", description: "read a file", parameters: { type: "object", properties: {} } };
		const fatTool = { ...wireTool, handler: () => {}, __huge: bloat } as unknown as NonNullable<
			Context["tools"]
		>[number];
		const ctxFat: Context = { systemPrompt: ["sys"], tools: [fatTool], messages: [user("hi")] };
		const ctxWire: Context = {
			systemPrompt: ["sys"],
			tools: [wireTool] as unknown as Context["tools"],
			messages: [user("hi")],
		};
		// The 200k-char bloat field must NOT inflate the estimate; both should match the wire surface.
		expect(estimateKiroInputTokens(ctxFat, "claude-sonnet-4.5")).toBe(
			estimateKiroInputTokens(ctxWire, "claude-sonnet-4.5"),
		);
		// And the estimate must be tiny (well under any context window), not ~57k from the bloat.
		expect(estimateKiroInputTokens(ctxFat, "claude-sonnet-4.5")).toBeLessThan(1_000);
	});

	test("finalizeKiroUsage: marks estimated and prefers contextUsagePercentage for total", () => {
		const usage = freshUsage();
		finalizeKiroUsage(usage, {
			inputTokens: 100,
			outputChars: "x".repeat(35),
			modelId: "claude-sonnet-4.5",
			contextUsagePercentage: 25,
			contextWindow: 200_000,
		});
		expect(usage.estimated).toBe(true);
		expect(usage.input).toBe(100);
		expect(usage.output).toBe(10); // ceil(35/3.5)
		expect(usage.totalTokens).toBe(50_000); // 25% of 200k, not input+output
	});

	test("finalizeKiroUsage: falls back to input+output when no contextUsagePercentage", () => {
		const usage = freshUsage();
		finalizeKiroUsage(usage, { inputTokens: 100, outputChars: "x".repeat(35), modelId: "claude-sonnet-4.5" });
		expect(usage.totalTokens).toBe(110);
		expect(usage.estimated).toBe(true);
	});
});
