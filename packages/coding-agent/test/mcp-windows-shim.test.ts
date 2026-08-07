/**
 * Windows `.cmd` shim launching for MCP stdio servers (CVE-2024-24576 / BatBadBut).
 *
 * Two layers, deliberately:
 *
 * - PURE: the escaping is argv-in/argv-out, so the security-critical construction
 *   is asserted on every host rather than only on Windows.
 * - REAL: an execution test that runs an actual `.cmd` shim. It is skipped off
 *   Windows because it cannot be faked — a hand-written model of `cmd.exe`'s
 *   parser would only reproduce whatever the implementation already assumes.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildCmdExeArgv,
	escapeCmdBatchArg,
	isWindowsBatchTarget,
	resolveWindowsBatchLaunch,
} from "../src/runtime-mcp/transports/windows-batch-launch";

const isWindows = process.platform === "win32";

describe("windows batch target detection", () => {
	it("recognizes the shim extensions cmd.exe must interpret", () => {
		expect(isWindowsBatchTarget("npx.cmd")).toBe(true);
		expect(isWindowsBatchTarget("C:\\tools\\thing.BAT")).toBe(true);
	});

	it("leaves directly executable targets alone", () => {
		expect(isWindowsBatchTarget("node.exe")).toBe(false);
		expect(isWindowsBatchTarget("npx")).toBe(false);
		expect(isWindowsBatchTarget("/usr/bin/node")).toBe(false);
	});
});

describe("cmd.exe argument escaping", () => {
	it("neutralizes %VAR% so cmd.exe cannot expand it", () => {
		const escaped = escapeCmdBatchArg("%USERPROFILE%");
		// Each literal % becomes `%%cd:~,%`, so `%USERPROFILE%` can no longer be read
		// as a variable reference: the name is separated from its opening % by an
		// empty expansion. Both percent signs must be neutralized, not just the first.
		expect(escaped).toBe('"%%cd:~,%USERPROFILE%%cd:~,%"');
		expect(escaped.split("%%cd:~,%").length - 1).toBe(2);
	});

	it("escapes embedded quotes rather than letting them close the string", () => {
		const escaped = escapeCmdBatchArg('say "hi"');
		expect(escaped.startsWith('"')).toBe(true);
		expect(escaped.endsWith('"')).toBe(true);
		expect(escaped).toContain('""');
	});

	it("quotes metacharacters that would otherwise chain a command", () => {
		for (const metacharacter of ["&", "|", "^", "<", ">", "&&", "||"]) {
			const escaped = escapeCmdBatchArg(`x${metacharacter}y`);
			expect(escaped.startsWith('"')).toBe(true);
			expect(escaped.endsWith('"')).toBe(true);
		}
	});

	it("quotes an empty argument so it survives as an argument", () => {
		expect(escapeCmdBatchArg("")).toBe('""');
	});

	it("doubles trailing backslashes so they cannot escape the closing quote", () => {
		const escaped = escapeCmdBatchArg("C:\\path\\");
		expect(escaped.endsWith('\\\\"')).toBe(true);
	});

	it("rejects NUL, CR and LF instead of silently truncating", () => {
		// Truncating here would smuggle whatever followed the newline.
		for (const bad of ["a\0b", "a\rb", "a\nb"]) {
			expect(() => escapeCmdBatchArg(bad)).toThrow(/NUL, CR, or LF/);
		}
	});

	it("leaves an ordinary token unquoted", () => {
		expect(escapeCmdBatchArg("-y")).toBe("-y");
		expect(escapeCmdBatchArg("@upstash/context7-mcp@latest")).toBe("@upstash/context7-mcp@latest");
	});

	it("quotes cmd.exe token separators so one argument cannot split into two", () => {
		// `,` `;` `=` and whitespace all delimit tokens for cmd.exe. Leaving them
		// unquoted silently turns `--define=a,b` into several arguments.
		for (const separator of [",", ";", "=", " ", "\t"]) {
			const escaped = escapeCmdBatchArg(`a${separator}b`);
			expect(escaped.startsWith('"')).toBe(true);
			expect(escaped.endsWith('"')).toBe(true);
		}
	});

	it("keeps a hostile argument inside its quoted region", () => {
		// Each attempt tries to close the quote early so `&whoami` lands unquoted.
		for (const hostile of ['a"&x', 'a\\"&x', 'a\\\\"&x', '"', "%"]) {
			const escaped = escapeCmdBatchArg(hostile);
			const quoteCount = (escaped.match(/"/g) ?? []).length;
			// A balanced count means no stray quote terminated the region early.
			expect(quoteCount % 2).toBe(0);
		}
	});
});

describe("cmd.exe argv construction", () => {
	it("escapes the command path too, so a % in the shim path cannot expand", () => {
		const argv = buildCmdExeArgv("cmd.exe", "C:\\odd%dir%\\npx.cmd", []);
		expect(argv.at(-1)).toContain("%%cd:~,%");
	});

	it("disables AutoRun and delayed expansion", () => {
		const argv = buildCmdExeArgv("cmd.exe", "npx.cmd", []);
		// /v:OFF matters: with delayed expansion on, a `!` in an argument expands.
		expect(argv.slice(0, 5)).toEqual(["cmd.exe", "/d", "/e:ON", "/v:OFF", "/c"]);
	});
});

describe("launch resolution", () => {
	it("rewrites a batch target on Windows and demands verbatim arguments", () => {
		const launch = resolveWindowsBatchLaunch("npx.cmd", ["-y", "pkg"], {
			platform: "win32",
			comspec: "cmd.exe",
		});
		expect(launch?.windowsVerbatimArguments).toBe(true);
		expect(launch?.argv[0]).toBe("cmd.exe");
	});

	it("does not rewrite a directly executable target", () => {
		expect(resolveWindowsBatchLaunch("node.exe", ["x"], { platform: "win32" })).toBeNull();
	});

	it("never rewrites off Windows", () => {
		expect(resolveWindowsBatchLaunch("npx.cmd", ["-y"], { platform: "darwin" })).toBeNull();
		expect(resolveWindowsBatchLaunch("npx.cmd", ["-y"], { platform: "linux" })).toBeNull();
	});
});

// Only a real cmd.exe can prove the escaping survives the real parser.
describe.skipIf(!isWindows)("real cmd.exe shim execution", () => {
	it("passes hostile arguments through literally without executing them", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-shim-"));
		const sentinel = path.join(dir, "PWNED.txt");
		const shim = path.join(dir, "echo-args.cmd");
		// The shim writes each argument on its own line so argv is checkable exactly.
		fs.writeFileSync(
			shim,
			'@echo off\r\n:loop\r\nif "%~1"=="" goto end\r\necho %~1\r\nshift\r\ngoto loop\r\n:end\r\n',
		);

		const hostile = ["%USERPROFILE%", 'say "hi"', `x&echo pwned>${sentinel}`, "a|b", "c^d"];
		const launch = resolveWindowsBatchLaunch(shim, hostile, { comspec: Bun.env.COMSPEC });
		expect(launch).not.toBeNull();

		const proc = Bun.spawn(launch?.argv ?? [], {
			cwd: dir,
			stdout: "pipe",
			stderr: "pipe",
			windowsVerbatimArguments: true,
		});
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;

		const received = stdout.split(/\r?\n/).filter(line => line.length > 0);
		expect(received).toEqual(hostile);
		// The injected `&echo` must never have run.
		expect(fs.existsSync(sentinel)).toBe(false);

		fs.rmSync(dir, { force: true, recursive: true });
	});
});
