import { describe, expect, it } from "bun:test";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const cliEntry = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");

function runCli(args: string[], brand: string): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(["bun", cliEntry, ...args], {
		cwd: repoRoot,
		env: { ...process.env, JWC_BRAND_NAME: brand, GJC_BRAND_NAME: brand },
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		// Hard kill — an unregistered subcommand falls through to the
		// interactive session and would otherwise hang the sync runner and
		// leak ~300MB orphans (260612 incident).
		timeout: 20_000,
	});
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode ?? -1,
	};
}

describe("memory/chat CLI surface (99.01 M5/M9)", () => {
	it("registers memory and chat under the jaw brand", () => {
		const help = runCli(["--help"], "jwc");
		expect(help.stdout).toContain("memory");
		expect(help.stdout).toContain("chat");
	}, 30_000);

	it("does not register memory/chat under the gjc engine brand (diff-0)", () => {
		// Help-surface assertion only: spawning an unregistered subcommand is
		// forbidden here — the CLI falls through to the interactive session
		// and never exits (260612 orphan-leak incident).
		const help = runCli(["--help"], "gjc");
		expect(help.stdout).not.toContain("memory search");
		expect(help.stdout).not.toContain("chat search");
	}, 30_000);

	it("memory command prints usage on missing verb", () => {
		const result = runCli(["memory"], "jwc");
		expect(result.exitCode).toBe(1);
		expect(result.stdout + result.stderr).toContain("memory search <query>");
	}, 30_000);

	it("chat command rejects non-search verbs", () => {
		const result = runCli(["chat", "history"], "jwc");
		expect(result.exitCode).toBe(1);
		expect(result.stdout + result.stderr).toContain("chat search <query>");
	}, 30_000);
});
