# WP15 — 10.048 dev/CI/release packaging (ADAPT)

> Goal `f8909338-255` · work-phase 15 · one FULL PABCD cycle.
> Card: `struct_har/chase/_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md` (GJC source, Decision A = ADAPT; active path before closure was `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md`).
> Source anchors checked: GJC `816aa07c` (false-green Bun cwd), `641e9294` (matrix fanout), `d7bce535` (irrelevant PR skip).
> JWC posture: adopt the small false-green guard slice now; defer broad runner matrix and release credential changes.

## Part 1 — Easy Explanation

JWC already has a usable dev/release pipeline, but one CI selector script still schedules package-scoped Bun commands by embedding `--cwd` inside the command array. GJC fixed this because Bun 1.3.x can print the `bun run` usage banner and exit 0 without running the package script, producing a false-green CI result. This cycle will make JWC's affected-path selector run package/web tasks by setting the process `cwd` explicitly, then add a focused test that proves the planned commands cannot regress to the false-green form. No npm token, trusted-publishing, release workflow, or runner-matrix rewrite is included.

Flow:

```text
changed path
  -> scripts/ci-dev-affected.ts planTasks()
  -> Task { command, cwd? }
  -> runCommand(command, cwd)
  -> focused ci-dev-affected.test.ts proves package/web scripts really run
  -> chase card closes with evidence
```

## Part 2 — Diff-Level Plan

### MODIFY `scripts/ci-dev-affected.ts`

Before:

```ts
interface Task {
	key: string;
	description: string;
	command: readonly string[];
}

const changedPaths = await getChangedPaths();
const workspaces = await getWorkspacePackages();
const tasks = planTasks(changedPaths, workspaces);
...
for (const workspacePackage of affectedPackages) {
	if (workspacePackage.manifest.scripts?.check) {
		add(tasks, `check:${workspacePackage.name}`, `Check ${workspacePackage.name}`, ["bun", "--cwd", workspacePackage.dir, "run", "check"]);
	}
	if (workspacePackage.manifest.scripts?.test) {
		add(tasks, `test:${workspacePackage.name}`, `Test ${workspacePackage.name}`, ["bun", "--cwd", workspacePackage.dir, "run", "test"]);
	}
}
...
add(tasks, "jwc-web-typecheck", "jwc web typecheck", ["bun", "--cwd=python/robojwc/web", "run", "typecheck"]);
...
async function runCommand(command: readonly string[]): Promise<number> {
	const [head, ...rest] = command;
	const proc = Bun.spawn([head, ...rest], { cwd: repoRoot, ... });
	return proc.exited;
}
```

After:

```ts
export interface PackageManifest {
	name?: string;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
}

export interface Task {
	key: string;
	description: string;
	command: readonly string[];
	cwd?: string;
}

async function main(): Promise<void> {
	const dryRun = process.argv.includes("--dry-run");
	const changedPaths = await getChangedPaths();
	const workspaces = await getWorkspacePackages();
	const tasks = planTasks(changedPaths, workspaces);
	printPlan(changedPaths, tasks);
	if (dryRun) return;
	for (const task of tasks) {
		console.log(`\n::group::${task.description}`);
		const exitCode = await runCommand(task.command, task.cwd ?? repoRoot);
		console.log("::endgroup::");
		if (exitCode !== 0) process.exit(exitCode);
	}
}

if (import.meta.main) {
	await main();
}

export async function runCommand(command: readonly string[], cwd: string = repoRoot): Promise<number> {
	const [head, ...rest] = command;
	const proc = Bun.spawn([head, ...rest], {
		cwd,
		env: process.env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});
	return proc.exited;
}

export function packageScriptCommand(script: string): readonly string[] {
	return ["bun", "run", script];
}

export function resolvePackageCwd(dir: string): string {
	return path.join(repoRoot, dir);
}

...
add(tasks, `check:${workspacePackage.name}`, `Check ${workspacePackage.name}`, packageScriptCommand("check"), resolvePackageCwd(workspacePackage.dir));
add(tasks, `test:${workspacePackage.name}`, `Test ${workspacePackage.name}`, packageScriptCommand("test"), resolvePackageCwd(workspacePackage.dir));
...
add(tasks, "jwc-web-typecheck", "jwc web typecheck", packageScriptCommand("typecheck"), resolvePackageCwd("python/robojwc/web"));
add(tasks, "jwc-web-build", "jwc web build", packageScriptCommand("build"), resolvePackageCwd("python/robojwc/web"));
...
if (paths.some(isWorkflowOrScriptPath)) {
	add(tasks, "affected-dry-run", "Affected CI selector self-check", ["bun", "scripts/ci-dev-affected.ts", "--dry-run"]);
	add(tasks, "affected-selftest", "Affected CI selector unit tests", ["bun", "test", "scripts/ci-dev-affected.test.ts"]);
	...
}
```

Implementation notes:

- `PackageManifest`, `WorkspacePackage`, `Task`, `planTasks`, `runCommand`, `packageScriptCommand`, and `resolvePackageCwd` become exported so the test can assert observable planner behavior without running the whole CI script at import time.
- The top-level script body moves into `main()` behind `if (import.meta.main)`; existing CLI behavior remains unchanged when executed as `bun scripts/ci-dev-affected.ts`.
- `printPlan()` appends `(cwd: <repo-relative>)` for tasks with a cwd, preserving debuggability without changing commands.
- `add()` accepts an optional `cwd` and stores it on `Task`.
- `isWorkflowHarnessPath()` includes `scripts/ci-dev-affected.test.ts`, so changes to the selector test trigger the selector self-test path.
- No `.github/workflows/dev-ci.yml` matrix fanout is adopted in this cycle.

### NEW `scripts/ci-dev-affected.test.ts`

Complete intended test file:

```ts
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
```

### MODIFY chase closure docs after B/C evidence

Only after focused tests and `bun run check:ts` pass:

- Move `struct_har/chase/10.048_gjc_chase_dev_ci_release_packaging.md` to `struct_har/chase/_fin/10/10.048_gjc_chase_dev_ci_release_packaging.md`.
- Update `struct_har/chase/10_gjc_chase_MOC.md`: row `048` link to `_fin/10/...`, status `✅ _fin`.
- Update `struct_har/chase/007_follow_index.md`: row `U13` link to `_fin/10/...`, status `✅ _fin`.
- Update `struct_har/chase/009_follow_tiers.md`: row `10.048` link to `_fin/10/...`, status `✅ _fin 260701 (ADAPT: affected-path false-green guard)`.
- Update `struct_har/chase/10.001_gjc_chase_cycle.md`: add a 2026-07-01 entry naming the source anchors, JWC commit, and verification.
- Update `struct_har/chase/_fin/INDEX.md` and `struct_har/chase/_fin/10/README.md` if their indexes require manual rows for 10.048.
- Update `devlog/_plan/260701_chase_tier1_impl/00_INDEX_slice_map.md`: mark WP15 closed.

## Invariants

- Public names stay JWC-first: `jwc`, `.jwc`, `@jawcode-dev/*`, `python/robojwc`.
- No release credentials, npm token fallback, trusted-publishing changes, or local publish paths.
- No broad `.github/workflows/dev-ci.yml` matrix rewrite in this cycle.
- The affected selector still supports the existing serial `bun scripts/ci-dev-affected.ts` entrypoint.
- Dry-run keeps printing the selected tasks without executing them.
- A package/web task must express directory scoping through `Task.cwd`, never through a `--cwd` command argument.

## Acceptance

| check | expectation |
|---|---|
| `planTasks(["packages/example/src/index.ts"], packages)` | package `check`/`test` commands are `["bun","run",...]` with `cwd` set |
| `planTasks(["python/robojwc/web/app.ts"], packages)` | web typecheck/build commands are `["bun","run",...]` with `cwd` set |
| `planTasks(["scripts/ci-dev-affected.ts"], packages)` | includes `affected-selftest` |
| `runCommand(packageScriptCommand("check"), tempPackageDir)` | marker file proves script executed |
| `runCommand(packageScriptCommand("fail"), tempPackageDir)` | returns non-zero exit code |

## Verification

- `bun test scripts/ci-dev-affected.test.ts`
- `CI_DEV_CHANGED_PATHS=scripts/ci-dev-affected.ts bun scripts/ci-dev-affected.ts --dry-run`
- `bun run check:ts`
- `git diff --check`

## PABCD Plan

- P: this doc.
- A: Backend employee audit — verify source anchors, JWC gap, import/export signatures, no release credential changes, and closure-doc list.
- B: implement the scoped selector/test slice, run focused test, request independent verifier.
- C: run focused dry-run, `bun run check:ts`, `git diff --check`; update chase closure docs.
- D: attest, commit atomically, update goal checkpoint, return to IDLE.

## Defer / Reject

| source item | decision | reason |
|---|---|---|
| GJC `641e9294` full affected matrix fanout | DEFER | larger workflow topology change; JWC serial dev-ci is already functional and the false-green guard is the concrete gap. |
| GJC hosted runner lane choices | DEFER | external runner availability/current infra decision, not needed for local selector correctness. |
| npm release auth or Trusted Publishing changes | REJECT for this cycle | JWC already has OIDC-first release source of truth in `structure/60_release_publishing.md`; changing credentials would widen the risk surface. |
| native platform split package work | DEFER | tracked separately by `10.063`; do not collapse into `10.048`. |
