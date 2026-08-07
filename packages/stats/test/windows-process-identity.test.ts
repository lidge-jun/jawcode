/**
 * `readProcessIdentity` had no win32 branch, so `recoverStatsPort` could never
 * prove ownership on Windows: `jwc stats` refused to reuse its OWN running
 * dashboard and refused to reclaim its own stale port, leaving the port
 * permanently unusable with a message about an unidentifiable process.
 *
 * The probes shell out to Windows-only binaries, so what is testable here — and
 * where the real failure modes are — is the parsing of their output.
 */
import { describe, expect, it } from "bun:test";
import { parseWmicProcessIdentity } from "../src/server";

describe("Windows process identity parsing", () => {
	it("reads the wmic LIST format, including its blank padding lines", () => {
		// wmic /FORMAT:LIST emits CRLF and leading/trailing blank lines.
		const output = "\r\nCommandLine=C:\\bun\\bun.exe stats\r\nCreationDate=20260807120000.000000+000\r\n\r\n";
		expect(parseWmicProcessIdentity(output)).toEqual({
			startId: "20260807120000.000000+000",
			command: "C:\\bun\\bun.exe stats",
		});
	});

	it("reads the PowerShell fallback output", () => {
		const output = "CreationDate=20260807120000.000000+000\nCommandLine=C:\\bun\\bun.exe stats --port 3847\n";
		expect(parseWmicProcessIdentity(output)).toEqual({
			startId: "20260807120000.000000+000",
			command: "C:\\bun\\bun.exe stats --port 3847",
		});
	});

	it("keeps `=` inside a command line instead of truncating at the first one", () => {
		// Splitting on every `=` would corrupt any flag written as --key=value,
		// and the command is half of the identity comparison.
		const output = "CreationDate=20260807120000.000000+000\r\nCommandLine=bun.exe stats --port=3847 --json\r\n";
		expect(parseWmicProcessIdentity(output)?.command).toBe("bun.exe stats --port=3847 --json");
	});

	it("returns null when either half of the identity is missing", () => {
		// A partial identity must not be treated as proof of ownership — that is
		// what stops JWC from killing a foreign process.
		expect(parseWmicProcessIdentity("CreationDate=20260807120000.000000+000\r\n")).toBeNull();
		expect(parseWmicProcessIdentity("CommandLine=bun.exe stats\r\n")).toBeNull();
		expect(parseWmicProcessIdentity("")).toBeNull();
	});

	it("treats an empty value as missing rather than as an empty identity", () => {
		// wmic prints `CommandLine=` for processes it cannot read.
		expect(parseWmicProcessIdentity("CreationDate=20260807120000.000000+000\r\nCommandLine=\r\n")).toBeNull();
	});

	it("does not let a trailing empty repeat erase an already-read value", () => {
		// wmic can emit more than one block; a later blank field must not wipe out
		// the real one, which would turn a provable identity into "unidentifiable"
		// and leave the port stuck.
		const output = "CreationDate=20260807120000.000000+000\r\nCommandLine=bun.exe stats\r\nCommandLine=\r\n";
		expect(parseWmicProcessIdentity(output)?.command).toBe("bun.exe stats");
	});

	it("ignores unrelated keys in the output", () => {
		const output = "Caption=bun.exe\r\nCreationDate=20260807120000.000000+000\r\nCommandLine=bun.exe stats\r\n";
		expect(parseWmicProcessIdentity(output)).toEqual({
			startId: "20260807120000.000000+000",
			command: "bun.exe stats",
		});
	});
});
