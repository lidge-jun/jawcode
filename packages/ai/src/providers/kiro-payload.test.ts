import { describe, expect, test } from "bun:test";
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

const ctx = (messages: Message[]): Context => ({ messages });

// ---------------------------------------------------------------------------
// Structural extractors / invariants
// ---------------------------------------------------------------------------

interface UIM {
	content: string;
	userInputMessageContext?: { toolResults?: Array<{ toolUseId: string }>; tools?: unknown[] };
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
		const { history, current } = dissect(buildPayload(ctx([user("hi")]), "claude-sonnet-4.5", "conv4", "arn"));
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
});
