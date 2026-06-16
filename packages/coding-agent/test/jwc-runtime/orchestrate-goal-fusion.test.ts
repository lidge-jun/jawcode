import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createGoalPlan, startNextGoal } from "../../src/jwc-runtime/goal-engine";
import { runNativeOrchestrateCommand } from "../../src/jwc-runtime/orchestrate-runtime";

function tempCwd(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-fusion-"));
}

function readLedgerEvents(cwd: string): Array<Record<string, unknown>> {
	const ledgerPath = path.join(cwd, ".jwc", "ultragoal", "ledger.jsonl");
	try {
		return readFileSync(ledgerPath, "utf8")
			.split("\n")
			.filter(Boolean)
			.map(line => JSON.parse(line) as Record<string, unknown>);
	} catch {
		return [];
	}
}

describe("orchestrate↔goal fusion (99.08-B)", () => {
	it("appends a goal checkpoint on each stage transition when a goal is active", async () => {
		const cwd = tempCwd();
		await createGoalPlan({ cwd, brief: "fusion e2e objective" });
		await startNextGoal({ cwd });

		const enter = await runNativeOrchestrateCommand(["i"], cwd);
		expect(enter.status).toBe(0);
		const after = readLedgerEvents(cwd).filter(
			event => event.event === "goal_checkpointed" && String(event.evidence ?? "").includes("pabcd"),
		);
		expect(after.length).toBe(1);
		expect(String(after[0].evidence)).toContain("pabcd idle→i");
		expect(String(after[0].evidence)).toContain("pabcd-state.json");
	});

	it("transition still succeeds with no goal plan (no-op fusion)", async () => {
		const cwd = tempCwd();
		const enter = await runNativeOrchestrateCommand(["i"], cwd);
		expect(enter.status).toBe(0);
		expect(readLedgerEvents(cwd).length).toBe(0);
	});
});

describe("session scoping via env (260613 00:23)", () => {
	it("orchestrate defaults --session-id from JWC_SESSION_ID", async () => {
		const cwd = tempCwd();
		const prev = process.env.JWC_SESSION_ID;
		process.env.JWC_SESSION_ID = "env-sess-42";
		try {
			const result = await runNativeOrchestrateCommand(["i"], cwd);
			expect(result.status).toBe(0);
			const scoped = path.join(cwd, ".jwc", "state", "sessions", "env-sess-42", "pabcd-state.json");
			expect(readFileSync(scoped, "utf8")).toContain('"current_phase": "i"');
		} finally {
			if (prev === undefined) delete process.env.JWC_SESSION_ID;
			else process.env.JWC_SESSION_ID = prev;
		}
	});

	it("explicit --session-id still wins over env", async () => {
		const cwd = tempCwd();
		const prev = process.env.JWC_SESSION_ID;
		process.env.JWC_SESSION_ID = "env-sess-43";
		try {
			const result = await runNativeOrchestrateCommand(["i", "--session-id", "flag-sess"], cwd);
			expect(result.status).toBe(0);
			const scoped = path.join(cwd, ".jwc", "state", "sessions", "flag-sess", "pabcd-state.json");
			expect(readFileSync(scoped, "utf8")).toContain('"current_phase": "i"');
		} finally {
			if (prev === undefined) delete process.env.JWC_SESSION_ID;
			else process.env.JWC_SESSION_ID = prev;
		}
	});
});
