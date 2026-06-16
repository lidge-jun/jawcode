import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runNativeStateCommand } from "@jawcode-dev/coding-agent/jwc-runtime/state-runtime";

const tempRoots: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-state-doctor-"));
	tempRoots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

let priorSessionId: string | undefined;
beforeAll(() => {
	priorSessionId = process.env.GJC_SESSION_ID;
	delete process.env.GJC_SESSION_ID;
});
afterAll(() => {
	if (priorSessionId !== undefined) process.env.GJC_SESSION_ID = priorSessionId;
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function snapshotFiles(root: string): Promise<Map<string, { bytes: Buffer; mtimeMs: number }>> {
	const out = new Map<string, { bytes: Buffer; mtimeMs: number }>();
	async function visit(dir: string): Promise<void> {
		let entries: string[];
		try {
			entries = await fs.readdir(dir);
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === "ENOENT") return;
			throw error;
		}
		for (const entry of entries.sort()) {
			const filePath = path.join(dir, entry);
			const stat = await fs.stat(filePath);
			if (stat.isDirectory()) {
				await visit(filePath);
			} else if (stat.isFile()) {
				out.set(path.relative(root, filePath), { bytes: await fs.readFile(filePath), mtimeMs: stat.mtimeMs });
			}
		}
	}
	await visit(root);
	return out;
}

function expectUnchanged(
	before: Map<string, { bytes: Buffer; mtimeMs: number }>,
	after: Map<string, { bytes: Buffer; mtimeMs: number }>,
): void {
	expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
	for (const [relativePath, beforeFile] of before) {
		const afterFile = after.get(relativePath);
		expect(afterFile, relativePath).toBeDefined();
		expect(afterFile?.bytes.equals(beforeFile.bytes), relativePath).toBe(true);
		expect(afterFile?.mtimeMs, relativePath).toBe(beforeFile.mtimeMs);
	}
}

async function runDoctorUnchanged(
	root: string,
	args: string[],
): Promise<Awaited<ReturnType<typeof runNativeStateCommand>>> {
	const before = await snapshotFiles(path.join(root, ".jwc"));
	const result = await runNativeStateCommand(args, root);
	const after = await snapshotFiles(path.join(root, ".jwc"));
	expectUnchanged(before, after);
	return result;
}

async function writeStampedState(root: string, skill: string, value: Record<string, unknown>): Promise<string> {
	const result = await runNativeStateCommand(
		["write", "--mode", skill, "--input", JSON.stringify(value), "--replace"],
		root,
	);
	expect(result.status).toBe(0);
	return path.join(root, ".jwc", "state", `${skill}-state.json`);
}

describe("jwc state doctor", () => {
	it("reports clean state with zero exit and deterministic JSON summary", async () => {
		const root = await tempDir();
		const statePath = await writeStampedState(root, "jaw-interview", {
			active: true,
			current_phase: "interviewing",
		});
		expect(statePath).toContain("jaw-interview-state.json");
		await writeJson(path.join(root, ".jwc", "state", "audit.jsonl"), { seeded: true });

		const result = await runDoctorUnchanged(root, ["doctor", "--json"]);
		expect(result.status).toBe(0);
		const parsed = JSON.parse(result.stdout ?? "{}");
		expect(parsed).toMatchObject({ ok: true, problems: [] });
		expect(parsed.summary.by_kind).toEqual({
			orphan_journal: 0,
			checksum_mismatch: 0,
			schema_violation: 0,
			stale_active_state: 0,
		});
	});

	it("detects orphan transaction journals and prints the hard prune fix command", async () => {
		const root = await tempDir();
		const journalPath = path.join(root, ".jwc", "state", "transactions", "orphan.json");
		await writeJson(journalPath, { version: 1, mutation_id: "orphan", status: "committed", paths: [] });
		await writeJson(path.join(root, ".jwc", "state", "audit.jsonl"), { seeded: true });

		const text = await runDoctorUnchanged(root, ["doctor"]);
		expect(text.status).toBe(1);
		expect(text.stdout).toContain("kind=orphan_journal");
		expect(text.stdout).toContain("fix=jwc state prune --hard");

		const json = await runDoctorUnchanged(root, ["doctor", "--json"]);
		const parsed = JSON.parse(json.stdout ?? "{}");
		expect(parsed.ok).toBe(false);
		expect(parsed.problems).toEqual([
			expect.objectContaining({ type: "orphan_journal", path: journalPath, fixCommand: "jwc state prune --hard" }),
		]);
	});

	it("detects checksum mismatches and prints the migrate fix command", async () => {
		const root = await tempDir();
		const statePath = await writeStampedState(root, "plan", {
			active: true,
			current_phase: "planner",
		});
		const state = JSON.parse(await fs.readFile(statePath, "utf-8"));
		state.current_phase = "critic";
		await writeJson(statePath, state);
		await writeJson(path.join(root, ".jwc", "state", "audit.jsonl"), { seeded: true });

		const result = await runDoctorUnchanged(root, ["doctor", "--skill", "plan", "--json"]);
		expect(result.status).toBe(1);
		const parsed = JSON.parse(result.stdout ?? "{}");
		expect(parsed.summary.skills_scanned).toBe(1);
		expect(parsed.problems).toEqual([
			expect.objectContaining({
				type: "checksum_mismatch",
				skill: "plan",
				path: statePath,
				fixCommand: "jwc state plan migrate",
			}),
		]);
	});

	it("detects schema violations and prints the migrate fix command", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "goal-state.json");
		await writeJson(statePath, { skill: "goal", version: "one", active: "yes", current_phase: 7 });
		await writeJson(path.join(root, ".jwc", "state", "audit.jsonl"), { seeded: true });

		const result = await runDoctorUnchanged(root, ["doctor", "--json"]);
		expect(result.status).toBe(1);
		const parsed = JSON.parse(result.stdout ?? "{}");
		expect(parsed.problems).toEqual([
			expect.objectContaining({
				type: "schema_violation",
				skill: "goal",
				path: statePath,
				fixCommand: "jwc state goal migrate",
			}),
		]);
	});

	it("detects stale active-state from raw snapshot and per-skill active entries", async () => {
		const root = await tempDir();
		const stateRoot = path.join(root, ".jwc", "state");
		const activeEntryPath = path.join(stateRoot, "active", "team.json");
		await writeJson(activeEntryPath, { skill: "team", active: true, phase: "running" });
		await writeJson(path.join(stateRoot, "skill-active-state.json"), {
			version: 1,
			active: true,
			skill: "plan",
			active_skills: [{ skill: "plan", active: true, phase: "planner" }],
		});
		await writeJson(path.join(stateRoot, "audit.jsonl"), { seeded: true });

		const text = await runDoctorUnchanged(root, ["doctor"]);
		expect(text.status).toBe(1);
		expect(text.stdout).toContain("kind=stale_active_state");
		expect(text.stdout).toContain("fix=jwc state team clear");
		expect(text.stdout).toContain("fix=jwc state plan clear");

		const json = await runDoctorUnchanged(root, ["doctor", "--json"]);
		const parsed = JSON.parse(json.stdout ?? "{}");
		expect(parsed.problems).toEqual([
			expect.objectContaining({
				type: "stale_active_state",
				skill: "plan",
				path: path.join(stateRoot, "skill-active-state.json"),
				fixCommand: "jwc state plan clear",
			}),
			expect.objectContaining({
				type: "stale_active_state",
				skill: "team",
				path: activeEntryPath,
				fixCommand: "jwc state team clear",
			}),
		]);
	});
});
