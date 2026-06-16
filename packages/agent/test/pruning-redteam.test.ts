import { describe, expect, test } from "bun:test";
import { estimateTokens } from "@gajae-code/agent-core/compaction/compaction";
import type { SessionEntry, SessionMessageEntry } from "@gajae-code/agent-core/compaction/entries";
import { type PruneConfig, pruneToolOutputs } from "@gajae-code/agent-core/compaction/pruning";
import type { ToolResultMessage } from "@gajae-code/ai/types";

const timestamp = "2026-06-11T00:00:00.000Z";

function textForTokens(label: string, repetitions: number): string {
	return Array.from(
		{ length: repetitions },
		(_, index) => `${label}-${index.toString(36)} alpha beta gamma delta`,
	).join("\n");
}

function toolEntry(id: string, toolName: string, text: string, prunedAt?: number): SessionMessageEntry {
	const message: ToolResultMessage = {
		role: "toolResult",
		toolCallId: `call-${id}`,
		toolName,
		content: [{ type: "text", text }],
		isError: false,
		timestamp: Date.parse(timestamp),
	};
	if (prunedAt !== undefined) message.prunedAt = prunedAt;
	return {
		type: "message",
		id,
		parentId: null,
		timestamp,
		message,
	};
}

function customEntry(id: string): SessionEntry {
	return {
		type: "custom",
		id,
		parentId: null,
		timestamp,
		customType: "redteam-marker",
		data: { id },
	};
}

function textOf(entry: SessionMessageEntry): string {
	const content = (entry.message as ToolResultMessage).content;
	expect(Array.isArray(content)).toBe(true);
	const block = Array.isArray(content) ? content[0] : undefined;
	expect(block?.type).toBe("text");
	return block?.type === "text" ? block.text : "";
}

function tokens(entry: SessionMessageEntry): number {
	return estimateTokens(entry.message);
}

function savingsFor(entry: SessionMessageEntry): number {
	const tokenCount = tokens(entry);
	const noticeTokens = Math.ceil(`[Output truncated - ${tokenCount} tokens]`.length / 4);
	return Math.max(0, tokenCount - noticeTokens);
}

function config(overrides: Partial<PruneConfig> = {}): PruneConfig {
	return {
		protectTokens: 0,
		minimumSavings: 0,
		protectedTools: ["skill", "read"],
		...overrides,
	};
}

describe("pruneToolOutputs red-team boundaries", () => {
	test("minimumSavings boundary is strict below and inclusive at the threshold", () => {
		const recent = toolEntry("recent", "edit", "recent guard text");
		const old = toolEntry("old", "edit", textForTokens("old-boundary", 80));
		const threshold = savingsFor(old);

		const belowEntries = [
			toolEntry("old", "edit", textForTokens("old-boundary", 80)),
			toolEntry("recent", "edit", "recent guard text"),
		];
		const below = pruneToolOutputs(
			belowEntries,
			config({ protectTokens: tokens(recent), minimumSavings: threshold + 1 }),
		);
		expect(below.prunedCount).toBe(0);
		expect(below.tokensSaved).toBe(0);
		expect(below.prunedEntries).toEqual([]);
		expect(textOf(belowEntries[0] as SessionMessageEntry)).not.toStartWith("[Output truncated - ");

		const atEntries = [
			toolEntry("old", "edit", textForTokens("old-boundary", 80)),
			toolEntry("recent", "edit", "recent guard text"),
		];
		const at = pruneToolOutputs(atEntries, config({ protectTokens: tokens(recent), minimumSavings: threshold }));
		expect(at.prunedCount).toBe(1);
		expect(at.tokensSaved).toBe(threshold);
		expect(at.prunedEntries.map(entry => entry.id)).toEqual(["old"]);
		expect(textOf(atEntries[0] as SessionMessageEntry)).toBe(`[Output truncated - ${tokens(old)} tokens]`);
	});

	test("protect window accumulates newest-first and never prunes newest protected toolResults", () => {
		const old = toolEntry("old", "bash", textForTokens("old", 50));
		const middle = toolEntry("middle", "bash", textForTokens("middle", 50));
		const newest = toolEntry("newest", "bash", textForTokens("newest", 50));
		const entries = [old, middle, newest];

		const result = pruneToolOutputs(entries, config({ protectTokens: tokens(newest) + 1, minimumSavings: 0 }));

		expect(result.prunedEntries.map(entry => entry.id)).toEqual(["old"]);
		expect(textOf(old)).toStartWith("[Output truncated - ");
		expect(textOf(middle)).not.toStartWith("[Output truncated - ");
		expect(textOf(newest)).not.toStartWith("[Output truncated - ");
	});

	test("protected tool names are never pruned even when old and large", () => {
		const read = toolEntry("read-old", "read", textForTokens("read", 80));
		const skill = toolEntry("skill-old", "skill", textForTokens("skill", 80));
		const bash = toolEntry("bash-old", "bash", textForTokens("bash", 80));
		const newest = toolEntry("newest", "bash", "newest");
		const result = pruneToolOutputs(
			[read, skill, bash, newest],
			config({ protectTokens: tokens(newest), minimumSavings: 0 }),
		);

		expect(result.prunedEntries.map(entry => entry.id)).toEqual(["bash-old"]);
		expect(textOf(read)).not.toStartWith("[Output truncated - ");
		expect(textOf(skill)).not.toStartWith("[Output truncated - ");
		expect(textOf(bash)).toStartWith("[Output truncated - ");
	});

	test("already-pruned entries are not re-pruned and still count toward the protect window", () => {
		const old = toolEntry("old", "bash", textForTokens("old", 50));
		const alreadyPruned = toolEntry("already", "bash", "[Output truncated - 400 tokens]", 12345);
		const newest = toolEntry("newest", "bash", textForTokens("newest", 50));
		const entries = [old, alreadyPruned, newest];

		const result = pruneToolOutputs(
			entries,
			config({ protectTokens: tokens(newest) + tokens(alreadyPruned), minimumSavings: 0 }),
		);

		expect(result.prunedEntries.map(entry => entry.id)).toEqual(["old"]);
		expect((alreadyPruned.message as ToolResultMessage).prunedAt).toBe(12345);
		expect(textOf(alreadyPruned)).toBe("[Output truncated - 400 tokens]");
	});

	test("prunedEntries contains exactly mutated entries with preserved ids, truncation notice, and numeric prunedAt", () => {
		const pruneA = toolEntry("prune-a", "edit", textForTokens("a", 40));
		const pruneB = toolEntry("prune-b", "edit", textForTokens("b", 40));
		const newest = toolEntry("newest", "bash", "newest");
		const originalTokens = new Map([
			["prune-a", tokens(pruneA)],
			["prune-b", tokens(pruneB)],
		]);

		const result = pruneToolOutputs(
			[pruneA, customEntry("interleaved"), pruneB, newest],
			config({ protectTokens: tokens(newest), minimumSavings: 0 }),
		);

		expect(result.prunedEntries).toEqual([pruneB, pruneA]);
		expect(result.prunedEntries.map(entry => entry.id)).toEqual(["prune-b", "prune-a"]);
		for (const entry of result.prunedEntries) {
			expect(textOf(entry)).toBe(`[Output truncated - ${originalTokens.get(entry.id)} tokens]`);
			expect(typeof (entry.message as ToolResultMessage).prunedAt).toBe("number");
		}
		expect(result.prunedEntries.every(entry => textOf(entry).startsWith("[Output truncated - "))).toBe(true);
	});

	test("adversarial inputs: empty entries, non-messages, empty content, zero thresholds, and duplicate outputs", () => {
		expect(pruneToolOutputs([], config())).toEqual({ prunedCount: 0, tokensSaved: 0, prunedEntries: [] });

		const empty = toolEntry("empty", "edit", "");
		const duplicateA = toolEntry("dup-a", "edit", textForTokens("duplicate", 40));
		const duplicateB = toolEntry("dup-b", "edit", textForTokens("duplicate", 40));
		const entries: SessionEntry[] = [
			customEntry("start"),
			empty,
			customEntry("middle"),
			duplicateA,
			customEntry("middle-2"),
			duplicateB,
		];
		const result = pruneToolOutputs(entries, config({ protectTokens: 0, minimumSavings: 0 }));

		expect(result.prunedEntries.map(entry => entry.id)).toEqual(["dup-b", "dup-a", "empty"]);
		expect(result.prunedCount).toBe(3);
		expect(textOf(empty)).toBe("[Output truncated - 0 tokens]");
		expect(textOf(duplicateA)).toStartWith("[Output truncated - ");
		expect(textOf(duplicateB)).toStartWith("[Output truncated - ");
	});

	test("digest-capable pruned notices include bounded bash/search summaries and tokensSaved uses actual notice length", () => {
		const bash = toolEntry(
			"bash-digest",
			"bash",
			`${textForTokens("bash-digest", 40)}\nerror: compile failed\ndone tail`,
		);
		(bash.message as ToolResultMessage & { details?: unknown }).details = { exitCode: 2 };
		const search = toolEntry(
			"search-digest",
			"search",
			`12 matches across 3 files\n${textForTokens("search-digest", 40)}`,
		);
		const grep = toolEntry("grep-digest", "grep", `8 matches in 2 files\n${textForTokens("grep-digest", 20)}`);
		const unavailable = toolEntry("search-unavailable", "search", textForTokens("search-unavailable", 20));
		const generic = toolEntry("generic", "edit", textForTokens("generic", 20));
		const originalTokens = new Map([
			[bash.id, tokens(bash)],
			[search.id, tokens(search)],
			[grep.id, tokens(grep)],
			[unavailable.id, tokens(unavailable)],
			[generic.id, tokens(generic)],
		]);
		const result = pruneToolOutputs(
			[bash, search, grep, unavailable, generic],
			config({ protectTokens: 0, minimumSavings: 0 }),
		);

		expect(result.prunedEntries.map(entry => entry.id)).toEqual([
			"generic",
			"search-unavailable",
			"grep-digest",
			"search-digest",
			"bash-digest",
		]);
		const bashNotice = textOf(bash);
		const searchNotice = textOf(search);
		const grepNotice = textOf(grep);
		const unavailableNotice = textOf(unavailable);
		const genericNotice = textOf(generic);
		expect(bashNotice).toStartWith(`[Output truncated - ${originalTokens.get(bash.id)} tokens; `);
		expect(bashNotice).toContain("exit=2");
		expect(bashNotice).toContain("tail=done tail");
		expect(bashNotice).toContain("error=error: compile failed");
		expect(searchNotice).toContain("matches=12");
		expect(searchNotice).toContain("files=3");
		expect(searchNotice).toStartWith(`[Output truncated - ${originalTokens.get(search.id)} tokens; `);
		expect(grepNotice).toContain("matches=8");
		expect(grepNotice).toContain("files=2");
		expect(unavailableNotice).toContain("search digest unavailable");
		expect(genericNotice).toBe(`[Output truncated - ${originalTokens.get(generic.id)} tokens]`);

		const expectedSavings = [bash, search, grep, unavailable, generic].reduce((sum, entry) => {
			const noticeTokens = Math.ceil(textOf(entry).length / 4);
			return sum + Math.max(0, (originalTokens.get(entry.id) ?? 0) - noticeTokens);
		}, 0);
		expect(result.tokensSaved).toBe(expectedSavings);
		expect(bashNotice.length).toBeLessThan(`[Output truncated - ${originalTokens.get(bash.id)} tokens]`.length + 120);
	});
	test("mutating returned prunedEntries does not make the same entries re-prunable on a second call", () => {
		const old = toolEntry("old", "bash", textForTokens("old", 50));
		const newest = toolEntry("newest", "bash", "newest");
		const entries = [old, newest];

		const first = pruneToolOutputs(entries, config({ protectTokens: tokens(newest), minimumSavings: 0 }));
		expect(first.prunedEntries.map(entry => entry.id)).toEqual(["old"]);
		(first.prunedEntries[0].message as ToolResultMessage).content = [
			{ type: "text", text: "external mutation after pruning" },
		];

		const second = pruneToolOutputs(entries, config({ protectTokens: tokens(newest), minimumSavings: 0 }));
		expect(second).toEqual({ prunedCount: 0, tokensSaved: 0, prunedEntries: [] });
		expect((old.message as ToolResultMessage).prunedAt).toBeNumber();
	});
});
