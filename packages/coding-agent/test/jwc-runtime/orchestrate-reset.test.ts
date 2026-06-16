import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNativeJawInterviewCommand } from "../../src/jwc-runtime/jaw-interview-runtime";
import { runNativeOrchestrateCommand } from "../../src/jwc-runtime/orchestrate-runtime";
import { pabcdStatePath } from "../../src/jwc-runtime/orchestrate-state";
import { WORKFLOW_STATE_VERSION } from "../../src/skill-state/workflow-state-version";

function tempCwd(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-reset-"));
}

async function withEnvSession<T>(sessionId: string | undefined, fn: () => Promise<T>): Promise<T> {
	const prevJwc = process.env.JWC_SESSION_ID;
	const prevGjc = process.env.GJC_SESSION_ID;
	if (sessionId === undefined) {
		delete process.env.JWC_SESSION_ID;
		delete process.env.GJC_SESSION_ID;
	} else {
		process.env.JWC_SESSION_ID = sessionId;
		delete process.env.GJC_SESSION_ID;
	}
	try {
		return await fn();
	} finally {
		if (prevJwc === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = prevJwc;
		if (prevGjc === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = prevGjc;
	}
}

function encodeSessionSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

function jawInterviewStatePathForTest(cwd: string, sessionId?: string): string {
	const stateDir = path.join(cwd, ".jwc", "state");
	if (sessionId) return path.join(stateDir, "sessions", encodeSessionSegment(sessionId), "jaw-interview-state.json");
	return path.join(stateDir, "jaw-interview-state.json");
}

function activeStatePathForTest(cwd: string, sessionId?: string): string {
	const stateDir = path.join(cwd, ".jwc", "state");
	if (sessionId) return path.join(stateDir, "sessions", encodeSessionSegment(sessionId), "skill-active-state.json");
	return path.join(stateDir, "skill-active-state.json");
}

async function seedJawInterviewStateForTest(cwd: string, phase: string, sessionId?: string): Promise<void> {
	const now = new Date().toISOString();
	const statePath = jawInterviewStatePathForTest(cwd, sessionId);
	await Bun.write(
		statePath,
		`${JSON.stringify({ active: true, current_phase: phase, skill: "jaw-interview", version: WORKFLOW_STATE_VERSION, session_id: sessionId, updated_at: now }, null, 2)}\n`,
	);
	await Bun.write(
		activeStatePathForTest(cwd, sessionId),
		`${JSON.stringify(
			{
				version: 1,
				active: true,
				skill: "jaw-interview",
				phase,
				updated_at: now,
				active_skills: [{ skill: "jaw-interview", phase, active: true, updated_at: now, session_id: sessionId }],
			},
			null,
			2,
		)}\n`,
	);
}

async function readJsonForTest(filePath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await Bun.file(filePath).text()) as Record<string, unknown>;
}

async function expectNoActiveJawInterviewForTest(cwd: string, sessionId?: string): Promise<void> {
	const active = await readJsonForTest(activeStatePathForTest(cwd, sessionId));
	const entries = Array.isArray(active.active_skills) ? active.active_skills : [];
	expect(
		entries.some(
			entry =>
				(entry as { skill?: string; active?: boolean }).skill === "jaw-interview" &&
				(entry as { active?: boolean }).active === true,
		),
	).toBe(false);
}

async function expectActiveJawInterviewForTest(cwd: string, sessionId?: string): Promise<void> {
	const active = await readJsonForTest(activeStatePathForTest(cwd, sessionId));
	const entries = Array.isArray(active.active_skills) ? active.active_skills : [];
	expect(
		entries.some(
			entry =>
				(entry as { skill?: string; active?: boolean }).skill === "jaw-interview" &&
				(entry as { active?: boolean }).active === true,
		),
	).toBe(true);
}

describe("orchestrate reset (99.07 U1)", () => {
	it("is a no-op exit-0 when already idle", async () => {
		await withEnvSession(undefined, async () => {
			const result = await runNativeOrchestrateCommand(["reset"], tempCwd());
			expect(result.status).toBe(0);
			expect(result.stdout).toContain("already idle");
		});
	});

	it("deletes mid-cycle state and allows clean p re-entry (live scenario: stuck in i)", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["i"], cwd);
			// the live incident path: i → complete is rejected with the escape hint
			const blocked = await runNativeOrchestrateCommand(["complete"], cwd);
			expect(blocked.status).not.toBe(0);
			expect(blocked.stderr).toContain("jwc orchestrate reset");

			const reset = await runNativeOrchestrateCommand(["reset"], cwd);
			expect(reset.status).toBe(0);
			expect(reset.stdout).toContain("stage=i");
			expect(existsSync(pabcdStatePath(cwd))).toBe(false);

			const direct = await runNativeOrchestrateCommand(["p"], cwd);
			expect(direct.status).toBe(0);
			const status = await runNativeOrchestrateCommand(["status"], cwd);
			expect(status.stdout).toContain("Stage:        p");
		});
	});

	it("clears context fully unlike complete", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["i", "--spec-ref", ".jwc/specs/x.md"], cwd);
			await runNativeOrchestrateCommand(["reset"], cwd);
			await runNativeOrchestrateCommand(["i"], cwd);
			const status = await runNativeOrchestrateCommand(["status", "--json"], cwd);
			expect(status.stdout).not.toContain("specs/x.md");
		});
	});

	it("scopes deletion to the env session and leaves other sessions intact", async () => {
		const cwd = tempCwd();
		await withEnvSession("sess-A", async () => {
			await runNativeOrchestrateCommand(["i"], cwd);
		});
		await withEnvSession("sess-B", async () => {
			await runNativeOrchestrateCommand(["i"], cwd);
		});
		await withEnvSession("sess-A", async () => {
			await runNativeOrchestrateCommand(["reset"], cwd);
		});
		expect(existsSync(pabcdStatePath(cwd, "sess-A"))).toBe(false);
		expect(existsSync(pabcdStatePath(cwd, "sess-B"))).toBe(true);
	});

	it("explicit --session-id wins over env for reset", async () => {
		const cwd = tempCwd();
		await withEnvSession("env-x", async () => {
			await runNativeOrchestrateCommand(["i", "--session-id", "flag-y"], cwd);
			const reset = await runNativeOrchestrateCommand(["reset", "--session-id", "flag-y"], cwd);
			expect(reset.status).toBe(0);
			expect(existsSync(pabcdStatePath(cwd, "flag-y"))).toBe(false);
		});
	});

	it("--shared also clears the shared path from a scoped session", async () => {
		const cwd = tempCwd();
		await withEnvSession(undefined, async () => {
			await runNativeOrchestrateCommand(["i"], cwd); // shared write
		});
		await withEnvSession("sess-C", async () => {
			await runNativeOrchestrateCommand(["i"], cwd); // scoped write
			await runNativeOrchestrateCommand(["reset", "--shared"], cwd);
		});
		expect(existsSync(pabcdStatePath(cwd))).toBe(false);
		expect(existsSync(pabcdStatePath(cwd, "sess-C"))).toBe(false);
	});

	it("--dry-run reports without deleting", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["i"], cwd);
			const dry = await runNativeOrchestrateCommand(["reset", "--dry-run"], cwd);
			expect(dry.status).toBe(0);
			expect(dry.stdout).toContain("would reset");
			expect(existsSync(pabcdStatePath(cwd))).toBe(true);
		});
	});

	it("retires same-scope jaw-interview state after reset succeeds", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["p"], cwd);
			await seedJawInterviewStateForTest(cwd, "interviewing");

			const reset = await runNativeOrchestrateCommand(["reset"], cwd);
			expect(reset.status).toBe(0);
			expect(existsSync(pabcdStatePath(cwd))).toBe(false);

			const state = await readJsonForTest(jawInterviewStatePathForTest(cwd));
			expect(state.active).toBe(false);
			expect(state.workflow_exit_reason).toBe("orchestrate-reset");
			await expectNoActiveJawInterviewForTest(cwd);
		});
	});

	it("does not retire jaw-interview state during reset dry-run", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["p"], cwd);
			await seedJawInterviewStateForTest(cwd, "interviewing");

			const dry = await runNativeOrchestrateCommand(["reset", "--dry-run"], cwd);
			expect(dry.status).toBe(0);
			expect(existsSync(pabcdStatePath(cwd))).toBe(true);

			const state = await readJsonForTest(jawInterviewStatePathForTest(cwd));
			expect(state.active).toBe(true);
			const active = await readJsonForTest(activeStatePathForTest(cwd));
			expect(
				(Array.isArray(active.active_skills) ? active.active_skills : []).some(
					entry =>
						(entry as { skill?: string; active?: boolean }).skill === "jaw-interview" &&
						(entry as { active?: boolean }).active === true,
				),
			).toBe(true);
		});
	});

	it("retires only session-scoped jaw-interview state during session reset", async () => {
		const cwd = tempCwd();
		await withEnvSession(undefined, async () => {
			await runNativeOrchestrateCommand(["p"], cwd);
			await seedJawInterviewStateForTest(cwd, "handoff");
		});
		await withEnvSession("sess-A", async () => {
			await runNativeOrchestrateCommand(["p"], cwd);
			await seedJawInterviewStateForTest(cwd, "handoff", "sess-A");
			const reset = await runNativeOrchestrateCommand(["reset"], cwd);
			expect(reset.status).toBe(0);
		});

		const sessionState = await readJsonForTest(jawInterviewStatePathForTest(cwd, "sess-A"));
		const rootState = await readJsonForTest(jawInterviewStatePathForTest(cwd));
		expect(sessionState.active).toBe(false);
		expect(sessionState.workflow_exit_reason).toBe("orchestrate-reset");
		expect(rootState.active).toBe(true);
		await expectNoActiveJawInterviewForTest(cwd, "sess-A");
		await expectActiveJawInterviewForTest(cwd);
	});

	it("unknown-stage error now lists reset", async () => {
		await withEnvSession(undefined, async () => {
			const result = await runNativeOrchestrateCommand(["bogus"], tempCwd());
			expect(result.stderr).toContain("reset");
		});
	});
});

describe("interview cancel (99.07 U2)", () => {
	it("closes interview state and reports cleanly without --force workarounds", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeJawInterviewCommand(["test idea for cancel"], cwd);
			const cancel = await runNativeJawInterviewCommand(["cancel"], cwd);
			expect(cancel.status).toBe(0);
			expect(cancel.stdout).toContain("cancelled:");
			expect(cancel.stdout).toContain("jaw-interview closed");
		});
	});

	it("cancel on a fresh cwd is a clean no-op", async () => {
		await withEnvSession(undefined, async () => {
			const cancel = await runNativeJawInterviewCommand(["cancel"], tempCwd());
			expect(cancel.status).toBe(0);
			expect(cancel.stdout).toContain("no interview state");
		});
	});
});

describe("audit follow-ups (99.00.03)", () => {
	it("P0-1: interview seed honors JWC_SESSION_ID like orchestrate", async () => {
		const cwd = tempCwd();
		await withEnvSession("seed-env-1", async () => {
			const result = await runNativeJawInterviewCommand(["env scoped seed idea"], cwd);
			expect(result.status).toBe(0);
		});
		const scoped = path.join(cwd, ".jwc", "state", "sessions", "seed-env-1", "jaw-interview-state.json");
		expect(existsSync(scoped)).toBe(true);
		expect(existsSync(path.join(cwd, ".jwc", "state", "jaw-interview-state.json"))).toBe(false);
	});

	it("P0-1: seed and cancel now agree on the scoped path", async () => {
		const cwd = tempCwd();
		await withEnvSession("seed-env-2", async () => {
			await runNativeJawInterviewCommand(["seed then cancel"], cwd);
			const cancel = await runNativeJawInterviewCommand(["cancel"], cwd);
			expect(cancel.stdout).toContain("cancelled:");
			expect(cancel.stdout).toContain("seed-env-2");
		});
	});

	it("P1-1: orchestrate status prints the 8-field block with next action", async () => {
		await withEnvSession(undefined, async () => {
			const cwd = tempCwd();
			await runNativeOrchestrateCommand(["i"], cwd);
			const status = await runNativeOrchestrateCommand(["status"], cwd);
			expect(status.stdout).toContain("Stage:        i");
			expect(status.stdout).toContain("Scope:        shared");
			expect(status.stdout).toContain("Audit:        pending");
			expect(status.stdout).toContain("Verification: pending");
			expect(status.stdout).toContain("Next:         advance with: jwc orchestrate p");
		});
	});

	it("P1-1: idle status offers both entry points", async () => {
		await withEnvSession(undefined, async () => {
			const status = await runNativeOrchestrateCommand(["status"], tempCwd());
			expect(status.stdout).toContain("orchestrate i (interview)");
			expect(status.stdout).toContain("orchestrate p (plan directly)");
		});
	});
});
