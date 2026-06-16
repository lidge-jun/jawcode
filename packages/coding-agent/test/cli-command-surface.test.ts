import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs } from "../src/cli/args";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const cliEntry = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");

function extractCommandBlock(source: string, blockName: string): string[] {
	const commandsBlock = source.match(new RegExp(`const ${blockName}: CommandEntry\\[\\] = \\[([\\s\\S]*?)\\];`));
	if (!commandsBlock) return [];
	return [...commandsBlock[1].matchAll(/\bname:\s*"([^"]+)"/g)].map(match => match[1]);
}

describe("GJC public CLI command surface", () => {
	it("registers launch plus retained workflow/runtime utility endpoints (engine brand)", async () => {
		const source = await Bun.file(cliEntry).text();
		expect(extractCommandBlock(source, "baseCommands")).toEqual([
			"codex-native-hook",
			"state",
			"setup",
			"skills",
			"session",
			"harness",
			"coordinator",
			"team",
			"ultragoal",
			"ralplan",
			"config",
			"mcp-serve",
			"contribute-pr",
			"update",
			"launch",
		]);
	});

	it("gates the jaw-only surface behind the brand check (D050-24/25)", async () => {
		const source = await Bun.file(cliEntry).text();
		// interview (retrofit, D050-25), orchestrate (D050-24), goal (060/061) register only for jaw brands.
		expect(extractCommandBlock(source, "jawOnlyCommands")).toEqual([
			"interview",
			"orchestrate",
			"planphase",
			"goal",
			"memory",
			"chat",
		]);
		expect(source).toContain("isJawBrandEnv() ? jawOnlyCommands : []");
		// gjc diff-0: the base surface must not leak the jaw-only commands.
		const base = extractCommandBlock(source, "baseCommands");
		expect(base).not.toContain("interview");
		expect(base).not.toContain("orchestrate");
	});

	it("exposes orchestrate command help under the jaw brand only", () => {
		const jaw = Bun.spawnSync(["bun", cliEntry, "--help"], {
			cwd: repoRoot,
			env: { ...process.env, GJC_BRAND_NAME: "jwc" },
			stderr: "pipe",
			stdout: "pipe",
		});
		const jawOutput = `${jaw.stdout.toString()}\n${jaw.stderr.toString()}`;
		expect(jaw.exitCode, jawOutput).toBe(0);
		expect(jawOutput).toContain("orchestrate");
		expect(jawOutput).toContain("interview");

		// Fork default is the jaw brand (062.1 §4) — the engine surface needs an explicit opt-in.
		const engineEnv: Record<string, string | undefined> = { ...process.env, GJC_BRAND_NAME: "gjc" };
		delete engineEnv.JWC_BRAND_NAME;
		const engine = Bun.spawnSync(["bun", cliEntry, "--help"], {
			cwd: repoRoot,
			env: engineEnv,
			stderr: "pipe",
			stdout: "pipe",
		});
		const engineOutput = `${engine.stdout.toString()}\n${engine.stderr.toString()}`;
		expect(engine.exitCode, engineOutput).toBe(0);
		expect(engineOutput).toContain("orchestrate");
		expect(engineOutput).not.toContain("interview");
	}, 30_000);

	it("exposes the update command help without launching the TUI", () => {
		const result = Bun.spawnSync(["bun", cliEntry, "update", "--help"], {
			cwd: repoRoot,
			stderr: "pipe",
			stdout: "pipe",
		});
		const stdout = result.stdout.toString();
		const stderr = result.stderr.toString();
		const combined = `${stdout}\n${stderr}`;

		expect(result.exitCode, combined).toBe(0);
		expect(stdout).toContain("Check for and install updates");
		expect(combined).not.toContain("What's New");
		expect(combined).not.toContain("chatContainer");
	}, 30_000);

	it("documents the native CLI surface in command help", async () => {
		// interview/orchestrate are jaw-brand-only (D050-24/25), so their help probes set the brand env.
		const probes: Array<{ command: string; env?: Record<string, string> }> = [
			{ command: "ralplan" },
			{ command: "state" },
			{ command: "interview", env: { GJC_BRAND_NAME: "jwc" } },
			{ command: "orchestrate", env: { GJC_BRAND_NAME: "jwc" } },
		];
		for (const probe of probes) {
			const result = Bun.spawnSync(["bun", cliEntry, probe.command, "--help"], {
				cwd: repoRoot,
				env: { ...process.env, ...probe.env },
				stderr: "pipe",
				stdout: "pipe",
			});
			const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;

			expect(result.exitCode, output).toBe(0);
			expect(output).not.toContain("GJC_RUNTIME_BINARY");
			expect(output).not.toContain("private runtime");
		}
	}, 30_000);

	it("documents team dry-run state behavior in command help", async () => {
		const result = Bun.spawnSync(["bun", cliEntry, "team", "--help"], {
			cwd: repoRoot,
			stderr: "pipe",
			stdout: "pipe",
		});
		const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;

		expect(result.exitCode, output).toBe(0);
		expect(output).toContain("--dry-run");
		expect(output).toContain(".jwc/state/team");
		expect(output).toContain("do not commit");
		expect(output).toContain("existing tmux/JWC --tmux session");
		expect(output).toContain("jwc --tmux");
	}, 30_000);

	it("does not capture absolute-path prompts as startup slash commands", () => {
		const parsed = parseArgs(["/tmp/request.md", "--model", "opus", "summarize"]);

		expect(parsed.model).toBe("opus");
		expect(parsed.messages).toEqual(["/tmp/request.md", "summarize"]);
	});

	it("keeps startup slash payload intact after normal CLI flags", () => {
		const parsed = parseArgs([
			"--no-lsp",
			"/provider",
			"add",
			"--compat",
			"anthropic",
			"--provider",
			"minimax",
			"--base-url",
			"https://api.minimax.io/anthropic",
			"--api-key-env",
			"MINIMAX_APIKEY",
			"--model",
			"MiniMax-M2.7-highspeed",
		]);

		expect(parsed.noLsp).toBe(true);
		expect(parsed.provider).toBeUndefined();
		expect(parsed.model).toBeUndefined();
		expect(parsed.messages).toEqual([
			"/provider add --compat anthropic --provider minimax --base-url https://api.minimax.io/anthropic --api-key-env MINIMAX_APIKEY --model MiniMax-M2.7-highspeed",
		]);
	});

	it("keeps CLI slash-command invocations as one initial message", () => {
		const parsed = parseArgs([
			"/provider",
			"add",
			"--compat",
			"anthropic",
			"--provider",
			"minimax",
			"--base-url",
			"https://api.minimax.io/anthropic",
			"--api-key-env",
			"MINIMAX_APIKEY",
			"--model",
			"MiniMax-M2.7-highspeed",
		]);

		expect(parsed.messages).toEqual([
			"/provider add --compat anthropic --provider minimax --base-url https://api.minimax.io/anthropic --api-key-env MINIMAX_APIKEY --model MiniMax-M2.7-highspeed",
		]);
	});

	it("parses rpc listen socket arguments", () => {
		expect(parseArgs(["--mode", "rpc", "--listen", "/tmp/jwc.sock"]).rpcListenPath).toBe("/tmp/jwc.sock");
		expect(parseArgs(["--mode=rpc", "--listen=/tmp/jwc.sock"]).rpcListenPath).toBe("/tmp/jwc.sock");
		expect(() => parseArgs(["--mode", "rpc", "--listen"])).toThrow("--listen requires a socket path");
	});

	it("routes bare setup as the default workflow-skill setup command", async () => {
		const home = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-setup-command-home-"));
		try {
			const result = Bun.spawnSync(["bun", cliEntry, "setup", "--json"], {
				cwd: repoRoot,
				env: { ...process.env, HOME: home, GJC_CODING_AGENT_DIR: path.join(home, ".jwc", "agent") },
				stderr: "pipe",
				stdout: "pipe",
			});
			const stdout = result.stdout.toString();
			const stderr = result.stderr.toString();

			expect(result.exitCode, stderr).toBe(0);
			const payload = JSON.parse(stdout) as { written?: number; targetRoot?: string };
			expect(payload.written).toBe(7);
			expect(payload.targetRoot).toContain(path.join(home, ".jwc", "agent"));
		} finally {
			await fs.rm(home, { recursive: true, force: true });
		}
	}, 15_000);
});
