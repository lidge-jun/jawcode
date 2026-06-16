import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { readWorkflowModeStateJson, resolveGoalStoragePaths } from "../../src/jwc-runtime/legacy-storage";
import { runNativeStateCommand } from "../../src/jwc-runtime/state-runtime";

async function withTempCwd(fn: (cwd: string) => Promise<void>): Promise<void> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "legacy-storage-"));
	const prior = process.env.GJC_SESSION_ID;
	delete process.env.GJC_SESSION_ID;
	try {
		await fn(dir);
	} finally {
		if (prior !== undefined) process.env.GJC_SESSION_ID = prior;
		else delete process.env.GJC_SESSION_ID;
		await fs.rm(dir, { recursive: true, force: true });
	}
}

describe("PABCD-6 legacy storage dual-read", () => {
	it("reads plan mode state from ralplan-state.json when plan-state.json is absent", async () => {
		await withTempCwd(async cwd => {
			const stateDir = path.join(cwd, ".jwc", "state");
			await fs.mkdir(stateDir, { recursive: true });
			await fs.writeFile(
				path.join(stateDir, "ralplan-state.json"),
				JSON.stringify({ skill: "plan", current_phase: "planner", active: true }),
			);
			const { state, storagePath } = await readWorkflowModeStateJson(cwd, "plan");
			expect(state.current_phase).toBe("planner");
			expect(storagePath).toContain("ralplan-state.json");
		});
	});

	it("prefers canonical plan-state.json when both exist", async () => {
		await withTempCwd(async cwd => {
			const stateDir = path.join(cwd, ".jwc", "state");
			await fs.mkdir(stateDir, { recursive: true });
			await fs.writeFile(
				path.join(stateDir, "ralplan-state.json"),
				JSON.stringify({ skill: "plan", current_phase: "planner", active: true }),
			);
			await fs.writeFile(
				path.join(stateDir, "plan-state.json"),
				JSON.stringify({ skill: "plan", current_phase: "architect", active: true }),
			);
			const { state } = await readWorkflowModeStateJson(cwd, "plan");
			expect(state.current_phase).toBe("architect");
		});
	});

	it("resolves goal ledger from .jwc/ultragoal when .jwc/goal is empty", async () => {
		await withTempCwd(async cwd => {
			const legacyDir = path.join(cwd, ".jwc", "ultragoal");
			await fs.mkdir(legacyDir, { recursive: true });
			await fs.writeFile(
				path.join(legacyDir, "goals.json"),
				JSON.stringify({
					version: 1,
					brief: "legacy",
					jwcGoalMode: "aggregate",
					jwcObjective: "test",
					goals: [],
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				}),
			);
			const paths = await resolveGoalStoragePaths(cwd);
			expect(paths.dir).toContain("ultragoal");
			expect(paths.goalsPath).toContain("ultragoal");
		});
	});

	it("migrate ralplan alias persists to canonical plan-state.json", async () => {
		await withTempCwd(async cwd => {
			const stateDir = path.join(cwd, ".jwc", "state");
			await fs.mkdir(stateDir, { recursive: true });
			await fs.writeFile(path.join(stateDir, "ralplan-state.json"), JSON.stringify({ current_phase: "planning" }));
			const result = await runNativeStateCommand(["ralplan", "migrate", "--json"], cwd);
			expect(result.status).toBe(0);
			const canonical = JSON.parse(await fs.readFile(path.join(stateDir, "plan-state.json"), "utf-8")) as Record<
				string,
				unknown
			>;
			expect(canonical.current_phase).toBe("planner");
		});
	});
});
