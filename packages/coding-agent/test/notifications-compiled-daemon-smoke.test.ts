import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ownerPidFromOwnerId, parseDaemonInternalArgs } from "../src/notifications/daemon-cli";
import { transportPaths } from "../src/notifications/transport-state";

const repoRoot = path.resolve(import.meta.dir, "../../..");

function tempDir(prefix: string): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function runWithOutput(
	command: string[],
	opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(command, {
		cwd: opts.cwd,
		env: opts.env,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

describe("compiled Telegram daemon entrypoint", () => {
	it("parses hidden daemon flags and owner pid prefixes", () => {
		expect(
			parseDaemonInternalArgs([
				"--smoke",
				"--agent-dir",
				"/tmp/jwc-agent",
				"--owner-id=1234-session",
				"--max-ticks",
				"0",
			]),
		).toEqual({
			smoke: true,
			agentDir: "/tmp/jwc-agent",
			ownerId: "1234-session",
			maxTicks: 0,
		});
		expect(ownerPidFromOwnerId("1234-session")).toBe(1234);
		expect(ownerPidFromOwnerId("session-without-pid")).toBeUndefined();
	});

	it("hidden daemon CLI smoke creates the transport dir without leaking notification secrets", async () => {
		const agentDir = tempDir("jwc-compiled-daemon-agent-");
		const cwd = tempDir("jwc-compiled-daemon-cwd-");
		const secret = "123456:super-secret-token";
		try {
			const result = await runWithOutput(
				[
					"bun",
					"run",
					path.join(repoRoot, "packages/coding-agent/src/cli.ts"),
					"notify",
					"daemon-internal",
					"--smoke",
					"--agent-dir",
					agentDir,
				],
				{
					cwd,
					env: {
						...Bun.env,
						JWC_NOTIFICATIONS_TOKEN: secret,
					},
				},
			);

			expect(`${result.exitCode}\n${result.stdout}\n${result.stderr}`).toStartWith("0\n");
			expect(result.stdout).not.toContain(secret);
			expect(result.stderr).not.toContain(secret);

			const paths = transportPaths(agentDir);
			expect(fs.existsSync(paths.dir)).toBe(true);
			expect(fs.readdirSync(paths.dir).filter(name => name.includes(".smoke."))).toEqual([]);
		} finally {
			fs.rmSync(agentDir, { recursive: true, force: true });
			fs.rmSync(cwd, { recursive: true, force: true });
		}
	});

	it("build scripts list the daemon CLI as an explicit compile entrypoint", () => {
		const devBuildScript = fs.readFileSync(
			path.join(repoRoot, "packages/coding-agent/scripts/build-binary.ts"),
			"utf8",
		);
		const releaseBuildScript = fs.readFileSync(path.join(repoRoot, "scripts/ci-release-build-binaries.ts"), "utf8");

		expect(devBuildScript).toContain('"./src/notifications/daemon-cli.ts"');
		expect(releaseBuildScript).toContain('"./packages/coding-agent/src/notifications/daemon-cli.ts"');
	});
});
