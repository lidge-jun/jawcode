import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "../src/config/settings";
import type { ToolSession } from "../src/tools";
import { WriteTool } from "../src/tools/write";

const roots: string[] = [];

beforeAll(async () => {
	await Settings.init({ inMemory: true, cwd: process.cwd() });
});

function session(cwd: string): ToolSession {
	return {
		cwd,
		hasUI: false,
		enableLsp: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: Settings.isolated(),
	} as ToolSession;
}

async function workspace(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-write-selector-"));
	roots.push(root);
	await fs.mkdir(path.join(root, "src"), { recursive: true });
	return root;
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("write read-selector misfire guard", () => {
	it("rejects a missing selector-shaped empty target without creating it", async () => {
		const root = await workspace();
		const target = "src/example.ts:1-20:raw";

		await expect(new WriteTool(session(root)).execute("write", { path: target, content: "" })).rejects.toThrow(
			/read-tool selector.*read\(\{ path: "src\/example\.ts:1-20:raw" \}\)/s,
		);
		expect(await Bun.file(path.join(root, target)).exists()).toBe(false);
	});

	it("allows deliberate non-empty and existing literal selector-shaped files", async () => {
		const root = await workspace();
		const target = "src/example.ts:1-20:raw";
		const tool = new WriteTool(session(root));

		await tool.execute("write", { path: target, content: "intentional" });
		await tool.execute("write", { path: target, content: "" });
		expect(await Bun.file(path.join(root, target)).text()).toBe("");
	});
});
