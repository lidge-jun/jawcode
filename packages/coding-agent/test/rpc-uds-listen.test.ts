import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { isUnixSocketAlive } from "../src/modes/rpc/rpc-mode";
import { listRpcSessions } from "../src/modes/shared/agent-wire/session-registry";
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

interface Frame {
	type?: string;
	id?: string;
	command?: string;
	success?: boolean;
	data?: unknown;
	error?: unknown;
}

interface SocketClient {
	nextFrame(timeoutMs?: number): Promise<Frame>;
	send(payload: object | string): void;
	close(): void;
}

let workspace: string;
let agentDir: string;
let cliEnv: HarnessCliEnv;

beforeEach(async () => {
	workspace = await mkdtemp(path.join(tmpdir(), "rpc-uds-ws-"));
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

async function waitForSocket(socketPath: string): Promise<void> {
	for (let i = 0; i < 100; i++) {
		if (await isUnixSocketAlive(socketPath)) return;
		await Bun.sleep(50);
	}
	throw new Error(`Timed out waiting for socket ${socketPath}`);
}

async function waitForRegistry(socketPath: string): Promise<void> {
	for (let i = 0; i < 100; i++) {
		const sessions = await listRpcSessions(agentDir);
		if (sessions.some(session => session.transport === "socket" && session.endpoint === socketPath)) return;
		await Bun.sleep(50);
	}
	throw new Error(`Timed out waiting for registry endpoint ${socketPath}`);
}

async function connectClient(socketPath: string): Promise<SocketClient> {
	const decoder = new TextDecoder("utf-8", { fatal: false });
	let buffer = "";
	const frames: Frame[] = [];
	const waiters: Array<(frame: Frame) => void> = [];
	const socket = await Bun.connect({
		unix: socketPath,
		socket: {
			data(_socket, data) {
				buffer += decoder.decode(data);
				while (true) {
					const nl = buffer.indexOf("\n");
					if (nl < 0) break;
					const line = buffer.slice(0, nl).trim();
					buffer = buffer.slice(nl + 1);
					if (!line) continue;
					const frame = JSON.parse(line) as Frame;
					const waiter = waiters.shift();
					if (waiter) waiter(frame);
					else frames.push(frame);
				}
			},
			open() {},
			close() {},
			error() {},
		},
	});
	return {
		nextFrame(timeoutMs = 10_000): Promise<Frame> {
			const frame = frames.shift();
			if (frame) return Promise.resolve(frame);
			let timer: ReturnType<typeof setTimeout> | undefined;
			return new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(new Error("Timed out waiting for UDS frame")), timeoutMs);
				waiters.push(next => {
					if (timer) clearTimeout(timer);
					resolve(next);
				});
			});
		},
		send(payload: object | string): void {
			const line = typeof payload === "string" ? payload : JSON.stringify(payload);
			socket.write(`${line}\n`);
		},
		close(): void {
			socket.end();
		},
	};
}

function spawnRpcListen(socketPath: string) {
	return Bun.spawn(
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
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		},
	);
}

describe("jwc --mode rpc --listen", () => {
	test("serves JSONL over a Unix socket and preserves registry rediscovery", async () => {
		const socketPath = path.join(workspace, "jwc-rpc.sock");
		const proc = spawnRpcListen(socketPath);
		const stderrText = new Response(proc.stderr).text();
		try {
			await waitForSocket(socketPath);
			await waitForRegistry(socketPath);
			const sessions = await listRpcSessions(agentDir);
			expect(sessions).toContainEqual(expect.objectContaining({ transport: "socket", endpoint: socketPath }));

			const first = await connectClient(socketPath);
			expect(await first.nextFrame()).toEqual({ type: "ready" });
			first.send({ id: "req_1", type: "get_state" });
			expect(await first.nextFrame()).toMatchObject({ id: "req_1", type: "response", success: true });

			first.send("{not-json");
			expect(await first.nextFrame()).toMatchObject({ type: "response", command: "parse", success: false });
			first.send({ id: "req_2", type: "get_state" });
			expect(await first.nextFrame()).toMatchObject({ id: "req_2", type: "response", success: true });
			first.close();

			const second = await connectClient(socketPath);
			expect(await second.nextFrame()).toEqual({ type: "ready" });
			second.send({ id: "req_3", type: "get_state" });
			expect(await second.nextFrame()).toMatchObject({ id: "req_3", type: "response", success: true });
			second.close();
		} finally {
			proc.kill();
		}
		await proc.exited;
		expect((await stderrText).trim()).toBe("");
		expect((await listRpcSessions(agentDir)).filter(session => session.endpoint === socketPath)).toEqual([]);
	}, 30_000);
});
