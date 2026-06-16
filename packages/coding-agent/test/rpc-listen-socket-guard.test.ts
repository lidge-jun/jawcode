import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { isUnixSocketAlive } from "../src/modes/rpc/rpc-mode";
import { createHarnessCliEnv, type HarnessCliEnv } from "./harness-control-plane/cli-workspace-env";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const cliEntry = path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts");
const fixtureModelsYaml = `providers:
  rpc-test:
    auth: none
    api: openai-responses
    baseUrl: http://127.0.0.1:9/v1
    models:
      - id: rpc-test-model
        contextWindow: 100000
        maxTokens: 4096
        cost:
          input: 0
          output: 0
          cacheRead: 0
          cacheWrite: 0
`;

let workspace: string;
let agentDir: string;
let cliEnv: HarnessCliEnv;

beforeEach(async () => {
	workspace = await mkdtemp(path.join(tmpdir(), "rpc-listen-guard-"));
	agentDir = path.join(workspace, ".jwc", "agent");
	cliEnv = createHarnessCliEnv(repoRoot);
	await mkdir(agentDir, { recursive: true });
	await writeFile(path.join(agentDir, "models.yml"), fixtureModelsYaml);
	cliEnv.env.JWC_CODING_AGENT_DIR = agentDir;
	cliEnv.env.GJC_CODING_AGENT_DIR = agentDir;
	cliEnv.env.PI_CODING_AGENT_DIR = agentDir;
});

afterEach(async () => {
	cliEnv.cleanup();
	await rm(workspace, { recursive: true, force: true });
});

describe("rpc --listen socket guard", () => {
	test("detects missing, live, and stale Unix sockets", async () => {
		const socketPath = path.join(workspace, "guard.sock");
		expect(await isUnixSocketAlive(socketPath)).toBe(false);

		const server = Bun.listen({
			unix: socketPath,
			socket: { data() {}, open() {}, close() {}, error() {} },
		});
		try {
			expect(await isUnixSocketAlive(socketPath)).toBe(true);
		} finally {
			server.stop(true);
		}
		expect(await isUnixSocketAlive(socketPath)).toBe(false);
	});

	test("refuses to clobber a live listen socket", async () => {
		const socketPath = path.join(workspace, "owned.sock");
		const server = Bun.listen({
			unix: socketPath,
			socket: { data() {}, open() {}, close() {}, error() {} },
		});
		try {
			const result = Bun.spawnSync(
				[
					"bun",
					cliEntry,
					"--mode",
					"rpc",
					"--provider",
					"rpc-test",
					"--model",
					"rpc-test-model",
					"--session-dir",
					path.join(workspace, "sessions"),
					"--listen",
					socketPath,
				],
				{
					cwd: workspace,
					env: { ...cliEnv.env, GJC_HARNESS_STATE_ROOT: workspace, NO_COLOR: "1", PI_NOTIFICATIONS: "off" },
					stderr: "pipe",
					stdout: "pipe",
				},
			);
			const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
			expect(result.exitCode, output).not.toBe(0);
			expect(output).toContain("rpc listen socket already in use");
		} finally {
			server.stop(true);
		}
	});
});
