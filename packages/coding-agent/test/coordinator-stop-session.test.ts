import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createCoordinatorMcpServer } from "../src/coordinator-mcp/server";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

async function createHarness(): Promise<{
	root: string;
	stateRoot: string;
	stopped: string[];
	server: ReturnType<typeof createCoordinatorMcpServer>;
}> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-coordinator-stop-"));
	tempDirs.push(root);
	const stateRoot = path.join(root, ".jwc", "coordinator-state");
	const stopped: string[] = [];
	const server = createCoordinatorMcpServer({
		env: {
			JWC_COORDINATOR_MCP_WORKDIR_ROOTS: root,
			JWC_COORDINATOR_MCP_STATE_ROOT: stateRoot,
			JWC_COORDINATOR_MCP_MUTATIONS: "sessions",
			JWC_COORDINATOR_MCP_PROFILE: "local",
			JWC_COORDINATOR_MCP_REPO: "repo",
		},
		services: {
			startSession: input => ({ sessionId: "owned", cwd: input.cwd, createdAt: new Date().toISOString() }),
			stopSession: ({ sessionId }) => {
				stopped.push(sessionId);
				return true;
			},
		},
	});
	return { root, stateRoot, stopped, server };
}

describe("jwc_coordinator_stop_session", () => {
	it("stops an idle coordinator-owned session and removes its metadata", async () => {
		const { root, stateRoot, stopped, server } = await createHarness();
		await server.callTool("jwc_coordinator_start_session", { cwd: root, allow_mutation: true });

		expect(
			await server.callTool("jwc_coordinator_stop_session", { session_id: "owned", allow_mutation: true }),
		).toMatchObject({ ok: true, session_id: "owned", closed: true });
		expect(stopped).toEqual(["owned"]);
		expect(await Bun.file(path.join(stateRoot, "local", "repo", "sessions", "owned.json")).exists()).toBe(false);
	});

	it("fails closed when coordinator owner metadata is absent", async () => {
		const { stateRoot, stopped, server } = await createHarness();
		const file = path.join(stateRoot, "local", "repo", "sessions", "foreign.json");
		await fs.mkdir(path.dirname(file), { recursive: true });
		await Bun.write(file, JSON.stringify({ session_id: "foreign", ephemeral: true }));

		expect(
			await server.callTool("jwc_coordinator_stop_session", { session_id: "foreign", allow_mutation: true }),
		).toMatchObject({ ok: false, reason: "owner_unproven", closed: false });
		expect(stopped).toEqual([]);
		expect(await Bun.file(file).exists()).toBe(true);
	});

	it("does not stop a session while its durable turn is active", async () => {
		const { root, stopped, server } = await createHarness();
		const started = await server.callTool("jwc_coordinator_start_session", {
			cwd: root,
			prompt: "work",
			allow_mutation: true,
		});

		expect(
			await server.callTool("jwc_coordinator_stop_session", { session_id: "owned", allow_mutation: true }),
		).toMatchObject({ ok: false, reason: "active_turn", active_turn_id: started.turn_id, closed: false });
		expect(stopped).toEqual([]);
	});
});
