import { describe, expect, it } from "bun:test";
import {
	type BranchSummaryEntry,
	buildSessionContext,
	buildVisibleTranscriptContext,
	type CompactionEntry,
	type ModelChangeEntry,
	type SessionContext,
	type SessionEntry,
	type SessionMessageEntry,
	type ThinkingLevelChangeEntry,
} from "../../src/session/session-manager";

function msg(id: string, parentId: string | null, role: "user" | "assistant", text: string): SessionMessageEntry {
	const base = { type: "message" as const, id, parentId, timestamp: "2025-01-01T00:00:00Z" };
	if (role === "user") {
		return { ...base, message: { role, content: text, timestamp: 1 } };
	}
	return {
		...base,
		message: {
			role,
			content: [{ type: "text", text }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-test",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 1,
		},
	};
}

function compaction(id: string, parentId: string | null, summary: string, firstKeptEntryId: string): CompactionEntry {
	return {
		type: "compaction",
		id,
		parentId,
		timestamp: "2025-01-01T00:00:00Z",
		summary,
		firstKeptEntryId,
		tokensBefore: 1000,
	};
}

function branchSummary(id: string, parentId: string | null, summary: string, fromId: string): BranchSummaryEntry {
	return { type: "branch_summary", id, parentId, timestamp: "2025-01-01T00:00:00Z", summary, fromId };
}

function thinkingLevel(id: string, parentId: string | null, level: string): ThinkingLevelChangeEntry {
	return { type: "thinking_level_change", id, parentId, timestamp: "2025-01-01T00:00:00Z", thinkingLevel: level };
}

function modelChange(id: string, parentId: string | null, provider: string, modelId: string): ModelChangeEntry {
	return { type: "model_change", id, parentId, timestamp: "2025-01-01T00:00:00Z", model: `${provider}/${modelId}` };
}

function messageText(message: SessionContext["messages"][number]): string {
	if ("summary" in message && typeof message.summary === "string") return message.summary;
	if (!("content" in message)) return "";
	if (typeof message.content === "string") return message.content;
	return message.content.map(block => (block.type === "text" ? block.text : "")).join("");
}

describe("buildSessionContext", () => {
	describe("trivial cases", () => {
		it("empty entries returns empty context", () => {
			const ctx = buildSessionContext([]);
			expect(ctx.messages).toEqual([]);
			expect(ctx.thinkingLevel).toBe("off");
			expect(ctx.models).toEqual({});
		});

		it("single user message", () => {
			const entries: SessionEntry[] = [msg("1", null, "user", "hello")];
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(1);
			expect(ctx.messages[0].role).toBe("user");
		});

		it("rehydrates custom_message attribution from entries", () => {
			const entries: SessionEntry[] = [
				{
					type: "custom_message",
					id: "1",
					parentId: null,
					timestamp: "2025-01-01T00:00:00Z",
					customType: "skill-prompt",
					content: "Summarize this file",
					display: true,
					attribution: "user",
				},
			];
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(1);
			const customMessage = ctx.messages[0];
			expect(customMessage?.role).toBe("custom");
			if (customMessage?.role !== "custom") throw new Error("Expected custom message");
			expect(customMessage.attribution).toBe("user");
		});
		it("preserves missing custom_message attribution on rehydration", () => {
			const entries: SessionEntry[] = [
				{
					type: "custom_message",
					id: "1",
					parentId: null,
					timestamp: "2025-01-01T00:00:00Z",
					customType: "skill-prompt",
					content: "Summarize this file",
					display: true,
				},
			];
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(1);
			const customMessage = ctx.messages[0];
			expect(customMessage?.role).toBe("custom");
			if (customMessage?.role !== "custom") throw new Error("Expected custom message");
			expect(customMessage.attribution).toBeUndefined();
		});
		it("simple conversation", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				msg("2", "1", "assistant", "hi there"),
				msg("3", "2", "user", "how are you"),
				msg("4", "3", "assistant", "great"),
			];
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(4);
			expect(ctx.messages.map(m => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
		});

		it("tracks thinking level changes", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				thinkingLevel("2", "1", "high"),
				msg("3", "2", "assistant", "thinking hard"),
			];
			const ctx = buildSessionContext(entries);
			expect(ctx.thinkingLevel).toBe("high");
			expect(ctx.messages).toHaveLength(2);
		});

		it("tracks model from assistant message", () => {
			const entries: SessionEntry[] = [msg("1", null, "user", "hello"), msg("2", "1", "assistant", "hi")];
			const ctx = buildSessionContext(entries);
			expect(ctx.models.default).toBe("anthropic/claude-test");
		});

		it("tracks model from model change entry", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				modelChange("2", "1", "openai", "gpt-4"),
				msg("3", "2", "assistant", "hi"),
			];
			const ctx = buildSessionContext(entries);
			// Issue #849: an explicit model_change with role="default" must NOT
			// be silently overwritten by a later assistant message tagged with a
			// different model id. Temporary fallbacks and provider-side
			// downgrades both produce such mismatched messages.
			expect(ctx.models.default).toBe("openai/gpt-4");
		});
	});

	describe("with compaction", () => {
		it("includes summary before kept messages", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				msg("2", "1", "assistant", "response1"),
				msg("3", "2", "user", "second"),
				msg("4", "3", "assistant", "response2"),
				compaction("5", "4", "Summary of first two turns", "3"),
				msg("6", "5", "user", "third"),
				msg("7", "6", "assistant", "response3"),
			];
			const ctx = buildSessionContext(entries);

			// Should have: summary + kept (3,4) + after (6,7) = 5 messages
			expect(ctx.messages).toHaveLength(5);
			expect((ctx.messages[0] as any).summary).toContain("Summary of first two turns");
			expect((ctx.messages[1] as any).content).toBe("second");
			expect((ctx.messages[2] as any).content[0].text).toBe("response2");
			expect((ctx.messages[3] as any).content).toBe("third");
			expect((ctx.messages[4] as any).content[0].text).toBe("response3");
		});

		it("handles compaction keeping from first message", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				msg("2", "1", "assistant", "response"),
				compaction("3", "2", "Empty summary", "1"),
				msg("4", "3", "user", "second"),
			];
			const ctx = buildSessionContext(entries);

			// Summary + all messages (1,2,4)
			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[0] as any).summary).toContain("Empty summary");
		});

		it("uses preserved OpenAI replacement history instead of kept raw messages", () => {
			const remoteCompaction: CompactionEntry = {
				...compaction("3", "2", "Remote summary", "1"),
				preserveData: {
					openaiRemoteCompaction: {
						provider: "openai",
						replacementHistory: [
							{ type: "message", role: "user", content: [{ type: "input_text", text: "Preserved user" }] },
							{ type: "compaction", encrypted_content: "enc_123" },
						],
						compactionItem: { type: "compaction", encrypted_content: "enc_123" },
					},
				},
			};
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				msg("2", "1", "assistant", "response"),
				remoteCompaction,
				msg("4", "3", "user", "after compact"),
			];
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(2);
			expect(ctx.messages[0]?.role).toBe("compactionSummary");
			if (ctx.messages[0]?.role !== "compactionSummary") throw new Error("Expected compaction summary message");
			expect(ctx.messages[0].providerPayload).toEqual({
				type: "openaiResponsesHistory",
				provider: "openai",
				items: [
					{ type: "message", role: "user", content: [{ type: "input_text", text: "Preserved user" }] },
					{ type: "compaction", encrypted_content: "enc_123" },
				],
			});
			expect((ctx.messages[1] as { content: string }).content).toBe("after compact");
		});

		it("multiple compactions uses latest", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "a"),
				msg("2", "1", "assistant", "b"),
				compaction("3", "2", "First summary", "1"),
				msg("4", "3", "user", "c"),
				msg("5", "4", "assistant", "d"),
				compaction("6", "5", "Second summary", "4"),
				msg("7", "6", "user", "e"),
			];
			const ctx = buildSessionContext(entries);

			// Should use second summary, keep from 4
			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[0] as any).summary).toContain("Second summary");
		});

		it("stale firstKeptEntryId before previous compaction does not hydrate old messages", () => {
			// compaction cp2 has firstKeptEntryId="B" which is BEFORE compaction cp1.
			// The clamp must prevent messages A, B, C, D from being included.
			const entries: SessionEntry[] = [
				msg("A", null, "user", "msgA"),
				msg("B", "A", "assistant", "msgB"),
				msg("C", "B", "user", "msgC"),
				msg("D", "C", "assistant", "msgD"),
				compaction("cp1", "D", "First summary", "C"),
				msg("E", "cp1", "user", "msgE"),
				msg("F", "E", "assistant", "msgF"),
				compaction("cp2", "F", "Second summary", "B"), // stale: points before cp1
				msg("G", "cp2", "user", "msgG"),
			];
			const ctx = buildSessionContext(entries);

			// Only: summary + G (no kept messages since B is outside the clamped range)
			expect(ctx.messages).toHaveLength(2);
			expect((ctx.messages[0] as any).summary).toContain("Second summary");
			expect((ctx.messages[1] as any).content).toBe("msgG");

			// Pre-compaction1 messages must NOT appear
			const allText = ctx.messages.map((m: any) => m.content ?? m.summary ?? "").join(" ");
			expect(allText).not.toContain("msgA");
			expect(allText).not.toContain("msgB");
			expect(allText).not.toContain("msgC");
			expect(allText).not.toContain("msgD");
		});

		it("visible transcript context preserves pre-compaction messages", () => {
			const entries: SessionEntry[] = [
				msg("u1", null, "user", "script before compact"),
				msg("a1", "u1", "assistant", "answer before compact"),
				compaction("cp1", "a1", "summary", "a1"),
				msg("u2", "cp1", "user", "after compact"),
			];

			const modelContext = buildSessionContext(entries);
			const visibleContext = buildVisibleTranscriptContext(entries);

			const modelText = modelContext.messages.map(messageText).join(" ");
			expect(modelText).not.toContain("script before compact");

			expect(visibleContext.messages.map(message => message.role)).toEqual([
				"user",
				"assistant",
				"compactionSummary",
				"user",
			]);
			expect(visibleContext.messages.map(messageText).join(" ")).toContain("script before compact");
			expect(visibleContext.messages.map(messageText).join(" ")).toContain("answer before compact");
			expect(visibleContext.messages.map(messageText).join(" ")).toContain("summary");
			expect(visibleContext.messages.map(messageText).join(" ")).toContain("after compact");
		});

		it("visible transcript context preserves raw history across nested compactions", () => {
			const entries: SessionEntry[] = [
				msg("A", null, "user", "msgA"),
				msg("B", "A", "assistant", "msgB"),
				compaction("cp1", "B", "First summary", "B"),
				msg("C", "cp1", "user", "msgC"),
				msg("D", "C", "assistant", "msgD"),
				compaction("cp2", "D", "Second summary", "C"),
				msg("E", "cp2", "user", "msgE"),
			];

			const modelContext = buildSessionContext(entries);
			const visibleContext = buildVisibleTranscriptContext(entries);

			expect(modelContext.messages[0]?.role).toBe("compactionSummary");
			if (modelContext.messages[0]?.role !== "compactionSummary") throw new Error("Expected compaction summary");
			expect(modelContext.messages[0].summary).toContain("Second summary");

			expect(visibleContext.messages.map(message => message.role)).toEqual([
				"user",
				"assistant",
				"compactionSummary",
				"user",
				"assistant",
				"compactionSummary",
				"user",
			]);
			const visibleText = visibleContext.messages.map(messageText).join(" ");
			expect(visibleText).toContain("msgA");
			expect(visibleText).toContain("msgB");
			expect(visibleText).toContain("First summary");
			expect(visibleText).toContain("msgC");
			expect(visibleText).toContain("msgD");
			expect(visibleText).toContain("Second summary");
			expect(visibleText).toContain("msgE");
		});
	});

	describe("with branches", () => {
		it("follows path to specified leaf", () => {
			// Tree:
			//   1 -> 2 -> 3 (branch A)
			//         \-> 4 (branch B)
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "response"),
				msg("3", "2", "user", "branch A"),
				msg("4", "2", "user", "branch B"),
			];

			const ctxA = buildSessionContext(entries, "3");
			expect(ctxA.messages).toHaveLength(3);
			expect((ctxA.messages[2] as any).content).toBe("branch A");

			const ctxB = buildSessionContext(entries, "4");
			expect(ctxB.messages).toHaveLength(3);
			expect((ctxB.messages[2] as any).content).toBe("branch B");
		});

		it("includes branch summary in path", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "response"),
				msg("3", "2", "user", "abandoned path"),
				branchSummary("4", "2", "Summary of abandoned work", "3"),
				msg("5", "4", "user", "new direction"),
			];
			const ctx = buildSessionContext(entries, "5");

			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[2] as any).summary).toContain("Summary of abandoned work");
			expect((ctx.messages[3] as any).content).toBe("new direction");
		});

		it("complex tree with multiple branches and compaction", () => {
			// Tree:
			//   1 -> 2 -> 3 -> 4 -> compaction(5) -> 6 -> 7 (main path)
			//              \-> 8 -> 9 (abandoned branch)
			//                    \-> branchSummary(10) -> 11 (resumed from 3)
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "r1"),
				msg("3", "2", "user", "q2"),
				msg("4", "3", "assistant", "r2"),
				compaction("5", "4", "Compacted history", "3"),
				msg("6", "5", "user", "q3"),
				msg("7", "6", "assistant", "r3"),
				// Abandoned branch from 3
				msg("8", "3", "user", "wrong path"),
				msg("9", "8", "assistant", "wrong response"),
				// Branch summary resuming from 3
				branchSummary("10", "3", "Tried wrong approach", "9"),
				msg("11", "10", "user", "better approach"),
			];

			// Main path to 7: summary + kept(3,4) + after(6,7)
			const ctxMain = buildSessionContext(entries, "7");
			expect(ctxMain.messages).toHaveLength(5);
			expect((ctxMain.messages[0] as any).summary).toContain("Compacted history");
			expect((ctxMain.messages[1] as any).content).toBe("q2");
			expect((ctxMain.messages[2] as any).content[0].text).toBe("r2");
			expect((ctxMain.messages[3] as any).content).toBe("q3");
			expect((ctxMain.messages[4] as any).content[0].text).toBe("r3");

			// Branch path to 11: 1,2,3 + branch_summary + 11
			const ctxBranch = buildSessionContext(entries, "11");
			expect(ctxBranch.messages).toHaveLength(5);
			expect((ctxBranch.messages[0] as any).content).toBe("start");
			expect((ctxBranch.messages[1] as any).content[0].text).toBe("r1");
			expect((ctxBranch.messages[2] as any).content).toBe("q2");
			expect((ctxBranch.messages[3] as any).summary).toContain("Tried wrong approach");
			expect((ctxBranch.messages[4] as any).content).toBe("better approach");
		});
	});

	describe("edge cases", () => {
		it("uses last entry when leafId not found", () => {
			const entries: SessionEntry[] = [msg("1", null, "user", "hello"), msg("2", "1", "assistant", "hi")];
			const ctx = buildSessionContext(entries, "nonexistent");
			expect(ctx.messages).toHaveLength(2);
		});

		it("handles orphaned entries gracefully", () => {
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				msg("2", "missing", "assistant", "orphan"), // parent doesn't exist
			];
			const ctx = buildSessionContext(entries, "2");
			// Should only get the orphan since parent chain is broken
			expect(ctx.messages).toHaveLength(1);
		});
	});
});
