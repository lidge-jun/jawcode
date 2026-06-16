import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { runNativeJawInterviewCommand } from "../../src/jwc-runtime/jaw-interview-runtime";
import { runNativeOrchestrateCommand } from "../../src/jwc-runtime/orchestrate-runtime";
import {
	canTransitionPabcd,
	PABCD_STAGES,
	type PabcdStage,
	pabcdStatePath,
	parseCriticVerdict,
	parseWorkerVerdict,
	readPabcdState,
	readPabcdStateWithFallback,
	VALID_PABCD_TRANSITIONS,
	writeNativeWorkflowEnvelopeAtomic,
} from "../../src/jwc-runtime/orchestrate-state";
import { WORKFLOW_STATE_VERSION } from "../../src/skill-state/workflow-state-version";

async function withPabcdSessionEnv<T>(env: { jwc?: string; gjc?: string }, fn: () => Promise<T>): Promise<T> {
	const previous = {
		JWC_SESSION_ID: process.env.JWC_SESSION_ID,
		GJC_SESSION_ID: process.env.GJC_SESSION_ID,
	};
	try {
		if (env.jwc === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = env.jwc;
		if (env.gjc === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = env.gjc;
		return await fn();
	} finally {
		if (previous.JWC_SESSION_ID === undefined) delete process.env.JWC_SESSION_ID;
		else process.env.JWC_SESSION_ID = previous.JWC_SESSION_ID;
		if (previous.GJC_SESSION_ID === undefined) delete process.env.GJC_SESSION_ID;
		else process.env.GJC_SESSION_ID = previous.GJC_SESSION_ID;
	}
}
describe("pabcd transition table (cli-jaw canTransition port)", () => {
	it("allows only i or p as entry stages when no state exists", () => {
		expect(canTransitionPabcd(null, "i").ok).toBe(true);
		expect(canTransitionPabcd(null, "p").ok).toBe(true);
		for (const stage of ["a", "b", "c", "d", "complete"] as const) {
			expect(canTransitionPabcd(null, stage).ok).toBe(false);
		}
	});

	it("enforces the full forward-only table with i-return", () => {
		for (const from of PABCD_STAGES) {
			for (const to of PABCD_STAGES) {
				const expected = VALID_PABCD_TRANSITIONS[from].includes(to);
				const result = canTransitionPabcd(from, to, {
					p_review_passed: true,
					audit_status: "pass",
					verification_status: "done",
				});
				expect(result.ok, `${from} → ${to}`).toBe(expected);
			}
		}
	});

	it("returning to i is always allowed from any active stage", () => {
		for (const from of PABCD_STAGES.filter(stage => stage !== "i")) {
			expect(canTransitionPabcd(from as PabcdStage, "i").ok).toBe(true);
		}
	});

	it("gates p→a on Critic OKAY, waiver synthesis, or explicit approval", () => {
		expect(canTransitionPabcd("p", "a", { p_review_passed: false }).ok).toBe(false);
		expect(canTransitionPabcd("p", "a", { p_review_passed: true }).ok).toBe(true);
		expect(
			canTransitionPabcd("p", "a", {
				p_review_passed: false,
				p_review_override: {
					stage: "p",
					reason: "wrong blocker",
					synthesis_ref: "devlog/_plan/example/synthesis.md",
				},
			}).ok,
		).toBe(true);
		expect(canTransitionPabcd("p", "a", { user_approved: true }).ok).toBe(true);
	});

	it("gates a→b on audit verdict pass (strict equality)", () => {
		expect(canTransitionPabcd("a", "b", { audit_status: "pending" }).ok).toBe(false);
		expect(canTransitionPabcd("a", "b", { audit_status: "fail" }).ok).toBe(false);
		expect(canTransitionPabcd("a", "b", {}).ok).toBe(false);
		expect(canTransitionPabcd("a", "b", { audit_status: "pass" }).ok).toBe(true);
		// Explicit user approval overrides the gate.
		expect(canTransitionPabcd("a", "b", { audit_status: "fail", user_approved: true }).ok).toBe(true);
	});

	it("gates b→c on verification verdict done (strict equality)", () => {
		expect(canTransitionPabcd("b", "c", { verification_status: "pending" }).ok).toBe(false);
		expect(canTransitionPabcd("b", "c", { verification_status: "needs_fix" }).ok).toBe(false);
		expect(canTransitionPabcd("b", "c", { verification_status: "done" }).ok).toBe(true);
		expect(canTransitionPabcd("b", "c", { user_approved: true }).ok).toBe(true);
	});

	it("supports 3-way reject routing from c", () => {
		for (const to of ["d", "b", "p", "i"] as const) {
			expect(canTransitionPabcd("c", to).ok).toBe(true);
		}
	});
});

describe("parseWorkerVerdict (cli-jaw port)", () => {
	it("parses word-boundary verdict tokens", () => {
		expect(parseWorkerVerdict("verdict: PASS — anchors verified")).toBe("pass");
		expect(parseWorkerVerdict("## FAIL\nfindings below")).toBe("fail");
		expect(parseWorkerVerdict("report DONE")).toBe("done");
		expect(parseWorkerVerdict("NEEDS_FIX: import broken")).toBe("needs_fix");
	});

	it("checks NEEDS_FIX before FAIL when both could match", () => {
		expect(parseWorkerVerdict("NEEDS_FIX — would otherwise FAIL")).toBe("needs_fix");
	});

	it("ignores prose without strict tokens", () => {
		expect(parseWorkerVerdict("the tests passed previously")).toBeNull();
		expect(parseWorkerVerdict("this is done-ish and failing")).toBeNull();
		expect(parseWorkerVerdict("")).toBeNull();
	});
});

describe("parseCriticVerdict (D050-23 stage-p vocabulary)", () => {
	it("parses critic tokens with negative verdicts first", () => {
		expect(parseCriticVerdict("verdict: OKAY")).toBe("okay");
		expect(parseCriticVerdict("ITERATE — sharpen AC 3")).toBe("iterate");
		expect(parseCriticVerdict("REJECT: scope hole")).toBe("reject");
		// Mixed prose fail-closes to the negative verdict.
		expect(parseCriticVerdict("would be OKAY but REJECT for now")).toBe("reject");
	});

	it("ignores prose without strict tokens", () => {
		expect(parseCriticVerdict("looks okay to me")).toBeNull();
		expect(parseCriticVerdict("")).toBeNull();
	});
});

describe("native pabcd envelope writer (D050-22)", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pabcd-state-test-"));
	});

	afterEach(async () => {
		await fs.rm(cwd, { recursive: true, force: true });
	});

	it("writes a checksum-stamped envelope with a native receipt", async () => {
		const filePath = await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "i",
				active: true,
				ctx: {},
			},
			{ command: "orchestrate i", toPhase: "i" },
		);
		expect(filePath).toBe(pabcdStatePath(cwd));
		const raw = JSON.parse(await fs.readFile(filePath, "utf-8")) as {
			skill: string;
			receipt: { skill: string; owner: string; content_sha256?: { algorithm: string } };
		};
		expect(raw.skill).toBe("pabcd");
		expect(raw.receipt.skill).toBe("pabcd");
		expect(raw.receipt.owner).toBe("jwc-runtime");
		expect(raw.receipt.content_sha256?.algorithm).toBe("sha256");
	});

	it("fail-closes on an invalid stage", async () => {
		await expect(
			writeNativeWorkflowEnvelopeAtomic(
				cwd,
				{
					skill: "pabcd",
					version: WORKFLOW_STATE_VERSION,
					updated_at: new Date().toISOString(),
					// Deliberately invalid stage for the fail-closed gate.
					current_phase: "z" as unknown as PabcdStage,
					active: true,
				},
				{ command: "orchestrate z" },
			),
		).rejects.toThrow(/Refusing to write invalid native pabcd envelope/);
	});

	it("scopes state per session directory", async () => {
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "p",
				active: true,
			},
			{ command: "orchestrate p", sessionId: "session.one" },
		);
		const scoped = await readPabcdState(cwd, "session.one");
		expect(scoped?.ok).toBe(true);
		const unscoped = await readPabcdState(cwd);
		expect(unscoped).toBeNull();
		expect(pabcdStatePath(cwd, "session.one")).toContain(path.join("sessions", "session%2Eone"));
	});

	it("does not leak shared pabcd state into a session-scoped read", async () => {
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "i",
				active: true,
			},
			{ command: "orchestrate i" },
		);

		const scoped = await readPabcdStateWithFallback(cwd, "fresh-session");
		expect(scoped).toBeNull();

		const shared = await readPabcdStateWithFallback(cwd);
		expect(shared?.ok).toBe(true);
		if (!shared?.ok) throw new Error("expected shared pabcd state");
		expect(shared.value.current_phase).toBe("i");
	});

	it("prefers session-scoped pabcd state over shared state", async () => {
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "i",
				active: true,
			},
			{ command: "orchestrate i" },
		);
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "p",
				active: true,
			},
			{ command: "orchestrate p", sessionId: "fresh-session" },
		);

		const scoped = await readPabcdStateWithFallback(cwd, "fresh-session");
		expect(scoped?.ok).toBe(true);
		if (!scoped?.ok) throw new Error("expected scoped pabcd state");
		expect(scoped.value.current_phase).toBe("p");
	});
});

describe("orchestrate runtime full cycle", () => {
	let cwd: string;

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pabcd-runtime-test-"));
	});

	afterEach(async () => {
		await fs.rm(cwd, { recursive: true, force: true });
	});

	async function run(args: string[]): Promise<{ stdout?: string; stderr?: string; status: number }> {
		return await runNativeOrchestrateCommand(args, cwd);
	}

	async function recordOkay(): Promise<void> {
		const okayFile = path.join(cwd, "critic-okay.txt");
		await fs.writeFile(okayFile, "OKAY", "utf-8");
		expect((await run(["verdict", "--worker-output", okayFile])).status).toBe(0);
	}

	function encodeSessionSegment(value: string): string {
		return encodeURIComponent(value).replaceAll(".", "%2E");
	}

	function jawInterviewStatePathForTest(root: string, sessionId?: string): string {
		const stateDir = path.join(root, ".jwc", "state");
		if (sessionId)
			return path.join(stateDir, "sessions", encodeSessionSegment(sessionId), "jaw-interview-state.json");
		return path.join(stateDir, "jaw-interview-state.json");
	}

	function activeStatePathForTest(root: string, sessionId?: string): string {
		const stateDir = path.join(root, ".jwc", "state");
		if (sessionId) return path.join(stateDir, "sessions", encodeSessionSegment(sessionId), "skill-active-state.json");
		return path.join(stateDir, "skill-active-state.json");
	}

	async function seedJawInterviewStateForTest(phase: string, sessionId?: string): Promise<void> {
		const now = new Date().toISOString();
		const statePath = jawInterviewStatePathForTest(cwd, sessionId);
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			`${JSON.stringify({ active: true, current_phase: phase, skill: "jaw-interview", version: WORKFLOW_STATE_VERSION, session_id: sessionId, updated_at: now }, null, 2)}\n`,
			"utf-8",
		);
		await fs.writeFile(
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
			"utf-8",
		);
	}

	async function readJsonForTest(filePath: string): Promise<Record<string, unknown>> {
		return JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
	}

	async function expectNoActiveJawInterviewForTest(sessionId?: string): Promise<void> {
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

	async function expectActiveJawInterviewForTest(sessionId?: string): Promise<void> {
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

	it("runs i→p→a→(verdict pass)→b→(verdict done)→c→d→complete", async () => {
		expect((await run(["i"])).status).toBe(0);
		expect((await run(["p", "--spec-ref", ".jwc/specs/jaw-interview-x.md"])).status).toBe(0);
		await recordOkay();
		expect((await run(["a"])).status).toBe(0);

		// Gate: b refused while audit is pending.
		const refused = await run(["b"]);
		expect(refused.status).toBe(1);
		expect(refused.stderr).toContain("requires audit verdict 'pass'");

		const passFile = path.join(cwd, "audit.txt");
		await fs.writeFile(passFile, "PASS — all anchors verified", "utf-8");
		expect((await run(["verdict", "--audit-lens", "planner", "--worker-output", passFile])).status).toBe(0);
		expect((await run(["verdict", "--audit-lens", "architect", "--worker-output", passFile])).status).toBe(0);
		expect((await run(["b"])).status).toBe(0);

		const doneFile = path.join(cwd, "verify.txt");
		await fs.writeFile(doneFile, "DONE", "utf-8");
		expect((await run(["verdict", "--worker-output", doneFile])).status).toBe(0);
		expect((await run(["c"])).status).toBe(0);
		expect((await run(["d"])).status).toBe(0);
		const closed = await run(["d"]);
		expect(closed.status).toBe(0);
		expect(closed.stdout).toContain("pabcd → complete");

		const status = await run(["status", "--json"]);
		const parsed = JSON.parse(status.stdout ?? "{}") as {
			active: boolean;
			stage: string;
			spec_ref: string | null;
			ctx: { audit_status?: string; verification_status?: string };
		};
		expect(parsed.active).toBe(false);
		expect(parsed.stage).toBe("complete");
		expect(parsed.spec_ref).toBe(".jwc/specs/jaw-interview-x.md");
		expect(parsed.ctx.audit_status).toBe("pass");
		expect(parsed.ctx.verification_status).toBe("done");
	});

	it("escalates after the a-round cap (D050-20: a_round ≤ 3)", async () => {
		await run(["i"]);
		await run(["p"]);
		await recordOkay();
		await run(["a"]);
		const failFile = path.join(cwd, "fail.txt");
		await fs.writeFile(failFile, "FAIL — findings", "utf-8");
		expect((await run(["verdict", "--audit-lens", "architect", "--worker-output", failFile])).stdout).toContain(
			"verdict=fail",
		);
		expect(
			(
				await run([
					"verdict",
					"--audit-lens",
					"architect",
					"--revision-id",
					"a-r1",
					"--review-override-ref",
					"devlog/synthesis-r1.md",
					"--worker-output",
					failFile,
				])
			).stdout,
		).toContain("verdict=fail");
		const third = await run([
			"verdict",
			"--audit-lens",
			"architect",
			"--revision-id",
			"a-r2",
			"--review-override-ref",
			"devlog/synthesis-r2.md",
			"--worker-output",
			failFile,
		]);
		expect(third.stdout).toContain("round cap reached");
	});

	it("rejects stage skips and unknown stages", async () => {
		expect((await run(["b"])).status).toBe(1);
		await run(["i"]);
		const skip = await run(["c"]);
		expect(skip.status).toBe(1);
		expect(skip.stderr).toContain("Invalid transition");
		expect((await run(["z"])).status).toBe(2);
	});

	it("forces dual audit mode under --deliberate (D050-21)", async () => {
		await run(["i"]);
		await run(["p", "--deliberate"]);
		await recordOkay();
		await run(["a", "--audit-mode", "solo"]);
		const status = await run(["status", "--json"]);
		const parsed = JSON.parse(status.stdout ?? "{}") as { ctx: { a_audit_mode?: string } };
		expect(parsed.ctx.a_audit_mode).toBe("dual");
	});

	it("enters p directly with a spec (D050-2 handoff, no i round-trip)", async () => {
		const entry = await run(["p", "--spec-ref", ".jwc/specs/jaw-interview-direct.md"]);
		expect(entry.status).toBe(0);
		const status = await run(["status", "--json"]);
		const parsed = JSON.parse(status.stdout ?? "{}") as { stage: string; spec_ref: string | null };
		expect(parsed.stage).toBe("p");
		expect(entry.stdout).toContain("Never spawn another Critic against an unchanged plan");
		expect(parsed.spec_ref).toBe(".jwc/specs/jaw-interview-direct.md");
	});

	it("retires same-scope jaw-interview handoff after direct p entry", async () => {
		await withPabcdSessionEnv({}, async () => {
			await seedJawInterviewStateForTest("handoff");
			expect((await run(["p"])).status).toBe(0);

			const state = await readJsonForTest(jawInterviewStatePathForTest(cwd));
			expect(state.active).toBe(false);
			expect(state.workflow_exit_reason).toBe("orchestrate-p");
			await expectNoActiveJawInterviewForTest();
		});
	});

	it("retires only session-scoped jaw-interview handoff after session p entry", async () => {
		await seedJawInterviewStateForTest("handoff");
		await seedJawInterviewStateForTest("handoff", "session-A");

		const result = await withPabcdSessionEnv({ jwc: "session-A" }, () => run(["p"]));
		expect(result.status).toBe(0);

		const sessionState = await readJsonForTest(jawInterviewStatePathForTest(cwd, "session-A"));
		const rootState = await readJsonForTest(jawInterviewStatePathForTest(cwd));
		expect(sessionState.active).toBe(false);
		expect(sessionState.workflow_exit_reason).toBe("orchestrate-p");
		expect(rootState.active).toBe(true);
		await expectNoActiveJawInterviewForTest("session-A");
		await expectActiveJawInterviewForTest();
	});

	it("retires runtime-created session jaw-interview active entry from root aggregate after session p entry", async () => {
		const result = await runNativeJawInterviewCommand(
			[
				"--write",
				"--stage",
				"final",
				"--slug",
				"runtime-session-retire",
				"--spec",
				"# Runtime Session Retire",
				"--session-id",
				"session-A",
				"--json",
			],
			cwd,
		);
		expect(result.status).toBe(0);

		const transition = await withPabcdSessionEnv({ jwc: "session-A" }, () => run(["p"]));
		expect(transition.status).toBe(0);

		const sessionState = await readJsonForTest(jawInterviewStatePathForTest(cwd, "session-A"));
		expect(sessionState.active).toBe(false);
		expect(sessionState.workflow_exit_reason).toBe("orchestrate-p");
		await expectNoActiveJawInterviewForTest("session-A");
		await expectNoActiveJawInterviewForTest();
	});

	it("restores shared jaw-interview active-state after retiring a runtime-created session entry", async () => {
		await withPabcdSessionEnv({}, async () => {
			const shared = await runNativeJawInterviewCommand(
				[
					"--write",
					"--stage",
					"final",
					"--slug",
					"shared-runtime-retire",
					"--spec",
					"# Shared Runtime Retire",
					"--json",
				],
				cwd,
			);
			expect(shared.status).toBe(0);
		});
		await withPabcdSessionEnv({ jwc: "session-A" }, async () => {
			const session = await runNativeJawInterviewCommand(
				[
					"--write",
					"--stage",
					"final",
					"--slug",
					"session-runtime-retire",
					"--spec",
					"# Session Runtime Retire",
					"--session-id",
					"session-A",
					"--json",
				],
				cwd,
			);
			expect(session.status).toBe(0);
		});

		const transition = await withPabcdSessionEnv({ jwc: "session-A" }, () => run(["p"]));
		expect(transition.status).toBe(0);

		const sessionState = await readJsonForTest(jawInterviewStatePathForTest(cwd, "session-A"));
		const rootState = await readJsonForTest(jawInterviewStatePathForTest(cwd));
		expect(sessionState.active).toBe(false);
		expect(sessionState.workflow_exit_reason).toBe("orchestrate-p");
		expect(rootState.active).toBe(true);
		await expectNoActiveJawInterviewForTest("session-A");
		await expectActiveJawInterviewForTest();
	});

	it("does not retire active interviewing during normal p entry", async () => {
		await withPabcdSessionEnv({}, async () => {
			await seedJawInterviewStateForTest("interviewing");
			expect((await run(["p"])).status).toBe(0);

			const state = await readJsonForTest(jawInterviewStatePathForTest(cwd));
			expect(state.active).toBe(true);
			expect(state.current_phase).toBe("interviewing");
		});
	});

	it("records stage-p critic verdicts as an uncapped plan-revision loop (D050-19)", async () => {
		await run(["p"]);
		const iterateFile = path.join(cwd, "critic-iterate.txt");
		await fs.writeFile(iterateFile, "ITERATE — AC 2 is ambiguous", "utf-8");
		const first = await run(["verdict", "--worker-output", iterateFile]);
		expect(first.stdout).toContain("verdict=iterate");
		const second = await run(["verdict", "--worker-output", iterateFile]);
		expect(second.stdout).toContain("verdict=iterate");
		expect(second.stdout).toContain("p_round=2");
		const third = await run(["verdict", "--worker-output", iterateFile]);
		expect(third.stdout).toContain("verdict=iterate");
		expect(third.stdout).toContain("p_round=3");

		const okayFile = path.join(cwd, "critic-okay.txt");
		await fs.writeFile(okayFile, "OKAY", "utf-8");
		expect((await run(["verdict", "--worker-output", okayFile])).stdout).toContain("verdict=okay");
		const status = await run(["status", "--json"]);
		const parsed = JSON.parse(status.stdout ?? "{}") as { ctx: { p_review_passed?: boolean } };
		expect(parsed.ctx.p_review_passed).toBe(true);
	});

	it("allows p→a after an evidence-backed Critic waiver", async () => {
		await run(["p"]);
		const iterateFile = path.join(cwd, "critic-iterate-waived.txt");
		await fs.writeFile(iterateFile, "ITERATE — overblocking concern", "utf-8");
		const verdict = await run([
			"verdict",
			"--worker-output",
			iterateFile,
			"--review-override-ref",
			"devlog/_plan/example/critic-synthesis.md",
		]);
		expect(verdict.status).toBe(0);

		const status = await run(["status", "--json"]);
		const parsed = JSON.parse(status.stdout ?? "{}") as {
			ctx: { p_review_passed?: boolean; p_review_override?: { synthesis_ref?: string } };
		};
		expect(parsed.ctx.p_review_passed).toBe(false);
		expect(parsed.ctx.p_review_override?.synthesis_ref).toBe("devlog/_plan/example/critic-synthesis.md");
		expect((await run(["a"])).status).toBe(0);
	});

	it("aggregates stage-a lens verdicts by revision", async () => {
		await run(["p"]);
		await recordOkay();
		await run(["a"]);
		const passFile = path.join(cwd, "audit-pass.txt");
		await fs.writeFile(passFile, "PASS", "utf-8");

		expect((await run(["verdict", "--worker-output", passFile])).stderr).toContain(
			"stage a verdict requires --audit-lens",
		);
		expect((await run(["verdict", "--audit-lens", "planner", "--worker-output", passFile])).status).toBe(0);

		let status = await run(["status", "--json"]);
		let parsed = JSON.parse(status.stdout ?? "{}") as { ctx: { audit_status?: string } };
		expect(parsed.ctx.audit_status).toBe("pending");

		expect((await run(["verdict", "--audit-lens", "architect", "--worker-output", passFile])).status).toBe(0);
		status = await run(["status", "--json"]);
		parsed = JSON.parse(status.stdout ?? "{}") as { ctx: { audit_status?: string } };
		expect(parsed.ctx.audit_status).toBe("pass");
	});

	it("serves the stage-a audit prompts with the PASS|FAIL contract (D050-23)", async () => {
		for (const lens of ["planner", "architect"] as const) {
			const result = await run(["audit-prompt", lens]);
			expect(result.status).toBe(0);
			expect(result.stdout).toContain("READ-ONLY");
			expect(result.stdout).toContain("`PASS` or `FAIL`");
			expect(result.stdout).toContain(lens === "planner" ? "PLANNER-A<n>" : "ARCH-A<n>");
			expect(result.stdout).toContain("delta re-audit");
		}
		expect((await run(["audit-prompt"])).status).toBe(2);
		expect((await run(["audit-prompt", "critic"])).status).toBe(2);
	});

	it("does not read shared PABCD by default when a session env is active", async () => {
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "i",
				active: true,
			},
			{ command: "orchestrate i" },
		);
		const result = await withPabcdSessionEnv({ jwc: "session-B" }, () => run(["status"]));
		expect(result.stdout).toContain("pabcd: idle");
		expect(result.stdout).not.toContain("Scope:        shared");
	});

	it("targets shared PABCD explicitly with --shared from a session env", async () => {
		await writeNativeWorkflowEnvelopeAtomic(
			cwd,
			{
				skill: "pabcd",
				version: WORKFLOW_STATE_VERSION,
				updated_at: new Date().toISOString(),
				current_phase: "i",
				active: true,
			},
			{ command: "orchestrate i" },
		);
		const result = await withPabcdSessionEnv({ jwc: "session-B" }, () => run(["status", "--shared"]));
		expect(result.stdout).toContain("Scope:        shared");
	});

	it("honors GJC_SESSION_ID as a session env alias", async () => {
		const result = await withPabcdSessionEnv({ gjc: "session-G" }, () => run(["p"]));
		expect(result.status).toBe(0);
		expect(await readPabcdState(cwd, "session-G")).not.toBeNull();
		expect(await readPabcdState(cwd)).toBeNull();
	});

	it("writes shared PABCD when --shared is passed with a session env", async () => {
		const result = await withPabcdSessionEnv({ jwc: "session-B" }, () => run(["p", "--shared"]));
		expect(result.status).toBe(0);
		expect(await readPabcdState(cwd)).not.toBeNull();
		expect(await readPabcdState(cwd, "session-B")).toBeNull();
	});

	it("--shared overrides explicit --session-id for non-reset commands", async () => {
		const result = await withPabcdSessionEnv({ jwc: "env-session" }, () =>
			run(["p", "--session-id", "flag-session", "--shared"]),
		);
		expect(result.status).toBe(0);
		expect(await readPabcdState(cwd)).not.toBeNull();
		expect(await readPabcdState(cwd, "flag-session")).toBeNull();
		expect(await readPabcdState(cwd, "env-session")).toBeNull();
	});
});

describe("direct P entry without a spec (260613 — i는 P의 필수 선행이 아님)", () => {
	it("idle → p succeeds with no spec_ref", () => {
		const result = canTransitionPabcd(null, "p");
		expect(result.ok).toBe(true);
	});

	it("idle entry failure message offers direct p without demanding a spec", () => {
		const result = canTransitionPabcd(null, "b");
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("plan directly — spec optional");
	});
});
