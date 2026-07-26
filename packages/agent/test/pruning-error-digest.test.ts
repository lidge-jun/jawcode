import { describe, expect, test } from "bun:test";
import type { SessionMessageEntry } from "@jawcode-dev/agent-core/compaction/entries";
import { type PruneConfig, pruneToolOutputs } from "@jawcode-dev/agent-core/compaction/pruning";
import type { ToolResultMessage } from "@jawcode-dev/ai/types";

const config: PruneConfig = {
	protectTokens: 0,
	minimumSavings: 0,
	protectedTools: [],
};

function errorEntry(id: string, toolName: string, error: string): SessionMessageEntry {
	const context = Array.from({ length: 80 }, (_, index) => `bounded context ${index}`).join("\n");
	const message: ToolResultMessage = {
		role: "toolResult",
		toolCallId: `call-${id}`,
		toolName,
		content: [{ type: "text", text: `${error}\n${context}` }],
		isError: true,
		timestamp: Date.parse("2026-07-26T00:00:00.000Z"),
	};
	return {
		type: "message",
		id,
		parentId: null,
		timestamp: "2026-07-26T00:00:00.000Z",
		message,
	};
}

function textOf(entry: SessionMessageEntry): string {
	const content = (entry.message as ToolResultMessage).content;
	const first = Array.isArray(content) ? content[0] : undefined;
	return first?.type === "text" ? first.text : "";
}

describe("pruning error digests", () => {
	test("preserves sanitized actionable evidence for every errored tool kind", () => {
		const entries = [
			errorEntry("edit", "edit", "\u001b[31mPatch application failed.\u001b[0m\u0000"),
			errorEntry("write", "write", "Write error: permission denied"),
			errorEntry("other", "custom_tool", "Exception: remote adapter unavailable"),
		];

		const result = pruneToolOutputs(entries, config);

		expect(result.prunedCount).toBe(3);
		expect(textOf(entries[0]!)).toContain("error=Patch application failed.");
		expect(textOf(entries[1]!)).toContain("error=Write error: permission denied");
		expect(textOf(entries[2]!)).toContain("error=Exception: remote adapter unavailable");
		for (const entry of entries) {
			expect(textOf(entry)).toStartWith("[Output truncated - ");
			expect(textOf(entry)).not.toContain("\u001b");
			expect(textOf(entry)).not.toContain("\u0000");
			expect(textOf(entry)).not.toContain("bounded context 79");
		}
	});
});
