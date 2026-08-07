/**
 * A huge PR diff must not be handed to the model whole.
 *
 * `pr://<n>/diff/all` returns the verbatim unified diff with no cap of its
 * own — the bound comes from the read tool's shared truncation. That is a
 * two-part contract split across files, so it is easy to break by accident:
 * adding `ignoreResultLimits` to the internal-URL path (as `skill://` has)
 * would silently let a 200k-line diff through and blow the context window.
 *
 * These pin the bound itself and the fact that the PR path does not opt out.
 */
import { describe, expect, it } from "bun:test";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "@jawcode-dev/coding-agent/session/streaming-output";

/** A unified diff far larger than any single-response budget. */
function hugeUnifiedDiff(fileCount: number, linesPerFile: number): string {
	const parts: string[] = [];
	for (let file = 0; file < fileCount; file += 1) {
		parts.push(`diff --git a/src/file${file}.ts b/src/file${file}.ts`);
		parts.push(`--- a/src/file${file}.ts`);
		parts.push(`+++ b/src/file${file}.ts`);
		for (let line = 0; line < linesPerFile; line += 1) {
			parts.push(`+const value${line} = ${line};`);
		}
	}
	return parts.join("\n");
}

describe("large PR diff truncation", () => {
	it("bounds a diff far larger than the response budget", () => {
		const diff = hugeUnifiedDiff(200, 500);
		expect(diff.split("\n").length).toBeGreaterThan(DEFAULT_MAX_LINES);

		const truncated = truncateHead(diff);

		expect(truncated.truncated).toBe(true);
		expect(truncated.content.split("\n").length).toBeLessThanOrEqual(DEFAULT_MAX_LINES);
		expect(Buffer.byteLength(truncated.content, "utf-8")).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
		// The head is kept, so the model still sees which files changed first.
		expect(truncated.content.startsWith("diff --git a/src/file0.ts")).toBe(true);
	});

	it("leaves a small diff untouched", () => {
		const diff = hugeUnifiedDiff(1, 5);
		const result = truncateHead(diff);

		// `truncated` is left unset rather than false on the untruncated path.
		expect(result.truncated).toBeFalsy();
		expect(result.content).toBe(diff);
	});

	it("does not let the PR diff path opt out of result limits", async () => {
		// `ignoreResultLimits` exists and is granted to `skill://`. If a future
		// change extends it to the pr:// family, the bound above stops applying
		// and nothing else would notice.
		const source = await Bun.file(new URL("../src/tools/read.ts", import.meta.url).pathname).text();
		const optOuts = source
			.split("\n")
			.filter(line => line.includes("ignoreResultLimits:"))
			.map(line => line.trim());

		expect(optOuts).toEqual(['ignoreResultLimits: scheme === "skill",']);
	});
});
