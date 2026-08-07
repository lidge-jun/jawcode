/**
 * A bad integer flag must render usage, not crash the process.
 *
 * `run()` only converts `CliParseError` into "message + usage + exit 2"
 * (`packages/utils/src/cli.ts`). The integer branch previously threw a bare
 * `Error`, so a mistyped `--limit` escaped as an uncaught exception with a
 * stack trace. This drives the real `run()` entry point against a real
 * registered command.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import { run } from "@jawcode-dev/utils/cli";
import GrepCommand from "../src/commands/grep";

afterEach(() => {
	vi.restoreAllMocks();
	process.exitCode = undefined;
});

describe("integer flag failure through run()", () => {
	it("prints the problem and usage, and sets a usage exit code", async () => {
		const stderr: string[] = [];
		vi.spyOn(process.stderr, "write").mockImplementation(chunk => {
			stderr.push(String(chunk));
			return true;
		});
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);

		// Must not reject: a usage mistake is not a crash.
		await run({
			bin: "jwc",
			version: "0.0.0-test",
			argv: ["grep", "--limit", "3.9", "pattern"],
			commands: [{ name: "grep", load: async () => GrepCommand }],
		});

		const output = stderr.join("");
		expect(output).toContain("--limit");
		expect(output).toContain("3.9");
		expect(process.exitCode).toBe(2);
	});
});
