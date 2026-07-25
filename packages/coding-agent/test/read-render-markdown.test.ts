import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { sanitizeText } from "@jawcode-dev/utils";
import { Settings } from "../src/config/settings";
import { getThemeByName, initTheme } from "../src/modes/theme/theme";
import type { ToolSession } from "../src/tools";
import { ReadTool, type ReadToolDetails, readToolRenderer } from "../src/tools/read";

const roots: string[] = [];

function session(cwd: string, renderMarkdown: boolean): ToolSession {
	const settings = Settings.isolated();
	settings.set("read.renderMarkdown", renderMarkdown);
	settings.set("read.summarize.enabled", false);
	return {
		cwd,
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings,
	} as ToolSession;
}

async function markdownFile(): Promise<{ root: string; file: string }> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-read-markdown-"));
	roots.push(root);
	const file = path.join(root, "README.md");
	await Bun.write(file, "# Heading\n\n**bold**\n");
	return { root, file };
}

async function rendered(details: ReadToolDetails, pathArg: string): Promise<string> {
	await initTheme(false, undefined, undefined, "red-claw", "blue-crab");
	const theme = await getThemeByName("red-claw");
	if (!theme) throw new Error("Expected red-claw theme");
	const component = readToolRenderer.renderResult(
		{ content: [{ type: "text", text: "# Heading\n\n**bold**\n" }], details },
		{ expanded: true, isPartial: false },
		theme,
		{ path: pathArg },
	);
	return sanitizeText(component.render(100).join("\n"));
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("read.renderMarkdown", () => {
	it("leaves local Markdown source untagged by default", async () => {
		const { root, file } = await markdownFile();
		const result = await new ReadTool(session(root, false)).execute("read", { path: file });
		expect(result.details?.contentType).toBeUndefined();
	});

	it("tags and renders a local Markdown file when opted in", async () => {
		const { root, file } = await markdownFile();
		const result = await new ReadTool(session(root, true)).execute("read", { path: file });
		expect(result.details?.contentType).toBe("text/markdown");
		expect(await rendered(result.details ?? {}, file)).not.toContain("# Heading");
	});

	it("renders protocol-supplied Markdown even when local tagging is off", async () => {
		const output = await rendered({ contentType: "text/markdown" }, "memory://root/note.md");
		expect(output).not.toContain("# Heading");
		expect(output).toContain("Heading");
	});

	it("never renders Markdown for a raw selector", async () => {
		const output = await rendered({ contentType: "text/markdown" }, "memory://root/note.md:raw");
		expect(output).toContain("# Heading");
		expect(output).toContain("**bold**");
	});
});
