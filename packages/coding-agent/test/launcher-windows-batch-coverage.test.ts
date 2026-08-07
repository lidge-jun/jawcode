/**
 * Every launcher that spawns a PATH-resolved command must handle `.cmd` shims.
 *
 * wp11 established the underlying fact: Bun hands a resolved `.cmd` path
 * straight to `CreateProcessW`, which cannot launch batch files at all. So on
 * Windows the process simply never starts. It fixed the MCP stdio transport;
 * LSP and DAP were carried forward as still-exposed and are fixed here.
 *
 * This matters because language servers and debug adapters are overwhelmingly
 * npm-installed — `typescript-language-server.cmd`, `pyright.cmd`, a bare
 * `npx` — so the exposure is the common case on Windows, not an edge one.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveWindowsBatchLaunch } from "@jawcode-dev/coding-agent/runtime/windows-batch-launch";

const SRC = path.join(import.meta.dir, "..", "src");

function read(relative: string): string {
	return fs.readFileSync(path.join(SRC, relative), "utf-8");
}

describe("batch-launch coverage across launchers", () => {
	it("routes an npm-shim language server through cmd.exe", () => {
		const launch = resolveWindowsBatchLaunch("C:\\npm\\typescript-language-server.cmd", ["--stdio"], {
			platform: "win32",
			comspec: "cmd.exe",
		});

		expect(launch).not.toBeNull();
		expect(launch?.argv[0]).toBe("cmd.exe");
		expect(launch?.windowsVerbatimArguments).toBe(true);
		// The shim path itself must be escaped too: a `%` in it would expand.
		expect(launch?.argv.join(" ")).toContain("typescript-language-server.cmd");
	});

	it("leaves a native binary alone", () => {
		// rust-analyzer is a real executable; routing it through cmd.exe would add
		// a shell layer for nothing.
		expect(resolveWindowsBatchLaunch("C:\\bin\\rust-analyzer.exe", [], { platform: "win32" })).toBeNull();
	});

	it("is inert off Windows", () => {
		expect(resolveWindowsBatchLaunch("/usr/bin/pyright", [], { platform: "darwin" })).toBeNull();
	});

	it("applies the resolution in the LSP launcher", () => {
		const source = read(path.join("lsp", "client.ts"));
		expect(source).toContain("resolveWindowsBatchLaunch(command, args)");
		// Computing the launch and then not using it is the failure this catches:
		// ablating only the argv substitution left the call site intact and the
		// weaker assertion green.
		expect(source).toContain("spawnOwnedProcess(batchLaunch?.argv ?? [command, ...args]");
		// The flag is mandatory on this path; libuv's own quoting would corrupt
		// the already-escaped cmd.exe command line.
		expect(source).toContain("windowsVerbatimArguments: true");
	});

	it("applies the resolution in the DAP stdio launcher", () => {
		const source = read(path.join("dap", "client.ts"));
		expect(source).toContain("resolveWindowsBatchLaunch(adapter.resolvedCommand, adapter.args)");
		expect(source).toContain("ptree.spawn(batchLaunch?.argv ?? [adapter.resolvedCommand, ...adapter.args]");
		expect(source).toContain("windowsVerbatimArguments: true");
	});

	it("keeps the helper outside the MCP subsystem now that three callers share it", () => {
		// It lived under runtime-mcp/transports. LSP and DAP importing from an
		// unrelated subsystem would be a false dependency.
		expect(fs.existsSync(path.join(SRC, "runtime", "windows-batch-launch.ts"))).toBe(true);
		expect(fs.existsSync(path.join(SRC, "runtime-mcp", "transports", "windows-batch-launch.ts"))).toBe(false);
	});
});
