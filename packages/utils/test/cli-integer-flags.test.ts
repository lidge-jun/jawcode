/**
 * `Flags.integer` used to accept a PREFIX of an integer.
 *
 * `Number.parseInt` stops at the first unusable character and returns what it
 * read, so `--limit 12abc` silently became `12` and `--timeout 3.9` became `3`.
 * A CLI that quietly reinterprets a mistyped number runs a different command
 * than the one the user asked for.
 *
 * The error type matters too: `run()` only renders usage for `CliParseError`,
 * so throwing a bare `Error` crashed with a stack trace instead of printing help.
 */
import { describe, expect, it } from "bun:test";
import { type CliConfig, CliParseError, Command, Flags } from "../src/cli";

class Probe extends Command {
	static flags = {
		n: Flags.integer({ description: "a number" }),
		withDefault: Flags.integer({ description: "defaulted", default: 20 }),
	};
	async run(): Promise<void> {}
}

const TEST_CONFIG: CliConfig = { bin: "jwc", version: "0.0.0-test", commands: new Map() };

async function parseN(argv: string[]): Promise<number | undefined> {
	const parsed = await new Probe(argv, TEST_CONFIG).parse(Probe);
	return parsed.flags.n;
}

describe("Flags.integer token validation", () => {
	it("accepts a plain integer", async () => {
		expect(await parseN(["--n", "42"])).toBe(42);
	});

	it("accepts an explicitly signed integer", async () => {
		expect(await parseN(["--n=+3"])).toBe(3);
		expect(await parseN(["--n=-5"])).toBe(-5);
	});

	it("keeps zero, which is a meaningful value for port and count flags", async () => {
		// `stats --port 0` asks the OS for an ephemeral port; rejecting 0 as
		// "not positive" would break that.
		expect(await parseN(["--n", "0"])).toBe(0);
	});

	it("tolerates surrounding whitespace from shell quoting", async () => {
		expect(await parseN(["--n", " 7 "])).toBe(7);
	});

	it("rejects trailing garbage instead of silently truncating it", async () => {
		// Previously `12`.
		await expect(parseN(["--n", "12abc"])).rejects.toThrow(/Expected an integer/);
	});

	it("rejects a decimal instead of silently flooring it", async () => {
		// Previously `3`, so `--timeout 3.9` ran with a different timeout.
		await expect(parseN(["--n", "3.9"])).rejects.toThrow(/Expected an integer/);
	});

	it("rejects hex, which previously parsed as zero", async () => {
		await expect(parseN(["--n", "0x10"])).rejects.toThrow(/Expected an integer/);
	});

	it("rejects exponent notation, which previously dropped the exponent", async () => {
		// Previously `1`, quietly turning 1e999 into a completely different number.
		await expect(parseN(["--n=1e999"])).rejects.toThrow(/Expected an integer/);
	});

	it("rejects non-numeric input", async () => {
		await expect(parseN(["--n", "abc"])).rejects.toThrow(/Expected an integer/);
	});

	it("rejects a value beyond the safe integer range", async () => {
		// Previously accepted as 1e20, where arithmetic silently loses precision.
		await expect(parseN(["--n", "99999999999999999999"])).rejects.toThrow(/safe integer range/);
	});

	it("throws CliParseError so run() renders usage instead of crashing", async () => {
		// A bare Error escapes run()'s handler as an uncaught exception.
		await expect(parseN(["--n", "abc"])).rejects.toBeInstanceOf(CliParseError);
	});

	it("still applies a declared default when the flag is absent", async () => {
		const parsed = await new Probe([], TEST_CONFIG).parse(Probe);
		expect(parsed.flags.withDefault).toBe(20);
		expect(parsed.flags.n).toBeUndefined();
	});
});
