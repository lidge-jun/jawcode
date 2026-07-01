import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	packageScriptCommand,
	planTasks,
	resolvePackageCwd,
	runCommand,
	type WorkspacePackage,
} from "./ci-dev-affected";

const packages: WorkspacePackage[] = [
	{
		name: "@jawcode-dev/example",
		dir: "packages/example",
		manifest: { name: "@jawcode-dev/example", scripts: { check: "true", test: "true" } },
	},
];

function planForPaths(paths: readonly string[]) {
	return planTasks(paths, packages);
}

describe("planTasks command shape", () => {
	test("no scheduled command embeds Bun cwd flags", () => {
		const tasks = planForPaths(["packages/example/src/index.ts", "python/robojwc/web/app.ts"]);
		expect(tasks.length).toBeGreaterThan(0);
		for (const task of tasks) {
			expect(task.command).not.toContain("--cwd");
			expect(task.command.some(arg => arg.startsWith("--cwd"))).toBe(false);
		}
	});

	test("package check/test tasks run in the package cwd", () => {
		const tasks = planForPaths(["packages/example/src/index.ts"]);
		const check = tasks.find(task => task.key === "check:@jawcode-dev/example");
		const runTest = tasks.find(task => task.key === "test:@jawcode-dev/example");
		expect(check?.command).toEqual(["bun", "run", "check"]);
		expect(runTest?.command).toEqual(["bun", "run", "test"]);
		expect(check?.cwd).toBe(resolvePackageCwd("packages/example"));
		expect(runTest?.cwd).toBe(resolvePackageCwd("packages/example"));
	});

	test("jwc web tasks run in the web cwd", () => {
		const tasks = planForPaths(["python/robojwc/web/app.ts"]);
		const typecheck = tasks.find(task => task.key === "jwc-web-typecheck");
		const build = tasks.find(task => task.key === "jwc-web-build");
		expect(typecheck?.command).toEqual(["bun", "run", "typecheck"]);
		expect(build?.command).toEqual(["bun", "run", "build"]);
		expect(typecheck?.cwd).toBe(resolvePackageCwd("python/robojwc/web"));
		expect(build?.cwd).toBe(resolvePackageCwd("python/robojwc/web"));
	});

	test("CI selector changes schedule the selector unit test", () => {
		const tasks = planForPaths(["scripts/ci-dev-affected.ts"]);
		expect(tasks.map(task => task.key)).toContain("affected-selftest");
		expect(tasks.find(task => task.key === "affected-selftest")?.command).toEqual([
			"bun",
			"test",
			"scripts/ci-dev-affected.test.ts",
		]);
	});
});

describe("runCommand cwd execution", () => {
	const tempDirs: string[] = [];

	afterAll(async () => {
		await Promise.all(tempDirs.map(dir => fs.rm(dir, { recursive: true, force: true })));
	});

	async function makePackage(): Promise<{ pkgDir: string; markerPath: string }> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-ci-dev-affected-"));
		tempDirs.push(tempDir);
		const pkgDir = path.join(tempDir, "pkg");
		await fs.mkdir(pkgDir, { recursive: true });
		const marker = "ran.marker";
		await fs.writeFile(
			path.join(pkgDir, "package.json"),
			JSON.stringify({
				name: "marker-pkg",
				scripts: {
					check: `node -e "require('node:fs').writeFileSync('${marker}','ran')"`,
					fail: "node -e \"process.exit(3)\"",
				},
			}),
		);
		return { pkgDir, markerPath: path.join(pkgDir, marker) };
	}

	test("the produced command actually runs the package script", async () => {
		const { pkgDir, markerPath } = await makePackage();
		const exitCode = await runCommand(packageScriptCommand("check"), pkgDir);
		expect(exitCode).toBe(0);
		expect(await Bun.file(markerPath).exists()).toBe(true);
	});

	test("a failing package script propagates its exit code", async () => {
		const { pkgDir } = await makePackage();
		const exitCode = await runCommand(packageScriptCommand("fail"), pkgDir);
		expect(exitCode).toBe(3);
	});
});
