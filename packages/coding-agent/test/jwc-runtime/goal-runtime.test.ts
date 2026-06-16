import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GOAL_PLAN_PENDING_BRIEF, runNativeGoalCommand } from "../../src/jwc-runtime/goal-cli";
import { readGoalLedger, readGoalPlan } from "../../src/jwc-runtime/goal-engine";

const QUALITY_GATE = JSON.stringify({
	architectReview: { verdict: "approved", evidence: "review notes attached" },
	executorQa: { verdict: "pass", evidence: "bun test 12 pass" },
	iteration: { count: 1, evidence: "single-pass implementation" },
});

async function withSessionEnv<T>(
	env: { jwc?: string; gjc?: string; sessionFile?: string },
	fn: () => Promise<T>,
): Promise<T> {
	const previous = {
		JWC_SESSION_ID: process.env.JWC_SESSION_ID,
		GJC_SESSION_ID: process.env.GJC_SESSION_ID,
		JWC_SESSION_FILE: process.env.JWC_SESSION_FILE,
		GJC_SESSION_FILE: process.env.GJC_SESSION_FILE,
	};
	try {
		if (env.jwc === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = env.jwc;
		if (env.gjc === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = env.gjc;
		if (env.sessionFile === undefined) {
			delete process.env.JWC_SESSION_FILE;
			delete process.env.GJC_SESSION_FILE;
		} else {
			process.env.JWC_SESSION_FILE = env.sessionFile;
			process.env.GJC_SESSION_FILE = env.sessionFile;
		}
		return await fn();
	} finally {
		if (previous.JWC_SESSION_ID === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = previous.JWC_SESSION_ID;
		if (previous.GJC_SESSION_ID === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = previous.GJC_SESSION_ID;
		if (previous.JWC_SESSION_FILE === undefined) delete process.env.JWC_SESSION_FILE;
		else process.env.JWC_SESSION_FILE = previous.JWC_SESSION_FILE;
		if (previous.GJC_SESSION_FILE === undefined) delete process.env.GJC_SESSION_FILE;
		else process.env.GJC_SESSION_FILE = previous.GJC_SESSION_FILE;
	}
}

async function writeSessionFileWithGoal(
	cwd: string,
	goal: { objective: string; status: "active" | "paused" | "complete" | "dropped" },
): Promise<string> {
	const now = Date.now();
	const timestamp = new Date(now).toISOString();
	const sessionFile = path.join(cwd, "session-goal.jsonl");
	await Bun.write(
		sessionFile,
		[
			JSON.stringify({ type: "session", version: 3, id: "session-goal", timestamp, cwd }),
			JSON.stringify({
				type: "mode_change",
				id: "mode-goal",
				parentId: null,
				timestamp,
				mode: "goal",
				data: {
					goal: {
						id: "session-goal-id",
						objective: goal.objective,
						status: goal.status,
						tokensUsed: 0,
						timeUsedSeconds: 0,
						createdAt: now,
						updatedAt: now,
					},
				},
			}),
			"",
		].join("\n"),
	);
	return sessionFile;
}

describe("jwc goal adapter (060/061)", () => {
	let cwd: string;
	let previousEnv: {
		JWC_SESSION_ID?: string;
		GJC_SESSION_ID?: string;
		JWC_SESSION_FILE?: string;
		GJC_SESSION_FILE?: string;
	};

	beforeEach(() => {
		cwd = mkdtempSync(path.join(os.tmpdir(), "jwc-goal-"));
		previousEnv = {
			JWC_SESSION_ID: process.env.JWC_SESSION_ID,
			GJC_SESSION_ID: process.env.GJC_SESSION_ID,
			JWC_SESSION_FILE: process.env.JWC_SESSION_FILE,
			GJC_SESSION_FILE: process.env.GJC_SESSION_FILE,
		};
		delete process.env.JWC_SESSION_ID;
		delete process.env.GJC_SESSION_ID;
		delete process.env.JWC_SESSION_FILE;
		delete process.env.GJC_SESSION_FILE;
	});

	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true });
		if (previousEnv.JWC_SESSION_ID === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = previousEnv.JWC_SESSION_ID;
		if (previousEnv.GJC_SESSION_ID === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = previousEnv.GJC_SESSION_ID;
		if (previousEnv.JWC_SESSION_FILE === undefined) delete process.env.JWC_SESSION_FILE;
		else process.env.JWC_SESSION_FILE = previousEnv.JWC_SESSION_FILE;
		if (previousEnv.GJC_SESSION_FILE === undefined) delete process.env.GJC_SESSION_FILE;
		else process.env.GJC_SESSION_FILE = previousEnv.GJC_SESSION_FILE;
	});

	it("set → update(evidence) → checkpoint lands in the ledger", async () => {
		const set = await runNativeGoalCommand(["set", "ship the importer"], cwd);
		expect(set.status).toBe(0);
		const update = await runNativeGoalCommand(
			["update", "parser done", "--evidence", "bun test parser 12 pass"],
			cwd,
		);
		expect(update.status).toBe(0);
		const ledger = await readGoalLedger(cwd);
		const checkpoint = ledger.find(event => event.event === "goal_checkpointed");
		expect(checkpoint).toBeDefined();
		expect(checkpoint?.evidence).toBe("parser done; bun test parser 12 pass");
		const plan = await readGoalPlan(cwd);
		expect(plan?.goals[0]?.status).toBe("active");
	});

	it("rejects update without --evidence before reaching the engine", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		const result = await runNativeGoalCommand(["update", "no proof"], cwd);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--evidence");
		const ledger = await readGoalLedger(cwd);
		expect(ledger.some(event => event.event === "goal_checkpointed")).toBe(false);
	});

	it("joins multiple --evidence paths with '; '", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		await runNativeGoalCommand(["update", "s", "--evidence", "a", "--evidence", "b", "--evidence", "c"], cwd);
		const ledger = await readGoalLedger(cwd);
		const checkpoint = ledger.find(event => event.event === "goal_checkpointed");
		expect(checkpoint?.evidence).toBe("s; a; b; c");
	});

	it("done requires an evidence-bearing checkpoint, then defers to the engine quality gate", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		const premature = await runNativeGoalCommand(["done", "--quality-gate-json", QUALITY_GATE], cwd);
		expect(premature.status).toBe(1);
		expect(premature.stderr).toContain("evidence-bearing checkpoint");

		await runNativeGoalCommand(["update", "work done", "--evidence", "tests green"], cwd);
		// Adapter pre-check passes; the strict engine gate (architect review
		// CLEAR/APPROVE, red-team artifacts) now owns the verdict — done is
		// guard-delegated by design (확정 #3), so a thin gate must be refused
		// by the ENGINE, not by the adapter pre-check.
		const done = await runNativeGoalCommand(["done", "verified", "--quality-gate-json", QUALITY_GATE], cwd);
		expect(done.status).toBe(1);
		expect(done.stderr).toContain("architect review");
		expect(done.stderr).not.toContain("evidence-bearing checkpoint");
		const plan = await readGoalPlan(cwd);
		expect(plan?.goals[0]?.status).toBe("active");
	});

	it("pause --agent gates: 1st tap counts, 2nd tap with --audit pauses + ledger event", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		const first = await runNativeGoalCommand(["pause", "--agent"], cwd);
		expect(first.status).toBe(1);
		expect(first.stderr).toContain("pause NOT executed");

		const second = await runNativeGoalCommand(["pause", "--agent", "--audit", "no viable path remains"], cwd);
		expect(second.status).toBe(0);
		expect(second.stdout).toContain("audited");
		const ledger = await readGoalLedger(cwd);
		const audited = ledger.find(event => event.event === "goal_pause_audited");
		expect(audited?.actor).toBe("agent");
		expect(audited?.evidence).toBe("no viable path remains");
	});

	it("pause --agent --audit without a prior tap is rejected", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		const result = await runNativeGoalCommand(["pause", "--agent", "--audit", "summary"], cwd);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("2-tap gate");
	});

	it("show/drop aliases behave as status/cancel", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		const show = await runNativeGoalCommand(["show"], cwd);
		expect(show.status).toBe(0);
		expect(show.stdout).toContain("Stories: G001:active");

		const drop = await runNativeGoalCommand(["drop", "scope changed"], cwd);
		expect(drop.status).toBe(0);
		const plan = await readGoalPlan(cwd);
		expect(plan?.goals[0]?.status).toBe("superseded");
	});

	it("plan → refine switches the pending sentinel to a direct objective", async () => {
		const planResult = await runNativeGoalCommand(["plan", "improve onboarding"], cwd);
		expect(planResult.status).toBe(0);
		let plan = await readGoalPlan(cwd);
		expect(plan?.brief).toContain(GOAL_PLAN_PENDING_BRIEF);

		const refine = await runNativeGoalCommand(["refine", "ship the onboarding wizard v2"], cwd);
		expect(refine.status).toBe(0);
		plan = await readGoalPlan(cwd);
		expect(plan?.jwcObjective).toBe("ship the onboarding wizard v2");
		expect(plan?.goals[0]?.objective).toBe("ship the onboarding wizard v2");
	});

	it("history renders recent ledger events newest-first with a limit", async () => {
		await runNativeGoalCommand(["set", "objective"], cwd);
		await runNativeGoalCommand(["update", "one", "--evidence", "e1"], cwd);
		await runNativeGoalCommand(["update", "two", "--evidence", "e2"], cwd);
		const history = await runNativeGoalCommand(["history", "2"], cwd);
		expect(history.status).toBe(0);
		const lines = history.stdout?.trim().split("\n") ?? [];
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("goal_checkpointed");
		expect(lines[0]).toContain("two; e2");
	});

	it("rejects unknown verbs with the verb list", async () => {
		const result = await runNativeGoalCommand(["explode"], cwd);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("show→status");
	});

	it("does not headline the shared active ledger as the current session goal", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const result = await withSessionEnv({ jwc: "session-B" }, () => runNativeGoalCommand(["status"], cwd));
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Goal:    none (current session)");
		expect(result.stdout).toContain("Session goal state: unavailable (missing_session_file)");
		expect(result.stdout).toContain("Ledger:  shared .jwc/goal");
		expect(result.stdout).toContain("Shared goal: shared objective");
		const state = (await Bun.file(
			path.join(cwd, ".jwc", "state", "sessions", "session-B", "goal-state.json"),
		).json()) as {
			active?: boolean;
		};
		expect(state.active).toBe(false);
	});

	it("preserves shared status headline with --shared under a session env", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const result = await withSessionEnv({ jwc: "session-B" }, () =>
			runNativeGoalCommand(["status", "--shared"], cwd),
		);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Goal:    shared objective");
		expect(result.stdout).toContain("Mode:    goal ledger (.jwc/goal/)");
	});

	it("requires --shared before a foreign session mutates the shared goal ledger", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const refused = await withSessionEnv({ gjc: "session-B" }, () =>
			runNativeGoalCommand(["update", "foreign checkpoint", "--evidence", "proof"], cwd),
		);
		expect(refused.status).toBe(1);
		expect(refused.stderr).toContain("pass --shared");
		const allowed = await withSessionEnv({ gjc: "session-B" }, () =>
			runNativeGoalCommand(["update", "shared checkpoint", "--evidence", "proof", "--shared"], cwd),
		);
		expect(allowed.status).toBe(0);
	});

	it("also refuses JWC_SESSION_ID-only foreign session mutations without --shared", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const refused = await withSessionEnv({ jwc: "session-B" }, () =>
			runNativeGoalCommand(["update", "foreign checkpoint", "--evidence", "proof"], cwd),
		);
		expect(refused.status).toBe(1);
		expect(refused.stderr).toContain("pass --shared");
	});

	it("allows matched-session update without --shared", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const sessionFile = await writeSessionFileWithGoal(cwd, { objective: "shared objective", status: "active" });
		const update = await withSessionEnv({ jwc: "session-match", sessionFile }, () =>
			runNativeGoalCommand(["update", "matched checkpoint", "--evidence", "proof"], cwd),
		);
		expect(update.status).toBe(0);
	});

	it("refuses foreign-session done without --shared", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const done = await withSessionEnv({ jwc: "session-B" }, () =>
			runNativeGoalCommand(["done", "foreign done", "--quality-gate-json", QUALITY_GATE], cwd),
		);
		expect(done.status).toBe(1);
		expect(done.stderr).toContain("pass --shared");
	});

	it("refuses pause without a matching session goal", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const paused = await withSessionEnv({ gjc: "session-B" }, () => runNativeGoalCommand(["pause"], cwd));
		expect(paused.status).toBe(1);
		expect(paused.stderr).toContain("pass --shared");
	});

	it("honors JWC_SESSION_ID when reconciling goal workflow state", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		await withSessionEnv({ jwc: "session-J" }, () => runNativeGoalCommand(["status"], cwd));
		expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "session-J", "goal-state.json")).exists()).toBe(
			true,
		);
		expect(await Bun.file(path.join(cwd, ".jwc", "state", "goal-state.json")).exists()).toBe(false);
	});

	it("honors GJC_SESSION_ID when reconciling goal workflow state", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		await withSessionEnv({ gjc: "session-G" }, () => runNativeGoalCommand(["status"], cwd));
		expect(await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "session-G", "goal-state.json")).exists()).toBe(
			true,
		);
		expect(await Bun.file(path.join(cwd, ".jwc", "state", "goal-state.json")).exists()).toBe(false);
	});

	it("honors explicit --session-id over env session id for goal status reconciliation", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		await withSessionEnv({ jwc: "env-session" }, () =>
			runNativeGoalCommand(["status", "--session-id", "flag-session"], cwd),
		);
		expect(
			await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "flag-session", "goal-state.json")).exists(),
		).toBe(true);
		expect(
			await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "env-session", "goal-state.json")).exists(),
		).toBe(false);
	});

	it("keeps legacy shared headline and unguarded update when no session env exists", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const update = await withSessionEnv({}, () =>
			runNativeGoalCommand(["update", "legacy checkpoint", "--evidence", "proof"], cwd),
		);
		expect(update.status).toBe(0);
		const status = await withSessionEnv({}, () => runNativeGoalCommand(["status"], cwd));
		expect(status.stdout).toContain("Goal:    shared objective");
		expect(status.stdout).toContain("Mode:    goal ledger (.jwc/goal/)");
	});

	it("treats a session file without an active goal as no current-session goal", async () => {
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const sessionFile = path.join(cwd, "session-without-goal.jsonl");
		await Bun.write(
			sessionFile,
			`${JSON.stringify({ type: "session", version: 3, id: "session-empty", timestamp: new Date().toISOString(), cwd })}\n`,
		);
		const result = await withSessionEnv({ jwc: "session-empty", sessionFile }, () =>
			runNativeGoalCommand(["status"], cwd),
		);
		expect(result.stdout).toContain("Goal:    none (current session)");
		expect(result.stdout).toContain("Shared goal: shared objective");
	});

	it("allows explicit goal creation verbs to update the shared ledger while stamping session activation", async () => {
		const result = await withSessionEnv({ jwc: "session-create" }, () =>
			runNativeGoalCommand(["set", "session-created objective"], cwd),
		);
		expect(result.status).toBe(0);
		const shared = await runNativeGoalCommand(["status", "--shared"], cwd);
		expect(shared.stdout).toContain("Goal:    session-created objective");
	});

	it("passes --session-id through the jwc goal command wrapper", async () => {
		const cliPath = path.resolve(import.meta.dir, "..", "..", "src", "cli.ts");
		await runNativeGoalCommand(["set", "shared objective"], cwd);
		const result = Bun.spawnSync(["bun", cliPath, "goal", "status", "--session-id", "flag-session"], {
			cwd,
			env: { ...process.env, JWC_SESSION_ID: "env-session", GJC_SESSION_ID: "" },
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(result.exitCode, result.stderr.toString()).toBe(0);
		expect(
			await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "flag-session", "goal-state.json")).exists(),
		).toBe(true);
		expect(
			await Bun.file(path.join(cwd, ".jwc", "state", "sessions", "env-session", "goal-state.json")).exists(),
		).toBe(false);
	});
});

describe("goal status readability (99.00.03 P1-2)", () => {
	it("leads with the user objective and the 5-field block", async () => {
		const cwd = mkdtempSync(path.join(os.tmpdir(), "jwc-goal-status-"));
		await runNativeGoalCommand(["set", "사용자 목표 헤드라인"], cwd);
		const status = await runNativeGoalCommand(["status"], cwd);
		expect(status.stdout?.startsWith("Goal:    사용자 목표 헤드라인")).toBe(true);
		expect(status.stdout).toContain("Status:  active");
		expect(status.stdout).toContain("Mode:    goal ledger (.jwc/goal/)");
		expect(status.stdout).toContain("ID:      G001");
		expect(status.stdout).not.toContain("Complete the durable goal plan");
	});
});
