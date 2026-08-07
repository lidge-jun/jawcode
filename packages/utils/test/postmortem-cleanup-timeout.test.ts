/**
 * Cleanup must not be able to hold the process hostage.
 *
 * Every fatal path — SIGINT, SIGTERM, uncaughtException, unhandledRejection —
 * awaits `runCleanup` BEFORE `process.exit`. `Promise.allSettled` never
 * settles if one callback never settles, so a single stuck cleanup made Ctrl-C
 * do nothing and left the user to kill the process by hand.
 *
 * These run in child processes: the module keeps a global callback list and a
 * one-shot `cleanupStage`, so cases cannot share a process.
 */
import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// A per-call `finally` is skipped when bun kills the runner on its own timeout,
// which a deliberately-hanging probe can trigger. Sweep at the end so a failed
// run never leaves a stray directory in the source tree.
const tempDirs = new Set<string>();
afterAll(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { force: true, recursive: true });
	tempDirs.clear();
});

/** Run `body` in a fresh Bun process with postmortem imported, return stdout. */
function runProbe(body: string, timeoutMs = 700): string {
	// Written inside the repo: from an unrelated cwd Bun resolves the PUBLISHED
	// @jawcode-dev/utils out of the install cache instead of this worktree.
	const dir = fs.mkdtempSync(path.join(import.meta.dir, ".tmp-postmortem-"));
	tempDirs.add(dir);
	try {
		const scriptPath = path.join(dir, "probe.ts");
		fs.writeFileSync(
			scriptPath,
			`import { register, cleanup, CLEANUP_TIMEOUT_MS } from "../../src/postmortem";\n${body}`,
		);
		const result = Bun.spawnSync({
			cmd: [process.execPath, scriptPath],
			cwd: path.join(import.meta.dir, ".."),
			// Shrink the watchdog so a deliberately stuck callback does not spend the
			// production budget inside the test suite.
			env: { HOME: os.homedir(), PATH: Bun.env.PATH ?? "", JWC_CLEANUP_TIMEOUT_MS: String(timeoutMs) },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = new TextDecoder().decode(result.stdout);
		if (result.exitCode !== 0) throw new Error(`${stdout}\n${new TextDecoder().decode(result.stderr)}`);
		return stdout.trim();
	} finally {
		fs.rmSync(dir, { force: true, recursive: true });
		tempDirs.delete(dir);
	}
}

describe("cleanup timeout", () => {
	it("returns even when a callback never settles", () => {
		const out = runProbe(`
register("hangs-forever", () => new Promise<void>(() => {}));
const started = Date.now();
await cleanup();
console.log(JSON.stringify({ returned: true, elapsedUnderBudget: Date.now() - started <= CLEANUP_TIMEOUT_MS + 5000 }));
`);
		expect(JSON.parse(out)).toEqual({ returned: true, elapsedUnderBudget: true });
	});

	it("does not wait out the budget when every callback settles", () => {
		// The watchdog must bound a hang, not add latency to a healthy shutdown.
		const out = runProbe(`
let ran = 0;
register("fast-sync", () => { ran++; });
register("fast-async", async () => { ran++; });
const started = Date.now();
await cleanup();
console.log(JSON.stringify({ ran, fast: Date.now() - started < 1000 }));
`);
		expect(JSON.parse(out)).toEqual({ ran: 2, fast: true });
	});

	it("still runs the callbacks that do settle alongside a stuck one", () => {
		// Bounding the wait must not skip healthy teardown: the SSH unmount still
		// has to happen even if the OTLP flush is wedged.
		const out = runProbe(`
let ran = 0;
register("hangs-forever", () => new Promise<void>(() => {}));
register("healthy", async () => { ran++; });
await cleanup();
console.log(JSON.stringify({ ran }));
`);
		expect(JSON.parse(out)).toEqual({ ran: 1 });
	});

	it("uses a 10 second budget by default", () => {
		// Pinned because the value is a product decision: long enough for network
		// teardown, short enough that Ctrl-C still feels like it worked.
		const out = runProbe(`console.log(JSON.stringify({ budget: CLEANUP_TIMEOUT_MS }));`, 10_000);
		expect(JSON.parse(out)).toEqual({ budget: 10_000 });
	});

	it("survives a callback that rejects", () => {
		const out = runProbe(`
let ran = 0;
register("throws", async () => { throw new Error("boom"); });
register("healthy", async () => { ran++; });
await cleanup();
console.log(JSON.stringify({ ran, survived: true }));
`);
		expect(JSON.parse(out)).toEqual({ ran: 1, survived: true });
	});
});
