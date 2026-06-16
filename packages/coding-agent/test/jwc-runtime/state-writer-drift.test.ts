import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { recordSkillActivation } from "@jawcode-dev/coding-agent/hooks/skill-state";
import { runNativeJawInterviewCommand } from "@jawcode-dev/coding-agent/jwc-runtime/jaw-interview-runtime";
import { runNativePlanWriterCommand } from "@jawcode-dev/coding-agent/jwc-runtime/plan-writer";
import { migrateAndPersistLegacyState } from "@jawcode-dev/coding-agent/jwc-runtime/state-migrations";
import { runNativeStateCommand } from "@jawcode-dev/coding-agent/jwc-runtime/state-runtime";
import { RequiredOnWriteEnvelopeSchema } from "@jawcode-dev/coding-agent/jwc-runtime/state-schema";
import { writeWorkflowEnvelopeAtomic } from "@jawcode-dev/coding-agent/jwc-runtime/state-writer";
import {
	type JwcTeamSnapshot,
	persistJwcTeamModeStateSummary,
} from "@jawcode-dev/coding-agent/jwc-runtime/team-runtime";
import { WORKFLOW_STATE_VERSION } from "@jawcode-dev/coding-agent/skill-state/workflow-state-contract";

const tempRoots: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-state-writer-drift-"));
	tempRoots.push(dir);
	return dir;
}

afterAll(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

async function readJson(filePath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
}

async function expectPersistedEnvelope(filePath: string): Promise<void> {
	const value = await readJson(filePath);
	const parsed = RequiredOnWriteEnvelopeSchema.safeParse(value);
	expect(parsed.success).toBe(true);
	expect(value.version).toBe(WORKFLOW_STATE_VERSION);
}

describe("workflow state writer drift guard", () => {
	it("persists required-on-write envelopes for state write, clear, and handoff", async () => {
		const root = await tempDir();
		const sessionId = "drift-session";
		const deepPath = path.join(root, ".jwc", "state", "sessions", sessionId, "jaw-interview-state.json");
		const ralplanPath = path.join(root, ".jwc", "state", "sessions", sessionId, "plan-state.json");

		const write = await runNativeStateCommand(
			[
				"write",
				"--mode",
				"jaw-interview",
				"--session-id",
				sessionId,
				"--input",
				JSON.stringify({ current_phase: "interviewing" }),
				"--json",
			],
			root,
		);
		expect(write.status).toBe(0);
		await expectPersistedEnvelope(deepPath);

		const clear = await runNativeStateCommand(["clear", "--mode", "jaw-interview", "--session-id", sessionId], root);
		expect(clear.status).toBe(0);
		await expectPersistedEnvelope(deepPath);

		const seed = await runNativeStateCommand(
			[
				"write",
				"--mode",
				"jaw-interview",
				"--session-id",
				sessionId,
				"--input",
				JSON.stringify({ current_phase: "handoff" }),
				"--force",
			],
			root,
		);
		expect(seed.status).toBe(0);
		const handoff = await runNativeStateCommand(
			["handoff", "--mode", "jaw-interview", "--session-id", sessionId, "--to", "ralplan"],
			root,
		);
		expect(handoff.status).toBe(0);
		await expectPersistedEnvelope(deepPath);
		await expectPersistedEnvelope(ralplanPath);
	});

	it("persists required-on-write envelope for ralplan seed", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--json", "scope this change"], root);
		expect(result.status).toBe(0);
		await expectPersistedEnvelope(path.join(root, ".jwc", "state", "plan-state.json"));
	});

	it("persists required-on-write envelope for hook initialized mode-state", async () => {
		const root = await tempDir();
		const state = await recordSkillActivation({
			cwd: root,
			text: "$jaw-interview clarify this",
			sessionId: "hook-session",
			threadId: "hook-thread",
			nowIso: "2026-01-01T00:00:00.000Z",
		});
		expect(state?.initialized_state_path).toBe(
			path.join(root, ".jwc", "state", "sessions", "hook-session", "jaw-interview-state.json"),
		);
		await expectPersistedEnvelope(state?.initialized_state_path ?? "");
	});

	it("persists required-on-write v2 envelope for ralplan persist-run-id from legacy v1 state", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "plan-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			`${JSON.stringify({ version: 1, skill: "plan", active: true, current_phase: "planning", updated_at: "2026-01-01T00:00:00.000Z" })}\n`,
			"utf-8",
		);

		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "# Plan", "--run-id", "legacy-run"],
			root,
		);
		expect(result.status).toBe(0);
		await expectPersistedEnvelope(statePath);
	});

	it("normalizes ralplan persist-run-id when legacy v1 already has the selected run_id", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "plan-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			`${JSON.stringify({ version: 1, skill: "plan", active: true, current_phase: "planning", updated_at: "2026-01-01T00:00:00.000Z", run_id: "legacy-run" })}\n`,
			"utf-8",
		);

		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "# Plan", "--run-id", "legacy-run"],
			root,
		);
		expect(result.status).toBe(0);
		await expectPersistedEnvelope(statePath);
		const persisted = await readJson(statePath);
		expect(persisted.run_id).toBe("legacy-run");
	});

	it("persists required-on-write v2 envelope for ralplan planner-state from legacy v1 state", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "plan-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			`${JSON.stringify({ version: 1, skill: "plan", active: true, current_phase: "planning", updated_at: "2026-01-01T00:00:00.000Z", run_id: "legacy-planner" })}\n`,
			"utf-8",
		);

		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan",
				"--planner-id",
				"0-Planner",
				"--planner-resumable",
				"true",
			],
			root,
		);
		expect(result.status).toBe(0);
		await expectPersistedEnvelope(statePath);
	});

	it("persists required-on-write envelope for jaw-interview seed and spec handoff state", async () => {
		const root = await tempDir();
		const seed = await runNativeJawInterviewCommand(["--json", "clarify this"], root);
		expect(seed.status).toBe(0);
		const statePath = path.join(root, ".jwc", "state", "jaw-interview-state.json");
		await expectPersistedEnvelope(statePath);

		const write = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "drift", "--spec", "# Spec", "--json"],
			root,
		);
		expect(write.status).toBe(0);
		await expectPersistedEnvelope(statePath);
	});

	it("persists required-on-write envelope for team summary without starting tmux", async () => {
		const root = await tempDir();
		const snapshot: JwcTeamSnapshot = {
			team_name: "drift-team",
			display_name: "Drift Team",
			phase: "running",
			state_dir: path.join(root, ".jwc", "state", "team", "drift-team"),
			tmux_session: "drift-team",
			tmux_session_name: "drift-team",
			tmux_target: "drift-team:",
			task_total: 0,
			task_counts: { pending: 0, blocked: 0, in_progress: 0, completed: 0, failed: 0 },
			workers: [],
			worker_lifecycle_by_id: {},
			notification_summary: {
				total: 0,
				replay_eligible: 0,
				by_state: { pending: 0, sent: 0, queued: 0, deferred: 0, failed: 0, delivered: 0, acknowledged: 0 },
			},
			updated_at: new Date().toISOString(),
		};
		await persistJwcTeamModeStateSummary(snapshot, root);
		await expectPersistedEnvelope(path.join(root, ".jwc", "state", "team-state.json"));
	});

	it("persists required-on-write envelope for explicit legacy migration", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "plan-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			`${JSON.stringify({ version: 1, skill: "plan", active: true, current_phase: "planning", updated_at: "2026-01-01T00:00:00.000Z" })}\n`,
			"utf-8",
		);

		const result = await migrateAndPersistLegacyState({ cwd: root, skill: "plan", statePath });
		expect(result.migrated).toBe(true);
		await expectPersistedEnvelope(statePath);
	});

	it("rejects incomplete workflow envelopes before atomic write", async () => {
		const root = await tempDir();
		await expect(
			writeWorkflowEnvelopeAtomic(
				path.join(root, ".jwc", "state", "plan-state.json"),
				{ skill: "plan", active: true, current_phase: "planner" },
				{ cwd: root, receipt: { cwd: root, skill: "plan", owner: "jwc-runtime", command: "test incomplete" } },
			),
		).rejects.toThrow(/invalid workflow state envelope/);
	});
});
