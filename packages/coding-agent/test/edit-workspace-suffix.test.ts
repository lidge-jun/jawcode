import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "../src/config/settings";
import { EditTool } from "../src/edit";
import type { ToolSession } from "../src/tools";

const roots: string[] = [];

beforeAll(async () => {
	await Settings.init({ inMemory: true, cwd: process.cwd() });
});

function session(cwd: string, mode: "replace" | "patch" | "apply_patch"): ToolSession {
	const settings = Settings.isolated();
	settings.set("edit.mode", mode);
	return {
		cwd,
		hasUI: false,
		enableLsp: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings,
	} as ToolSession;
}

async function workspace(fileName: string): Promise<{ root: string; target: string }> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-edit-suffix-"));
	roots.push(root);
	const target = path.join(root, "src", fileName);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await Bun.write(target, "alpha\nbeta\n");
	return { root, target };
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("edit workspace suffix resolution", () => {
	it("resolves existing relative targets for replace and patch modes", async () => {
		for (const mode of ["replace", "patch"] as const) {
			const fileName = `${mode}.txt`;
			const { root, target } = await workspace(fileName);
			const tool = new EditTool(session(root, mode));
			if (mode === "replace") {
				await tool.execute("edit", { path: fileName, edits: [{ old_text: "alpha", new_text: "ALPHA" }] });
			} else {
				await tool.execute("edit", { path: fileName, edits: [{ op: "update", diff: "@@\n-alpha\n+ALPHA" }] });
			}
			expect(await Bun.file(target).text()).toStartWith("ALPHA");
			expect(await Bun.file(path.join(root, fileName)).exists()).toBe(false);
		}
	});

	it("reuses one resolved target for delete and add hunks of the same authored path", async () => {
		const { root, target } = await workspace("recreate.txt");
		const input = [
			"*** Begin Patch",
			"*** Delete File: recreate.txt",
			"*** Add File: recreate.txt",
			"+rewritten",
			"*** End Patch",
			"",
		].join("\n");

		await new EditTool(session(root, "apply_patch")).execute("edit", { input });

		expect(await Bun.file(target).text()).toBe("rewritten\n");
		expect(await Bun.file(path.join(root, "recreate.txt")).exists()).toBe(false);
	});
});
