import { describe, expect, test } from "bun:test";
import { Effort, getSupportedEfforts } from "../model-thinking";
import { getBundledModel } from "../models";
import { kiroModelManagerOptions } from "../provider-models/special";
import type { AssistantMessage, Context, Message, ToolResultMessage } from "../types";
import { buildPayload } from "./kiro";

// ---------------------------------------------------------------------------
// Helpers — minimal message factories (only fields buildPayload reads).
// ---------------------------------------------------------------------------

const user = (text: string): Message => ({ role: "user", content: text, timestamp: 0 });

const assistant = (
	text: string,
	toolCalls: Array<{ id: string; name: string; args?: Record<string, unknown> }> = [],
): AssistantMessage =>
	({
		role: "assistant",
		content: [
			...(text ? [{ type: "text" as const, text }] : []),
			...toolCalls.map(tc => ({ type: "toolCall" as const, id: tc.id, name: tc.name, arguments: tc.args ?? {} })),
		],
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
		stopReason: "toolUse",
		timestamp: 0,
	}) as AssistantMessage;

const toolResult = (toolCallId: string, text: string, isError = false): ToolResultMessage => ({
	role: "toolResult",
	toolCallId,
	toolName: "read",
	content: [{ type: "text", text }],
	isError,
	timestamp: 0,
});

const PNG_B64 = "aGVsbG8="; // "hello" — stand-in base64 payload

const userWithImage = (text: string, data = PNG_B64, mimeType = "image/png"): Message => ({
	role: "user",
	content: [
		{ type: "text", text },
		{ type: "image", data, mimeType },
	],
	timestamp: 0,
});

const toolResultWithImage = (
	toolCallId: string,
	text: string,
	data = PNG_B64,
	mimeType = "image/png",
): ToolResultMessage => ({
	role: "toolResult",
	toolCallId,
	toolName: "get_app_state",
	content: [
		{ type: "text", text },
		{ type: "image", data, mimeType },
	],
	isError: false,
	timestamp: 0,
});

// Tool conversations are only valid on the wire when the matching tools are advertised — a model
// never emits a toolUse for a tool the request didn't offer. Default the context to advertising the
// tools these fixtures reference so structured toolUses/toolResults are produced (matching real
// usage and opencodex's structuredToolIds gating). Pass `tools` explicitly (e.g. []) to exercise
// the tool-less fallback path.
const DEFAULT_TEST_TOOLS = [
	{ name: "read", description: "read a file", parameters: { type: "object", properties: {} } },
	{ name: "grep", description: "search", parameters: { type: "object", properties: {} } },
] as unknown as Context["tools"];
const ctx = (messages: Message[], tools: Context["tools"] = DEFAULT_TEST_TOOLS): Context => ({ messages, tools });

// ---------------------------------------------------------------------------
// Structural extractors / invariants
// ---------------------------------------------------------------------------

interface UIM {
	content: string;
	userInputMessageContext?: { toolResults?: Array<{ toolUseId: string }>; tools?: unknown[] };
	images?: Array<{ format: string; source: { bytes: string } }>;
}
interface ARM {
	content: string;
	toolUses?: Array<{ toolUseId: string; input?: unknown }>;
}
interface HEntry {
	userInputMessage?: UIM;
	assistantResponseMessage?: ARM;
}

function dissect(payload: Record<string, unknown>): {
	history: HEntry[];
	current: UIM;
} {
	const cs = payload.conversationState as Record<string, unknown>;
	const history = (cs.history as HEntry[] | undefined) ?? [];
	const current = (cs.currentMessage as { userInputMessage: UIM }).userInputMessage;
	return { history, current };
}

/** Assert strict user/assistant alternation across history + current turn. */
function assertAlternation(history: HEntry[]): void {
	let prev = "";
	for (const e of history) {
		const role = e.userInputMessage ? "user" : "assistant";
		expect(role).not.toBe(prev); // no two consecutive same-role turns
		prev = role;
	}
	// History always ends on an assistant turn because the current user turn is popped out.
	if (history.length > 0) expect(prev).toBe("assistant");
}

/**
 * Assert every assistantResponseMessage.toolUses is answered by the toolResults
 * on the userInputMessage that immediately follows it (history or current).
 */
function assertToolAdjacency(history: HEntry[], current: UIM): void {
	const seq = [...history, { userInputMessage: current } as HEntry];
	for (let i = 0; i < seq.length; i++) {
		const arm = seq[i].assistantResponseMessage;
		if (!arm?.toolUses?.length) continue;
		const next = seq[i + 1]?.userInputMessage;
		expect(next).toBeDefined();
		const results = next?.userInputMessageContext?.toolResults ?? [];
		expect(results.map(r => r.toolUseId).sort()).toEqual(arm.toolUses.map(t => t.toolUseId).sort());
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildPayload — CodeWhisperer wire contract", () => {
	test("single round of parallel tool calls: results ride on the current turn", () => {
		const ids = Array.from({ length: 10 }, (_, i) => `toolu_${i}`);
		const messages: Message[] = [
			user("tool use 10개 해봐"),
			assistant(
				"running",
				ids.map(id => ({ id, name: "read" })),
			),
			...ids.map(id => toolResult(id, `result ${id}`)),
		];
		const { history, current } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv1", "arn"));

		assertAlternation(history);
		assertToolAdjacency(history, current);
		// History keeps [user, assistant(10 toolUses)]; the 10 results are on the current turn.
		expect(history).toHaveLength(2);
		expect(current.userInputMessageContext?.toolResults).toHaveLength(10);
		expect(history[1].assistantResponseMessage?.toolUses).toHaveLength(10);
	});

	test("multi-round conversation keeps every toolUse adjacent to its results", () => {
		const messages: Message[] = [
			user("first"),
			assistant("", [
				{ id: "a1", name: "read" },
				{ id: "a2", name: "grep" },
			]),
			toolResult("a1", "r1"),
			toolResult("a2", "r2"),
			assistant("done round 1"),
			user("now do ten"),
			assistant(
				"",
				Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, name: "read" })),
			),
			...Array.from({ length: 10 }, (_, i) => toolResult(`b${i}`, `rb${i}`)),
		];
		const { history, current } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv2", "arn"));

		assertAlternation(history);
		assertToolAdjacency(history, current);
		// Final 10 parallel results are the pending current turn.
		expect(current.userInputMessageContext?.toolResults).toHaveLength(10);
		// No history entry should be a userInputMessage carrying ZERO results between a
		// toolUse assistant and the results (the old "(continue)" placeholder bug).
		const firstRoundResultTurn = history.find(
			e => (e.userInputMessage?.userInputMessageContext?.toolResults?.length ?? 0) === 2,
		);
		expect(firstRoundResultTurn).toBeDefined();
	});

	test("toolUse and toolResult ids are normalized identically (no mismatch)", () => {
		const rawId = "toolu|weird/id"; // contains chars normalizeToolCallId rewrites
		const messages: Message[] = [user("go"), assistant("", [{ id: rawId, name: "read" }]), toolResult(rawId, "ok")];
		const { history, current } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv3", "arn"));
		const useId = history[1].assistantResponseMessage?.toolUses?.[0]?.toolUseId;
		const resId = current.userInputMessageContext?.toolResults?.[0]?.toolUseId;
		expect(useId).toBeDefined();
		expect(useId).toBe(resId);
		expect(useId).not.toContain("|");
		expect(useId).not.toContain("/");
	});

	test("plain user turn (no tools) produces a clean single current message", () => {
		const { history, current } = dissect(buildPayload(ctx([user("hi")], []), "claude-sonnet-4.5", "conv4", "arn"));
		expect(history).toHaveLength(0);
		expect(current.content).toBe("hi");
		expect(current.userInputMessageContext).toBeUndefined();
	});

	test("multi-element systemPrompt is blank-line joined, not comma-joined", () => {
		const context: Context = { messages: [user("hi")], systemPrompt: ["SYS A", "SYS B"] };
		const { current } = dissect(buildPayload(context, "claude-sonnet-4.5", "conv5", "arn"));
		expect(current.content).toBe("SYS A\n\nSYS B\n\nhi");
		expect(current.content).not.toContain("SYS A,SYS B");
	});

	test("current-turn-only payload drops repeated history and fresh-session system prompt", () => {
		const context: Context = {
			messages: [user("old"), assistant("old answer"), user("latest")],
			systemPrompt: ["SYS A", "SYS B"],
		};
		const { history, current } = dissect(
			buildPayload(context, "claude-sonnet-4.5", "conv-current", "arn", { currentTurnOnly: true }),
		);
		expect(history).toHaveLength(0);
		expect(current.content).toBe("latest");
		expect(current.content).not.toContain("SYS A");
		expect(current.content).not.toContain("old");
	});

	test("current-turn-only keeps the assistant toolUses turn that the current toolResults answer", () => {
		// Resumed turn whose current message carries tool results: Kiro requires the assistant turn
		// whose toolUses they answer to stay adjacent, so it must NOT be dropped with the rest.
		const context: Context = {
			messages: [
				user("way old"),
				assistant("older answer"),
				user("run a tool"),
				assistant("", [{ id: "t1", name: "read" }]),
				toolResult("t1", "tool output"),
			],
			tools: DEFAULT_TEST_TOOLS,
		};
		const { history, current } = dissect(
			buildPayload(context, "claude-sonnet-4.5", "conv-resume-tr", "arn", { currentTurnOnly: true }),
		);
		// The far-back "way old"/"older answer" turns are dropped, but the assistant toolUses turn
		// answered by the current toolResults survives and stays aligned.
		assertAlternation(history);
		assertToolAdjacency(history, current);
		expect(current.userInputMessageContext?.toolResults?.[0]?.toolUseId).toBeDefined();
		const keptToolUses = history.some(e => e.assistantResponseMessage?.toolUses?.length);
		expect(keptToolUses).toBe(true);
		expect(JSON.stringify(history)).not.toContain("older answer");
	});

	test("xhigh injects max-equivalent thinking tags into the current user message only", () => {
		const { current } = dissect(
			buildPayload(ctx([user("think hard")], []), "claude-sonnet-4.5", "conv-thinking", "arn", {
				reasoning: Effort.XHigh,
				maxTokens: 8000,
			}),
		);
		expect(current.content).toContain("<thinking_mode>enabled</thinking_mode>");
		expect(current.content).toContain("<max_thinking_length>7600</max_thinking_length>");
		expect(current.content).toContain("think hard");
	});

	test("tool-result carrier turns do not receive thinking tags", () => {
		const messages: Message[] = [user("run"), assistant("", [{ id: "t1", name: "read" }]), toolResult("t1", "ok")];
		const { current } = dissect(
			buildPayload(ctx(messages), "claude-sonnet-4.5", "conv-tool-thinking", "arn", {
				reasoning: Effort.XHigh,
				maxTokens: 8000,
			}),
		);
		expect(current.content).toBe("(tool results)");
		expect(current.content).not.toContain("<thinking_mode>");
		expect(current.userInputMessageContext?.toolResults).toHaveLength(1);
	});

	test("tool-advertised plain user turn still receives synthetic thinking tags (opencodex HEAD)", () => {
		// opencodex HEAD (0254b66) reverted the brief "skip when tools advertised" rule (b496629 →
		// b19d4a0), so a genuine free-form user turn gets the synthetic prompt even while tools are
		// advertised. Only toolResults / "(continue)" / fallback carriers are skipped.
		const context = {
			messages: [user("do the thing")],
			tools: [{ name: "read", description: "d", parameters: { type: "object", properties: {} } }],
		} as unknown as Context;
		const { current } = dissect(
			buildPayload(context, "claude-sonnet-4.5", "conv-tool-think", "arn", {
				reasoning: Effort.XHigh,
				maxTokens: 8000,
			}),
		);
		expect(current.content).toContain("<thinking_mode>enabled</thinking_mode>");
		expect(current.content).toContain("do the thing");
		expect(current.userInputMessageContext?.tools).toHaveLength(1);
	});

	test("(continue) placeholder turns skip synthetic thinking tags", () => {
		// History ending on an assistant text turn yields a "(continue)" current message; it carries
		// no user intent so the synthetic thinking prompt must not be injected.
		const { current } = dissect(
			buildPayload(ctx([user("hi"), assistant("done")]), "claude-sonnet-4.5", "conv-cont", "arn", {
				reasoning: Effort.XHigh,
				maxTokens: 8000,
			}),
		);
		expect(current.content).toBe("(continue)");
		expect(current.content).not.toContain("<thinking_mode>");
	});

	test("toolUses[].input is a passthrough JSON object, not a stringified JSON", () => {
		const args = { pattern: "foo", limit: 5 };
		const messages: Message[] = [
			user("search"),
			assistant("", [{ id: "t1", name: "grep", args }]),
			toolResult("t1", "ok"),
		];
		const { history } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv6", "arn"));
		const input = history[1].assistantResponseMessage?.toolUses?.[0]?.input;
		expect(typeof input).toBe("object");
		expect(input).toEqual(args);
		// Must NOT be a stringified JSON (the REQUEST_BODY_INVALID root cause).
		expect(typeof input).not.toBe("string");
	});

	test("tool history with NO tools advertised is serialized as fallback prose (no structured toolResults)", () => {
		// Resumed turn that dropped tools: structured toolUses/toolResults would trip
		// REQUEST_BODY_INVALID, so calls/results must degrade to prose on plain turns.
		const messages: Message[] = [
			user("search"),
			assistant("", [{ id: "t1", name: "grep", args: { pattern: "foo" } }]),
			toolResult("t1", "match found"),
		];
		const { history, current } = dissect(buildPayload(ctx(messages, []), "claude-sonnet-4.5", "conv-fb", "arn"));
		assertAlternation(history);
		// No structured toolUses or toolResults anywhere.
		const allEntries = [...history, { userInputMessage: current } as HEntry];
		for (const e of allEntries) {
			expect(e.assistantResponseMessage?.toolUses).toBeUndefined();
			expect(e.userInputMessage?.userInputMessageContext?.toolResults).toBeUndefined();
		}
		// The call + result survive as prose.
		const blob = JSON.stringify({ history, current });
		expect(blob).toContain("Tool call fallback (grep");
		expect(blob).toContain("Tool result fallback (read"); // toolResult helper uses toolName "read"
		expect(blob).toContain("match found");
	});

	test("orphaned tool result (id not from an advertised structured toolUse) becomes fallback prose", () => {
		// Tools ARE advertised, but the result's id has no matching structured toolUse this request.
		const messages: Message[] = [user("hello"), toolResult("ghost-id", "stray output")];
		const { history, current } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv-orphan", "arn"));
		const allEntries = [...history, { userInputMessage: current } as HEntry];
		for (const e of allEntries) {
			expect(e.userInputMessage?.userInputMessageContext?.toolResults).toBeUndefined();
		}
		expect(JSON.stringify({ history, current })).toContain("Tool result fallback");
	});
});

describe("buildPayload — tool names + images", () => {
	test("long tool names are sent verbatim (not truncated to 64 chars)", () => {
		const longName = `mcp__chrome-devtools__${"x".repeat(80)}`;
		const tool = { name: longName, description: "d", parameters: { type: "object", properties: {} } };
		const context = {
			messages: [user("hi")],
			tools: [tool],
		} as unknown as Context;
		const { current } = dissect(buildPayload(context, "claude-sonnet-4.5", "conv-toolname", "arn"));
		const tools = current.userInputMessageContext?.tools as Array<{ toolSpecification: { name: string } }>;
		expect(longName.length).toBeGreaterThan(64);
		expect(tools[0].toolSpecification.name).toBe(longName);
	});

	test("tool input schemas are sanitized for Bedrock (type:object, no oneOf/allOf/anyOf at root)", () => {
		const schemaOf = (parameters: unknown) => {
			const context = {
				messages: [user("hi")],
				tools: [{ name: "t", description: "d", parameters }],
			} as unknown as Context;
			const { current } = dissect(buildPayload(context, "claude-sonnet-4.5", "conv-schema", "arn"));
			const tools = current.userInputMessageContext?.tools as Array<{
				toolSpecification: { inputSchema: { json: Record<string, unknown> } };
			}>;
			return tools[0].toolSpecification.inputSchema.json;
		};

		// Empty parameters still surface a root type:"object" (Bedrock rejects a missing root type).
		expect(schemaOf({}).type).toBe("object");

		// additionalProperties and empty required[] are stripped recursively.
		const cleaned = schemaOf({
			type: "object",
			required: [],
			additionalProperties: false,
			properties: { opts: { type: "object", additionalProperties: false, properties: { m: { type: "string" } } } },
		});
		expect(cleaned.additionalProperties).toBeUndefined();
		expect(cleaned.required).toBeUndefined();
		expect(
			(cleaned.properties as Record<string, { additionalProperties?: unknown }>).opts.additionalProperties,
		).toBeUndefined();

		// Root anyOf is flattened to a single object schema, merging variant properties.
		const flattened = schemaOf({
			anyOf: [
				{ type: "object", properties: { a: { type: "string" } }, required: ["a"] },
				{ type: "object", properties: { b: { type: "number" } } },
			],
		});
		expect(flattened.anyOf).toBeUndefined();
		expect(flattened.oneOf).toBeUndefined();
		expect(flattened.allOf).toBeUndefined();
		expect(flattened.type).toBe("object");
		expect(flattened.properties).toEqual({ a: { type: "string" }, b: { type: "number" } });

		// Root allOf unions required across variants (AND semantics).
		const allOf = schemaOf({
			allOf: [
				{ type: "object", properties: { a: { type: "string" } }, required: ["a"] },
				{ type: "object", properties: { b: { type: "string" } }, required: ["b"] },
			],
		});
		expect(allOf.allOf).toBeUndefined();
		expect(allOf.type).toBe("object");
		expect(allOf.required).toEqual(expect.arrayContaining(["a", "b"]));

		// Root direct properties + sibling oneOf: keep root fields, merge variant (no data loss).
		const rootPlusOneOf = schemaOf({
			type: "object",
			properties: { keep: { type: "string" } },
			required: ["keep"],
			oneOf: [{ properties: { a: { type: "string" } } }],
		});
		expect(rootPlusOneOf.oneOf).toBeUndefined();
		expect(rootPlusOneOf.properties).toEqual({ keep: { type: "string" }, a: { type: "string" } });
		expect(rootPlusOneOf.required).toEqual(["keep"]);

		// oneOf AND allOf coexisting at root: both flattened, not just the first.
		const both = schemaOf({
			oneOf: [{ properties: { a: { type: "string" } } }],
			allOf: [{ properties: { b: { type: "string" } }, required: ["b"] }],
		});
		expect(both.oneOf).toBeUndefined();
		expect(both.allOf).toBeUndefined();
		expect(both.properties).toEqual({ a: { type: "string" }, b: { type: "string" } });
		expect(both.required).toEqual(["b"]);
	});

	test("long tool descriptions move into the system prompt instead of being truncated", () => {
		const longDescription = `Long docs ${"x".repeat(1100)} keep this tail.`;
		const context = {
			messages: [user("hi")],
			tools: [{ name: "longtool", description: longDescription, parameters: { type: "object" } }],
		} as unknown as Context;
		const { current } = dissect(buildPayload(context, "claude-sonnet-4.5", "conv-longdesc", "arn"));
		const tools = current.userInputMessageContext?.tools as Array<{ toolSpecification: { description: string } }>;
		// The toolSpecification carries only a short pointer (well under the 1024 limit).
		expect(tools[0].toolSpecification.description).toBe("Tool documentation moved to the system prompt: longtool.");
		// The full description survives in the system prefix prepended to the current message.
		expect(current.content).toContain("### Tool documentation: longtool");
		expect(current.content).toContain("keep this tail.");
	});

	test("user-message images ride on userInputMessage.images as CodeWhisperer bytes", () => {
		const { current } = dissect(
			buildPayload(ctx([userWithImage("look at this")]), "claude-sonnet-4.5", "conv-img", "arn"),
		);
		expect(current.content).toBe("look at this");
		expect(current.images).toEqual([{ format: "png", source: { bytes: PNG_B64 } }]);
	});

	test("image/jpg mime is normalized to the CodeWhisperer 'jpeg' format", () => {
		const { current } = dissect(
			buildPayload(ctx([userWithImage("shot", PNG_B64, "image/jpg")]), "claude-sonnet-4.5", "conv-jpg", "arn"),
		);
		expect(current.images).toEqual([{ format: "jpeg", source: { bytes: PNG_B64 } }]);
	});

	test("tool-result screenshots ride on the carrier userInputMessage.images", () => {
		const messages: Message[] = [
			user("open chrome"),
			assistant("", [{ id: "t1", name: "get_app_state" }]),
			toolResultWithImage("t1", "Looked at Google Chrome"),
		];
		const { current } = dissect(buildPayload(ctx(messages), "claude-sonnet-4.5", "conv-tool-img", "arn"));
		expect(current.userInputMessageContext?.toolResults?.[0]?.toolUseId).toBeDefined();
		expect(current.images).toEqual([{ format: "png", source: { bytes: PNG_B64 } }]);
	});

	test("vision-incapable models drop image bytes and append a placeholder", () => {
		const { current } = dissect(
			buildPayload(ctx([userWithImage("look")]), "glm-5", "conv-novision", "arn", { supportsImages: false }),
		);
		expect(current.images).toBeUndefined();
		expect(current.content).toContain("look");
		expect(current.content).toContain("[image omitted");
	});

	test("real text-only Kiro models resolve to supportsImages:false (gate matches catalog)", () => {
		// streamKiro derives the gate from `model.input.includes("image")`; confirm the bundled
		// catalog actually marks these as text-only so the placeholder path is reachable in practice.
		for (const id of ["glm-5", "minimax-m2.5", "qwen3-coder-next"]) {
			expect(getBundledModel("kiro", id).input.includes("image")).toBe(false);
		}
		// And a vision model stays enabled.
		expect(getBundledModel("kiro", "claude-sonnet-4.5").input.includes("image")).toBe(true);
	});
});

describe("Kiro model thinking metadata", () => {
	test("reasoning-capable Kiro models expose xhigh but not max", () => {
		const models = kiroModelManagerOptions().staticModels ?? [];
		const sonnet = models.find(model => model.id === "claude-sonnet-4.5");
		expect(sonnet).toBeDefined();
		expect(getSupportedEfforts(sonnet!)).toEqual([Effort.Low, Effort.Medium, Effort.High, Effort.XHigh]);
		expect(getSupportedEfforts(sonnet!)).not.toContain(Effort.Max);
	});

	test("bundled Kiro catalog stays capped at xhigh", () => {
		const sonnet = getBundledModel("kiro", "claude-sonnet-4.5");
		expect(getSupportedEfforts(sonnet)).toEqual([Effort.Low, Effort.Medium, Effort.High, Effort.XHigh]);
		expect(getSupportedEfforts(sonnet)).not.toContain(Effort.Max);
	});
});
