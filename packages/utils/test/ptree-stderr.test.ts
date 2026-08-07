/**
 * Bounded stderr retention in ptree's ChildProcess.
 *
 * `#stderrTail` was always capped, but `#stderrChunks` was allocated unconditionally
 * and every raw chunk pushed into it — so a long-lived noisy subprocess grew memory
 * for the life of the process even though nothing would ever read those chunks unless
 * the caller asked for `stderr: "full"`.
 *
 * The private array is deliberately unobservable, so these tests assert the OBSERVABLE
 * contract instead of claiming to inspect memory: with retention off, the only
 * surviving buffer is the capped tail, so a multi-megabyte producer must still yield a
 * small result.
 */
import { describe, expect, it } from "bun:test";
import { exec, NonZeroExitError, spawn } from "../src/ptree";

/**
 * Emit `count` lines of `size` bytes to stderr, then exit with `code`.
 *
 * Exits by setting `process.exitCode` rather than calling `process.exit()`, which
 * would drop buffered stderr writes and make byte-exact assertions flaky.
 */
function noisyStderr(count: number, size: number, code = 0): string[] {
	return [
		"bun",
		"-e",
		`const line = "x".repeat(${size}) + "\\n";
		 for (let i = 0; i < ${count}; i++) process.stderr.write(line);
		 process.exitCode = ${code};`,
	];
}

describe("ptree stderr retention", () => {
	it("keeps only the bounded tail when full capture was not requested", async () => {
		// ~2 MB of stderr through the default path.
		using child = spawn(noisyStderr(2048, 1024));
		const result = await child.wait();

		expect(result.exitCode).toBe(0);
		// The tail cap is 32 KiB; without it this would be ~2 MB.
		expect(result.stderr.length).toBeLessThanOrEqual(NonZeroExitError.MAX_TRACE);
		expect(result.stderr.length).toBeGreaterThan(0);
	});

	it("throws when full stderr is demanded but was not requested at spawn", async () => {
		// No `using` here: disposal would cancel the child while the rejection is still
		// in flight and mask the error under test.
		const child = spawn(noisyStderr(4, 16));
		// Loud failure beats silently handing back a truncated tail for an explicit
		// no-data-loss request.
		expect(() => child.wait({ stderr: "full" })).toThrow(/Full stderr capture must be requested/);
		await child.wait();
	});

	it("returns complete stderr when capture was requested at spawn", async () => {
		const lines = 2048;
		const size = 1024;
		using child = spawn(noisyStderr(lines, size), { stderr: "full" });
		const result = await child.wait({ stderr: "full" });

		expect(result.exitCode).toBe(0);
		expect(result.stderr.length).toBe(lines * (size + 1));
	});

	it("returns complete stderr through exec({ stderr: 'full' })", async () => {
		// exec forwards retention WITHOUT teeing an exposed stream it never reads;
		// before the split this path silently lost data or threw.
		const lines = 512;
		const size = 1024;
		const result = await exec(noisyStderr(lines, size), { stderr: "full" });

		expect(result.exitCode).toBe(0);
		expect(result.stderr.length).toBe(lines * (size + 1));
	});

	it("still bounds exec stderr when full capture is not requested", async () => {
		const result = await exec(noisyStderr(2048, 1024));
		expect(result.stderr.length).toBeLessThanOrEqual(NonZeroExitError.MAX_TRACE);
	});

	it("carries the trimmed tail on a non-zero exit", async () => {
		const result = await exec(noisyStderr(8, 64, 3), { allowNonZero: true });
		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain("x");
		expect(result.stderr.length).toBeLessThanOrEqual(NonZeroExitError.MAX_TRACE);
	});
});
