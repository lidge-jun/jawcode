import { describe, expect, it } from "bun:test";
import { EDIT_MODE_STRATEGIES } from "@jawcode-dev/coding-agent/edit";
import { parseApplyPatch } from "../src/edit/apply-patch";
import { validateEditHeaderPath } from "../src/edit/path-validation";

const previewContext = {
	cwd: process.cwd(),
	signal: new AbortController().signal,
	isStreaming: true,
};

describe("edit header path validation", () => {
	it("accepts relative paths with spaces", () => {
		expect(validateEditHeaderPath("docs/path with spaces.txt", "test")).toBe("docs/path with spaces.txt");
	});

	it("rejects empty, NUL, absolute, Windows, UNC, and traversal paths", () => {
		const invalid = [
			"",
			"   ",
			"a\0b",
			"/tmp/file",
			"C:\\tmp\\file",
			"\\\\server\\share\\file",
			"../x",
			"a/../x",
			"a/./x",
		];
		for (const raw of invalid) {
			expect(() => validateEditHeaderPath(raw, "test")).toThrow();
		}
	});

	it("rejects malformed apply_patch headers with a parse line number", () => {
		const patch = ["*** Begin Patch", "*** Update File: ../escape.ts", "@@", "-old", "+new", "*** End Patch"].join(
			"\n",
		);

		expect(() => parseApplyPatch(patch)).toThrow(/line 2|2/);
	});

	it("drops malformed apply_patch preview header paths without throwing", async () => {
		const previews = await EDIT_MODE_STRATEGIES.apply_patch.computeDiffPreview(
			{ input: `${["*** Begin Patch", "*** Update File: ../escape.ts", "@@", "+new"].join("\n")}\n` } as never,
			previewContext as never,
		);

		expect(previews).toBeNull();
	});

	it("drops malformed hashline preview header paths while valid headers still render", async () => {
		const invalid = await EDIT_MODE_STRATEGIES.hashline.computeDiffPreview(
			{ input: `${["§../escape.ts", "»BOF", "new"].join("\n")}\n` } as never,
			previewContext as never,
		);
		expect(invalid).toBeNull();

		const valid = await EDIT_MODE_STRATEGIES.hashline.computeDiffPreview(
			{ input: `${["§docs/ok.ts", "»BOF", "new"].join("\n")}\n` } as never,
			previewContext as never,
		);
		expect(valid?.[0]?.path).toBe("docs/ok.ts");
		expect(valid?.[0]?.diff).toContain("+new");
	});
});
