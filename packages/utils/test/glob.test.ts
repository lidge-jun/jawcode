import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getProjectDir, setProjectDir } from "../src/dirs";
import { globPaths } from "../src/glob";
import { Snowflake } from "../src/snowflake";

describe("globPaths", () => {
	let tempDir = "";
	let previousProjectDir = "";

	beforeEach(async () => {
		previousProjectDir = getProjectDir();
		tempDir = path.join(os.tmpdir(), "pi-utils-glob", Snowflake.next());
		await fs.mkdir(tempDir, { recursive: true });
		setProjectDir(tempDir);
	});

	afterEach(async () => {
		setProjectDir(previousProjectDir);
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("applies custom excludes while preserving included files", async () => {
		await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
		await fs.mkdir(path.join(tempDir, "dist"), { recursive: true });
		await fs.writeFile(path.join(tempDir, "src", "index.ts"), "export const ok = true;\n");
		await fs.writeFile(path.join(tempDir, "dist", "index.ts"), "export const built = true;\n");

		const results = await globPaths("**/*.ts", { cwd: tempDir, exclude: ["dist/**"] });

		expect(results).toEqual(["src/index.ts"]);
	});

	it("keeps default node_modules excludes when custom excludes are provided", async () => {
		await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
		await fs.mkdir(path.join(tempDir, "node_modules", "pkg"), { recursive: true });
		await fs.writeFile(path.join(tempDir, "src", "index.ts"), "export const ok = true;\n");
		await fs.writeFile(path.join(tempDir, "node_modules", "pkg", "index.ts"), "export const dep = true;\n");

		const results = await globPaths("**/*.ts", { cwd: tempDir, exclude: ["dist/**"] });

		expect(results).toEqual(["src/index.ts"]);
	});
});
