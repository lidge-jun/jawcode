import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { ModelProfileDefinition } from "../src/config/model-profiles";
import {
	type CoordinatorModelProfileLoader,
	CoordinatorModelProfileRegistryError,
	resolveCoordinatorMpreset,
} from "../src/coordinator-mcp/model-preset";
import { buildCoordinatorSessionCommand, createCoordinatorMcpServer } from "../src/coordinator-mcp/server";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

function profile(name: string): ModelProfileDefinition {
	return { name, requiredProviders: [], modelMapping: { default: "custom/model" }, source: "user" };
}

function loaderWithProfiles(...profiles: ModelProfileDefinition[]): CoordinatorModelProfileLoader {
	return () => new Map(profiles.map(candidate => [candidate.name, candidate]));
}

async function tempRoot(label: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), `jwc-mpreset-${label}-`));
	tempDirs.push(dir);
	return dir;
}

function serverEnv(root: string, stateRoot: string): NodeJS.ProcessEnv {
	return {
		JWC_COORDINATOR_MCP_WORKDIR_ROOTS: root,
		JWC_COORDINATOR_MCP_STATE_ROOT: stateRoot,
		JWC_COORDINATOR_MCP_MUTATIONS: "sessions",
		JWC_COORDINATOR_MCP_PROFILE: "local",
		JWC_COORDINATOR_MCP_REPO: "repo",
	};
}

describe("coordinator mpreset resolution", () => {
	it("treats only absent values as no selection and trims known profiles", async () => {
		const loadProfiles = loaderWithProfiles(profile("alpha"));

		await expect(resolveCoordinatorMpreset(undefined, loadProfiles)).resolves.toEqual({ ok: true, mpreset: null });
		await expect(resolveCoordinatorMpreset(null, loadProfiles)).resolves.toEqual({ ok: true, mpreset: null });
		await expect(resolveCoordinatorMpreset("  alpha  ", loadProfiles)).resolves.toEqual({
			ok: true,
			mpreset: "alpha",
		});
	});

	it("rejects malformed and unknown profiles with a bounded, sorted receipt", async () => {
		const loadProfiles = loaderWithProfiles(profile("zeta"), profile("alpha"));

		for (const raw of ["", "   ", 42]) {
			await expect(resolveCoordinatorMpreset(raw, loadProfiles)).resolves.toEqual({
				ok: false,
				reason: "unknown_model_profile",
				mpreset: "",
				available_profiles: ["alpha", "zeta"],
			});
		}
		await expect(resolveCoordinatorMpreset("x".repeat(500), loadProfiles)).resolves.toEqual({
			ok: false,
			reason: "unknown_model_profile",
			mpreset: "x".repeat(128),
			available_profiles: ["alpha", "zeta"],
		});
	});

	it("fails closed when the merged profile registry cannot load", async () => {
		const failingLoader: CoordinatorModelProfileLoader = () => {
			throw new CoordinatorModelProfileRegistryError(new Error("broken models.yml"));
		};

		await expect(resolveCoordinatorMpreset("alpha", failingLoader)).resolves.toEqual({
			ok: false,
			reason: "model_profile_registry_error",
			mpreset: "alpha",
			available_profiles: [],
		});
	});

	it("quotes the authoritative child command argument and leaves omission unchanged", () => {
		expect(buildCoordinatorSessionCommand("jwc --worktree", null)).toBe("jwc --worktree");
		expect(buildCoordinatorSessionCommand("jwc --worktree", "team's-profile")).toBe(
			"jwc --worktree --mpreset 'team'\\''s-profile'",
		);
	});
});

describe("coordinator mpreset session authority", () => {
	it("publishes mpreset on spawn and reuse schemas", async () => {
		const server = createCoordinatorMcpServer({ env: {} });
		const listed = await server.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
		const tools = listed.result.tools as Array<{
			name: string;
			inputSchema: { properties: Record<string, unknown> };
		}>;

		for (const name of ["jwc_coordinator_start_session", "jwc_coordinator_send_prompt"]) {
			expect(tools.find(tool => tool.name === name)?.inputSchema.properties).toHaveProperty("mpreset");
		}
	});

	it("resolves before spawn, passes the canonical value, and persists it for readback", async () => {
		const root = await tempRoot("persist");
		const stateRoot = path.join(root, ".jwc", "state");
		const starts: unknown[] = [];
		const server = createCoordinatorMcpServer({
			env: serverEnv(root, stateRoot),
			services: {
				resolveModelProfiles: loaderWithProfiles(profile("alpha")),
				startSession: input => {
					starts.push(input);
					return { sessionId: "jwc-alpha", cwd: input.cwd, createdAt: "2026-07-17T00:00:00.000Z" };
				},
			},
		});

		const started = await server.callTool("jwc_coordinator_start_session", {
			cwd: root,
			mpreset: "  alpha  ",
			allow_mutation: true,
		});
		const listed = await server.callTool("jwc_coordinator_list_sessions");
		const status = await server.callTool("jwc_coordinator_read_status", { session_id: "jwc-alpha" });

		expect(started).toMatchObject({ ok: true, session: { session_id: "jwc-alpha", mpreset: "alpha" } });
		expect(starts).toEqual([
			{
				cwd: root,
				prompt: undefined,
				mpreset: "alpha",
				namespace: { profile: "local", repo: "repo" },
				worktree: true,
			},
		]);
		expect(listed).toMatchObject({ sessions: [expect.objectContaining({ mpreset: "alpha" })] });
		expect(status).toMatchObject({ session: { session_id: "jwc-alpha", mpreset: "alpha" } });
	});

	it("rejects an unknown profile before the spawn adapter runs", async () => {
		const root = await tempRoot("unknown");
		let starts = 0;
		const server = createCoordinatorMcpServer({
			env: serverEnv(root, path.join(root, ".jwc", "state")),
			services: {
				resolveModelProfiles: loaderWithProfiles(profile("alpha")),
				startSession: () => {
					starts++;
					return { sessionId: "must-not-start" };
				},
			},
		});

		const response = await server.callTool("jwc_coordinator_start_session", {
			cwd: root,
			mpreset: "unknown",
			allow_mutation: true,
		});

		expect(response).toEqual({
			ok: false,
			reason: "unknown_model_profile",
			mpreset: "unknown",
			available_profiles: ["alpha"],
		});
		expect(starts).toBe(0);
	});

	it.each([
		["alpha", "alpha", true],
		["alpha", "beta", false],
		["alpha", null, true],
		[null, "alpha", false],
		[null, null, true],
	] as const)("fails closed when reused session profile %s conflicts with requested %s", async (active, requested, ok) => {
		const root = await tempRoot(`reuse-${active}-${requested}`);
		let starts = 0;
		const server = createCoordinatorMcpServer({
			env: serverEnv(root, path.join(root, ".jwc", "state")),
			services: {
				resolveModelProfiles: loaderWithProfiles(profile("alpha"), profile("beta")),
				startSession: input => {
					starts++;
					return { sessionId: "jwc-reuse", cwd: input.cwd, createdAt: "2026-07-17T00:00:00.000Z" };
				},
			},
		});
		await server.callTool("jwc_coordinator_start_session", {
			cwd: root,
			allow_mutation: true,
			...(active ? { mpreset: active } : {}),
		});

		const response = await server.callTool("jwc_coordinator_send_prompt", {
			session_id: "jwc-reuse",
			prompt: "continue",
			allow_mutation: true,
			...(requested ? { mpreset: requested } : {}),
		});

		if (ok) {
			expect(response).toMatchObject({ ok: true, session_id: "jwc-reuse" });
		} else {
			expect(response).toEqual({
				ok: false,
				reason: "mpreset_conflict",
				session_id: "jwc-reuse",
				session_mpreset: active,
				requested_mpreset: requested,
			});
		}
		expect(starts).toBe(1);
	});
});
