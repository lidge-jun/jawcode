import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { createHarnessCliEnv } from "./harness-control-plane/cli-workspace-env";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const cliEntry = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");

function runCli(args: string[]) {
	const cliEnv = createHarnessCliEnv(repoRoot);
	try {
		const result = Bun.spawnSync(["bun", cliEntry, ...args], {
			cwd: repoRoot,
			env: { ...cliEnv.env, NO_COLOR: "1", PI_NOTIFICATIONS: "off" },
			stderr: "pipe",
			stdout: "pipe",
		});
		return {
			exitCode: result.exitCode,
			stdout: result.stdout.toString(),
			stderr: result.stderr.toString(),
		};
	} finally {
		cliEnv.cleanup();
	}
}

describe("rpc --listen CLI validation", () => {
	it("rejects --listen outside rpc mode", () => {
		for (const args of [
			["--mode", "text", "--listen", "/tmp/jwc-rpc.sock"],
			["--mode", "rpc-ui", "--listen", "/tmp/jwc-rpc.sock"],
			["--listen", "/tmp/jwc-rpc.sock"],
		]) {
			const result = runCli(args);
			const output = `${result.stdout}\n${result.stderr}`;
			expect(result.exitCode, output).not.toBe(0);
			expect(output).toContain("--listen is only supported with --mode rpc");
		}
	});

	it("rejects missing --listen value", () => {
		const result = runCli(["--mode", "rpc", "--listen"]);
		const output = `${result.stdout}\n${result.stderr}`;
		expect(result.exitCode, output).not.toBe(0);
		expect(output).toContain("--listen requires a socket path");
	});

	it("documents --listen in global help", () => {
		const result = runCli(["--help"]);
		const output = `${result.stdout}\n${result.stderr}`;
		expect(result.exitCode, output).toBe(0);
		expect(output).toContain("--listen <path>");
	});
});
