import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runNativeStateCommand } from "../../src/jwc-runtime/state-runtime";
import { WORKFLOW_STATE_VERSION } from "../../src/skill-state/workflow-state-contract";

async function withTempCwd(fn: (cwd: string) => Promise<void>): Promise<void> {
	const dir = await fs.mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "gjc-state-handoff-"));
	// Most tests assume root-scoped state; clear GJC_SESSION_ID so the
	// runtime's env-default fallback does not leak the host shell's session
	// id into temp-dir scenarios. Individual tests that target the env
	// default restore GJC_SESSION_ID inside their own setup.
	const priorSessionId = process.env.GJC_SESSION_ID;
	delete process.env.GJC_SESSION_ID;
	try {
		await fn(dir);
	} finally {
		if (priorSessionId !== undefined) process.env.GJC_SESSION_ID = priorSessionId;
		await fs.rm(dir, { recursive: true, force: true });
	}
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
	try {
		const raw = await fs.readFile(filePath, "utf-8");
		return JSON.parse(raw) as Record<string, unknown>;
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === "ENOENT") return null;
		throw err;
	}
}

describe("jwc state handoff", () => {
	it("transitions caller -> callee atomically across mode-state and active-state", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
				updated_at: "2026-01-01T00:00:00.000Z",
			});

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(result.status).toBe(0);
			const payload = JSON.parse(result.stdout ?? "{}") as Record<string, unknown>;
			expect(payload.from).toBe("jaw-interview");
			expect(payload.to).toBe("plan");
			expect(typeof payload.handoff_at).toBe("string");
			expect(payload.ok).toBe(true);
			expect(payload.state).toBeUndefined();
			const handoffAt = payload.handoff_at as string;

			const caller = await readJson(callerPath);
			expect(caller?.active).toBe(false);
			expect(caller?.current_phase).toBe("handoff");
			expect(caller?.handoff_to).toBe("plan");
			expect(caller?.handoff_at).toBe(handoffAt);
			expect(caller?.version).toBe(WORKFLOW_STATE_VERSION);

			const callee = await readJson(path.join(cwd, ".jwc/state/plan-state.json"));
			expect(callee?.active).toBe(true);
			expect(callee?.handoff_from).toBe("jaw-interview");
			expect(callee?.handoff_at).toBe(handoffAt);
			expect(callee?.version).toBe(WORKFLOW_STATE_VERSION);

			const activeState = await readJson(path.join(cwd, ".jwc/state/skill-active-state.json"));
			const activeSkills = (activeState?.active_skills as Array<Record<string, unknown>>) ?? [];
			// Handoff demotes the caller to active:false with handoff_to lineage so
			// downstream readers can audit the transition; HUD readers filter on
			// active!==false so the demoted entry stays out of the visible bar.
			const ralplan = activeSkills.find(e => e.skill === "plan");
			const di = activeSkills.find(e => e.skill === "jaw-interview");
			expect(ralplan?.active).toBe(true);
			expect(ralplan?.handoff_from).toBe("jaw-interview");
			expect(typeof ralplan?.handoff_at).toBe("string");
			expect(di?.active).toBe(false);
			expect(di?.handoff_to).toBe("plan");
			expect(di?.handoff_at).toBe(handoffAt);
		});
	});

	it("normalizes legacy caller and callee envelopes to v2 during handoff", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			const calleePath = path.join(cwd, ".jwc/state/plan-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			await writeJson(calleePath, {
				skill: "plan",
				active: false,
				current_phase: "planner",
			});

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);

			expect(result.status).toBe(0);
			const caller = await readJson(callerPath);
			const callee = await readJson(calleePath);
			expect(caller?.version).toBe(2);
			expect(callee?.version).toBe(2);
		});
	});

	it("bootstraps an absent callee mode-state during handoff", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			const calleePath = path.join(cwd, ".jwc/state/plan-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);

			expect(result.status).toBe(0);
			const callee = await readJson(calleePath);
			expect(callee?.active).toBe(true);
			expect(callee?.current_phase).toBe("planner");
			expect(callee?.handoff_from).toBe("jaw-interview");
		});
	});

	it("rejects corrupt callee mode-state without --force and overwrites with --force", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			const calleePath = path.join(cwd, ".jwc/state/plan-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			await fs.mkdir(path.dirname(calleePath), { recursive: true });
			await fs.writeFile(calleePath, "{broken json", "utf-8");

			const rejected = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(rejected.status).toBe(2);
			expect(rejected.stderr).toContain("existing state for plan is corrupt or tampered");
			expect(await fs.readFile(calleePath, "utf-8")).toBe("{broken json");

			const forced = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json", "--force"],
				cwd,
			);
			expect(forced.status).toBe(0);
			const callee = await readJson(calleePath);
			expect(callee?.active).toBe(true);
			expect(callee?.handoff_from).toBe("jaw-interview");
		});
	});

	it("rejects corrupt caller mode-state without --force and proceeds with --force", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			await fs.mkdir(path.dirname(callerPath), { recursive: true });
			await fs.writeFile(callerPath, "{broken json", "utf-8");

			const rejected = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(rejected.status).toBe(2);
			expect(rejected.stderr).toContain("existing state for jaw-interview is corrupt or tampered");
			expect(await fs.readFile(callerPath, "utf-8")).toBe("{broken json");

			const forced = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json", "--force"],
				cwd,
			);
			expect(forced.status).toBe(0);
			const caller = await readJson(callerPath);
			expect(caller?.active).toBe(false);
			const callee = await readJson(path.join(cwd, ".jwc/state/plan-state.json"));
			expect(callee?.handoff_from).toBe("jaw-interview");
		});
	});

	it("writes callee mode-state before caller mode-state (HUD-coherent ordering)", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			const calleePath = path.join(cwd, ".jwc/state/plan-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});

			// Spy on writes by chmod-ing the dir to readonly partway through is too invasive.
			// Instead, verify ordering by stat mtime: write callee first, then caller. The
			// callee file MUST exist when the caller is rewritten, and its mtime must be
			// less-than-or-equal to the caller's mtime.
			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(result.status).toBe(0);

			const calleeStat = await fs.stat(calleePath);
			const callerStat = await fs.stat(callerPath);
			expect(calleeStat.mtimeMs).toBeLessThanOrEqual(callerStat.mtimeMs);
		});
	});

	it("rejects missing --to", async () => {
		await withTempCwd(async cwd => {
			await writeJson(path.join(cwd, ".jwc/state/jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			const result = await runNativeStateCommand(["handoff", "--mode", "jaw-interview", "--json"], cwd);
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("--to");
		});
	});

	it("rejects unknown callee skill", async () => {
		await withTempCwd(async cwd => {
			await writeJson(path.join(cwd, ".jwc/state/jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "made-up-skill", "--json"],
				cwd,
			);
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("unknown --mode");
		});
	});

	it("rejects --to equal to caller", async () => {
		await withTempCwd(async cwd => {
			await writeJson(path.join(cwd, ".jwc/state/plan-state.json"), {
				skill: "plan",
				version: 1,
				active: true,
				current_phase: "planning",
			});
			const result = await runNativeStateCommand(["handoff", "--mode", "plan", "--to", "plan", "--json"], cwd);
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("must differ from caller");
		});
	});

	it("rejects handoff when caller mode-state file does not exist", async () => {
		await withTempCwd(async cwd => {
			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(result.status).toBe(2);
			expect(result.stderr).toContain("caller is not active");
		});
	});

	it("supports backward chain goal -> ralplan", async () => {
		await withTempCwd(async cwd => {
			await writeJson(path.join(cwd, ".jwc/state/goal-state.json"), {
				skill: "goal",
				version: 1,
				active: true,
				current_phase: "goal-planning",
			});
			const result = await runNativeStateCommand(["handoff", "--mode", "goal", "--to", "plan", "--json"], cwd);
			expect(result.status).toBe(0);
			const goal = await readJson(path.join(cwd, ".jwc/state/goal-state.json"));
			expect(goal?.active).toBe(false);
			expect(goal?.current_phase).toBe("handoff");
			expect(goal?.handoff_to).toBe("plan");
			const ralplan = await readJson(path.join(cwd, ".jwc/state/plan-state.json"));
			expect(ralplan?.active).toBe(true);
			expect(ralplan?.handoff_from).toBe("goal");
		});
	});
	it("handoffs session-scoped state when --session-id is forwarded", async () => {
		await withTempCwd(async cwd => {
			const sessionId = "session-G007";
			const encodedSession = encodeURIComponent(sessionId).replaceAll(".", "%2E");
			const sessionDir = path.join(cwd, ".jwc/state/sessions", encodedSession);
			await writeJson(path.join(sessionDir, "jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
				session_id: sessionId,
			});

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--session-id", sessionId, "--json"],
				cwd,
			);
			expect(result.status).toBe(0);

			// Session-scoped caller mode-state demoted; root mode-state untouched.
			const caller = JSON.parse(
				await fs.readFile(path.join(sessionDir, "jaw-interview-state.json"), "utf-8"),
			) as Record<string, unknown>;
			expect(caller.active).toBe(false);
			expect(caller.current_phase).toBe("handoff");

			const callee = JSON.parse(await fs.readFile(path.join(sessionDir, "plan-state.json"), "utf-8")) as Record<
				string,
				unknown
			>;
			expect(callee.active).toBe(true);
			expect(callee.handoff_from).toBe("jaw-interview");

			// Root state files were NOT mutated for this session-scoped handoff.
			await expect(fs.access(path.join(cwd, ".jwc/state/jaw-interview-state.json"))).rejects.toThrow();

			// Session-scoped active-state has callee active and carries lineage.
			const sessionActive = JSON.parse(
				await fs.readFile(path.join(sessionDir, "skill-active-state.json"), "utf-8"),
			) as { active_skills?: Array<Record<string, unknown>> };
			const ralplanEntry = sessionActive.active_skills?.find(e => e.skill === "plan");
			expect(ralplanEntry?.handoff_from).toBe("jaw-interview");
			expect(typeof ralplanEntry?.handoff_at).toBe("string");
		});
	});
	it("propagates strict sync failure when active-state write fails after mode-state writes succeed", async () => {
		await withTempCwd(async cwd => {
			const callerPath = path.join(cwd, ".jwc/state/jaw-interview-state.json");
			await writeJson(callerPath, {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			// Pre-create the root active-state path AS A DIRECTORY so writing it
			// fails *after* both mode-state writes have already succeeded. This
			// exercises the strict active-state path, not the pre-sync mode-state
			// path, and proves the CLI returns non-zero status when the atomic
			// transaction cannot complete.
			await fs.mkdir(path.join(cwd, ".jwc/state/skill-active-state.json"), { recursive: true });

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toBeDefined();
			// Mode-state writes happen before the active-state sync, so the caller
			// mode-state is already demoted. The recoverable contract is: mode-state
			// reflects intent, and a subsequent retry (or explicit `gjc state
			// <caller> handoff --to <callee>`) can re-apply the active-state sync
			// without corrupting either mode-state file.
			const caller = JSON.parse(await fs.readFile(callerPath, "utf-8")) as Record<string, unknown>;
			expect(caller.current_phase).toBe("handoff");
			expect(caller.active).toBe(false);
			const callee = JSON.parse(await fs.readFile(path.join(cwd, ".jwc/state/plan-state.json"), "utf-8")) as Record<
				string,
				unknown
			>;
			expect(callee.active).toBe(true);
			expect(callee.handoff_from).toBe("jaw-interview");
		});
	});

	it("treats corrupt active-state JSON as a strict failure", async () => {
		await withTempCwd(async cwd => {
			await writeJson(path.join(cwd, ".jwc/state/jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});
			await fs.mkdir(path.join(cwd, ".jwc/state"), { recursive: true });
			await fs.writeFile(path.join(cwd, ".jwc/state/skill-active-state.json"), "{ not valid json");

			const result = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toBeDefined();
		});
	});

	it("preserves earlier inactive lineage across successive handoffs (D->R->U keeps di's handoff_to in active_skills)", async () => {
		await withTempCwd(async cwd => {
			const stateDir = path.join(cwd, ".jwc/state");
			await writeJson(path.join(stateDir, "jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
			});

			// Step 1: D -> R.
			const step1 = await runNativeStateCommand(
				["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
				cwd,
			);
			expect(step1.status).toBe(0);

			// Bridge state for step 2: ralplan must look ready-to-hand-off.
			await fs.writeFile(
				path.join(stateDir, "plan-state.json"),
				JSON.stringify(
					{
						...(JSON.parse(await fs.readFile(path.join(stateDir, "plan-state.json"), "utf-8")) as Record<
							string,
							unknown
						>),
						current_phase: "handoff",
					},
					null,
					2,
				),
			);

			// Step 2: R -> U.
			const step2 = await runNativeStateCommand(
				["handoff", "--mode", "plan", "--to", "goal", "--json", "--force"],
				cwd,
			);
			expect(step2.status).toBe(0);

			// Assert all three lineage records are present in active_skills.
			const activeState = (await readJson(path.join(stateDir, "skill-active-state.json"))) as {
				active_skills?: Array<Record<string, unknown>>;
			};
			const skills = activeState?.active_skills ?? [];
			const di = skills.find(e => e.skill === "jaw-interview");
			const rp = skills.find(e => e.skill === "plan");
			const ug = skills.find(e => e.skill === "goal");
			expect(di?.active).toBe(false);
			expect(di?.handoff_to).toBe("plan");
			expect(rp?.active).toBe(false);
			expect(rp?.handoff_to).toBe("goal");
			expect(rp?.handoff_from).toBe("jaw-interview");
			expect(ug?.active).toBe(true);
			expect(ug?.handoff_from).toBe("plan");
		});
	});
	it("defaults session-id from GJC_SESSION_ID env var when no --session-id flag is passed", async () => {
		await withTempCwd(async cwd => {
			const sessionId = "session-env-default";
			const encodedSession = encodeURIComponent(sessionId).replaceAll(".", "%2E");
			const sessionDir = path.join(cwd, ".jwc/state/sessions", encodedSession);
			await writeJson(path.join(sessionDir, "jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
				session_id: sessionId,
			});

			const prior = process.env.GJC_SESSION_ID;
			process.env.GJC_SESSION_ID = sessionId;
			try {
				// No --session-id flag; runtime must pick the env var.
				const result = await runNativeStateCommand(
					["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
					cwd,
				);
				expect(result.status).toBe(0);
				// Session-scoped mode-state demoted (proves env default was applied).
				const caller = JSON.parse(
					await fs.readFile(path.join(sessionDir, "jaw-interview-state.json"), "utf-8"),
				) as Record<string, unknown>;
				expect(caller.active).toBe(false);
				expect(caller.current_phase).toBe("handoff");
			} finally {
				if (prior === undefined) delete process.env.GJC_SESSION_ID;
				else process.env.GJC_SESSION_ID = prior;
			}
		});
	});

	it("supports the documented agent flow: write current_phase=handoff via env-defaulted session, then handoff CLI from skill tool", async () => {
		await withTempCwd(async cwd => {
			const sessionId = "session-docs-flow";
			const encodedSession = encodeURIComponent(sessionId).replaceAll(".", "%2E");
			const sessionDir = path.join(cwd, ".jwc/state/sessions", encodedSession);
			// Bootstrap: an active jaw-interview session-scoped state exists.
			await writeJson(path.join(sessionDir, "jaw-interview-state.json"), {
				skill: "jaw-interview",
				version: 1,
				active: true,
				current_phase: "interviewing",
				session_id: sessionId,
			});

			const prior = process.env.GJC_SESSION_ID;
			process.env.GJC_SESSION_ID = sessionId;
			try {
				// Step 1 (agent shell): documented prep write — no --session-id flag, env picks it up.
				const writeResult = await runNativeStateCommand(
					["write", "--mode", "jaw-interview", "--input", JSON.stringify({ current_phase: "handoff" }), "--json"],
					cwd,
				);
				expect(writeResult.status).toBe(0);
				const di1 = JSON.parse(
					await fs.readFile(path.join(sessionDir, "jaw-interview-state.json"), "utf-8"),
				) as Record<string, unknown>;
				expect(di1.current_phase).toBe("handoff");
				expect(di1.active).toBe(true); // write does NOT demote; only handoff verb does

				// Step 2 (skill tool path): handoff verb without --session-id; env defaults it.
				const handoffResult = await runNativeStateCommand(
					["handoff", "--mode", "jaw-interview", "--to", "plan", "--json"],
					cwd,
				);
				expect(handoffResult.status).toBe(0);
				const di2 = JSON.parse(
					await fs.readFile(path.join(sessionDir, "jaw-interview-state.json"), "utf-8"),
				) as Record<string, unknown>;
				expect(di2.active).toBe(false);
				expect(di2.handoff_to).toBe("plan");
				const rp = JSON.parse(await fs.readFile(path.join(sessionDir, "plan-state.json"), "utf-8")) as Record<
					string,
					unknown
				>;
				expect(rp.active).toBe(true);
				expect(rp.handoff_from).toBe("jaw-interview");
			} finally {
				if (prior === undefined) delete process.env.GJC_SESSION_ID;
				else process.env.GJC_SESSION_ID = prior;
			}
		});
	});
});
