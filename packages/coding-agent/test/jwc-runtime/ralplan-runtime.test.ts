import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runNativePlanWriterCommand } from "@gajae-code/coding-agent/jwc-runtime/plan-writer";
import { GJC_RESTRICTED_ROLE_AGENT_BASH_ENV } from "@gajae-code/coding-agent/jwc-runtime/restricted-role-agent-bash";

const tempRoots: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-planphase-runtime-"));
	tempRoots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe("native jwc planphase runtime — consensus handoff", () => {
	it("accepts the documented flag surface without rejecting --interactive/--deliberate", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--interactive", "--deliberate", "make state native"], root);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("planphase seed run_id=");
		const state = JSON.parse(await fs.readFile(path.join(root, ".jwc", "state", "planphase-state.json"), "utf-8"));
		expect(state.mode).toBe("deliberate");
		expect(state.interactive).toBe(true);
		expect(state.task).toBe("make state native");
	});

	it("emits receipt-only json for consensus handoff", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--json", "--deliberate", "make state native"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload).toMatchObject({
			ok: true,
			skill: "plan",
			mode: "deliberate",
			handoff: "/skill:plan",
		});
		expect(typeof payload.run_id).toBe("string");
		expect(payload.state_path).toContain(path.join(".jwc", "state", "planphase-state.json"));
		expect(payload.task).toBeUndefined();
	});

	it("rejects corrupt planphase state before consensus handoff seeding", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "planphase-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(statePath, "{broken json", "utf-8");

		const result = await runNativePlanWriterCommand(["--json", "make state native"], root);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("existing planphase state is corrupt or tampered");
		expect(await fs.readFile(statePath, "utf-8")).toBe("{broken json");
	});

	it("reuses a valid active run id during consensus handoff seeding", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "planphase-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(
			statePath,
			JSON.stringify({ skill: "plan", active: true, current_phase: "planner", run_id: "existing-run" }),
			"utf-8",
		);

		const result = await runNativePlanWriterCommand(["--json", "continue existing"], root);

		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}") as { run_id: string };
		expect(payload.run_id).toBe("existing-run");
		const state = JSON.parse(await fs.readFile(statePath, "utf-8")) as { run_id: string; task: string };
		expect(state.run_id).toBe("existing-run");
		expect(state.task).toBe("continue existing");
	});

	it("--architect openai-code seeds the kind into state", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			["--architect", "openai-code", "--critic", "openai-code", "scope a refactor"],
			root,
		);
		expect(result.status).toBe(0);
		const state = JSON.parse(await fs.readFile(path.join(root, ".jwc", "state", "planphase-state.json"), "utf-8"));
		expect(state.architect_kind).toBe("openai-code");
		expect(state.critic_kind).toBe("openai-code");
	});

	it("syncs plan HUD chips for the active run", async () => {
		const root = await tempDir();
		await runNativePlanWriterCommand(["--deliberate", "task"], root);
		const active = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "skill-active-state.json"), "utf-8"),
		);
		const entry = (
			active.active_skills as Array<{
				skill: string;
				phase?: string;
				hud?: { chips?: Array<{ label: string; value?: string }> };
			}>
		).find(e => e.skill === "plan");
		expect(entry).toBeTruthy();
		expect(entry?.phase).toBe("planner");
		const chips = entry?.hud?.chips ?? [];
		expect(chips.some(c => c.label === "stage" && c.value === "planner")).toBe(true);
		expect(chips.some(c => c.label === "iter" && c.value === "1")).toBe(true);
	});

	it("rejects unknown --architect kinds with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--architect", "nope", "task"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("unknown --architect kind");
	});

	it("rejects missing task description with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--deliberate"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("requires a task description");
	});

	it("rejects unknown free-form flags with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(["--no-such-flag", "task"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("unknown flag");
	});
});

describe("native jwc planphase runtime — --write artifact path", () => {
	it("persists an inline artifact under .jwc/plans/planphase/<run-id>/", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan body",
				"--run-id",
				"test-run-1",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.run_id).toBe("test-run-1");
		expect(payload.stage).toBe("planner");
		expect(payload.stage_n).toBe(1);
		expect(typeof payload.sha256).toBe("string");
		const filePath = path.join(root, ".jwc", "plans", "planphase", "test-run-1", "stage-01-planner.md");
		const content = await fs.readFile(filePath, "utf-8");
		expect(content).toBe("# Plan body\n");
		const indexLine = (
			await fs.readFile(path.join(root, ".jwc", "plans", "planphase", "test-run-1", "index.jsonl"), "utf-8")
		).trim();
		expect(JSON.parse(indexLine).sha256).toBe(payload.sha256);
	});

	it("--artifact <file> reads contents from disk", async () => {
		const root = await tempDir();
		const artifactPath = path.join(root, "draft.md");
		await fs.writeFile(artifactPath, "# Draft\nbody\n");
		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "architect", "--stage_n", "2", "--artifact", artifactPath, "--run-id", "file-run"],
			root,
		);
		expect(result.status).toBe(0);
		const content = await fs.readFile(
			path.join(root, ".jwc", "plans", "planphase", "file-run", "stage-02-architect.md"),
			"utf-8",
		);
		expect(content).toBe("# Draft\nbody\n");
	});

	it("restricted role-agent bash treats --artifact paths as inline text", async () => {
		const root = await tempDir();
		const artifactPath = path.join(root, "secret.md");
		await fs.writeFile(artifactPath, "# Secret\nshould-not-be-read\n");
		const previous = process.env[GJC_RESTRICTED_ROLE_AGENT_BASH_ENV];
		process.env[GJC_RESTRICTED_ROLE_AGENT_BASH_ENV] = "1";
		try {
			const result = await runNativePlanWriterCommand(
				[
					"--write",
					"--stage",
					"architect",
					"--stage_n",
					"2",
					"--artifact",
					artifactPath,
					"--run-id",
					"restricted-file-run",
				],
				root,
			);
			expect(result.status).toBe(0);
			const content = await fs.readFile(
				path.join(root, ".jwc", "plans", "planphase", "restricted-file-run", "stage-02-architect.md"),
				"utf-8",
			);
			expect(content).toBe(`${artifactPath}\n`);
		} finally {
			if (previous === undefined) {
				delete process.env[GJC_RESTRICTED_ROLE_AGENT_BASH_ENV];
			} else {
				process.env[GJC_RESTRICTED_ROLE_AGENT_BASH_ENV] = previous;
			}
		}
	});

	it("final stage emits pending-approval.md alongside the stage artifact", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"final",
				"--stage_n",
				"6",
				"--artifact",
				"# Final Plan",
				"--run-id",
				"final-run",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(typeof payload.pending_approval_path).toBe("string");
		const pendingApproval = await fs.readFile(
			path.join(root, ".jwc", "plans", "planphase", "final-run", "pending-approval.md"),
			"utf-8",
		);
		expect(pendingApproval).toBe("# Final Plan\n");
	});

	it("rejects unknown --stage with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "nope", "--stage_n", "1", "--artifact", "x"],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("unknown --stage");
	});

	it("rejects out-of-range --stage_n with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1000", "--artifact", "x"],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("invalid --stage_n");
	});

	it("rejects malformed non-integer --stage_n like '1.5' or '1abc' with exit 2", async () => {
		const root = await tempDir();
		for (const bad of ["1.5", "1abc", "0", "-1", "abc"]) {
			const result = await runNativePlanWriterCommand(
				["--write", "--stage", "planner", "--stage_n", bad, "--artifact", "x"],
				root,
			);
			expect(result.status, `expected rejection for ${bad}`).toBe(2);
			expect(result.stderr).toContain("invalid --stage_n");
		}
	});

	it("rejects --run-id with traversal characters with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "x", "--run-id", "../escape"],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("invalid path component");
	});

	it("appends index.jsonl entries instead of overwriting", async () => {
		const root = await tempDir();
		await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "p1", "--run-id", "multi"],
			root,
		);
		await runNativePlanWriterCommand(
			["--write", "--stage", "architect", "--stage_n", "2", "--artifact", "a2", "--run-id", "multi"],
			root,
		);
		const indexLines = (
			await fs.readFile(path.join(root, ".jwc", "plans", "planphase", "multi", "index.jsonl"), "utf-8")
		)
			.trim()
			.split("\n");
		expect(indexLines.length).toBe(2);
		expect(JSON.parse(indexLines[0]).stage).toBe("planner");
		expect(JSON.parse(indexLines[1]).stage).toBe("architect");
	});

	it("keeps multiple --write calls in the same run when no --run-id is supplied", async () => {
		const root = await tempDir();
		const first = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "p1", "--json"],
			root,
		);
		expect(first.status).toBe(0);
		const firstPayload = JSON.parse(first.stdout ?? "{}") as { run_id: string };

		const second = await runNativePlanWriterCommand(
			["--write", "--stage", "architect", "--stage_n", "2", "--artifact", "a2", "--json"],
			root,
		);
		expect(second.status).toBe(0);
		const secondPayload = JSON.parse(second.stdout ?? "{}") as { run_id: string };

		// Without explicit --run-id, both writes should target the same auto-generated run.
		expect(secondPayload.run_id).toBe(firstPayload.run_id);

		const indexLines = (
			await fs.readFile(path.join(root, ".jwc", "plans", "planphase", firstPayload.run_id, "index.jsonl"), "utf-8")
		)
			.trim()
			.split("\n");
		expect(indexLines.length).toBe(2);
		expect(JSON.parse(indexLines[0]).stage).toBe("planner");
		expect(JSON.parse(indexLines[1]).stage).toBe("architect");
	});

	it("plan consensus handoff seeds run_id that subsequent --write calls reuse", async () => {
		const root = await tempDir();
		const handoff = await runNativePlanWriterCommand(["--deliberate", "--json", "task"], root);
		expect(handoff.status).toBe(0);
		const handoffPayload = JSON.parse(handoff.stdout ?? "{}") as { run_id: string };
		expect(typeof handoffPayload.run_id).toBe("string");

		const write = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "# Plan", "--json"],
			root,
		);
		expect(write.status).toBe(0);
		const writePayload = JSON.parse(write.stdout ?? "{}") as { run_id: string };
		expect(writePayload.run_id).toBe(handoffPayload.run_id);
	});
});

describe("native jwc planphase runtime — persisted Planner state", () => {
	const statePath = (root: string) => path.join(root, ".jwc", "state", "planphase-state.json");

	async function readState(root: string): Promise<Record<string, unknown>> {
		const raw = await fs.readFile(statePath(root), "utf-8");
		return JSON.parse(raw) as Record<string, unknown>;
	}

	it("records planner id + resumable into run state and echoes planner_state", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan",
				"--run-id",
				"pp-run",
				"--planner-id",
				"0-Planner",
				"--planner-resumable",
				"true",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.planner_state).toEqual({
			planner_subagent_id: "0-Planner",
			planner_resumable: true,
		});
		const state = await readState(root);
		expect(state.planner_subagent_id).toBe("0-Planner");
		expect(state.planner_resumable).toBe(true);
		expect(state.run_id).toBe("pp-run");
	});

	it("accepts --planner-resumable false", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"2",
				"--artifact",
				"# Rev",
				"--run-id",
				"pp-false",
				"--planner-resumable",
				"false",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const state = await readState(root);
		expect(state.planner_resumable).toBe(false);
	});

	it("omits planner fields when no planner flags are supplied (existing writes unaffected)", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "# Plan", "--run-id", "plain", "--json"],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.planner_state).toBeUndefined();
		const state = await readState(root);
		expect("planner_subagent_id" in state).toBe(false);
		expect("planner_resumable" in state).toBe(false);
	});

	it("rejects corrupt planphase state before persisting an active run id", async () => {
		const root = await tempDir();
		await fs.mkdir(path.dirname(statePath(root)), { recursive: true });
		await fs.writeFile(statePath(root), "{broken json", "utf-8");

		const result = await runNativePlanWriterCommand(
			["--write", "--stage", "planner", "--stage_n", "1", "--artifact", "# Plan", "--run-id", "corrupt", "--json"],
			root,
		);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("existing planphase state is corrupt or tampered");
		expect(await fs.readFile(statePath(root), "utf-8")).toBe("{broken json");
	});

	it("rejects corrupt planphase state before applying planner metadata", async () => {
		const root = await tempDir();
		await fs.mkdir(path.dirname(statePath(root)), { recursive: true });
		await fs.writeFile(statePath(root), "{broken json", "utf-8");

		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan",
				"--run-id",
				"corrupt-planner",
				"--planner-id",
				"0-Planner",
				"--json",
			],
			root,
		);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("existing planphase state is corrupt or tampered");
		expect(await fs.readFile(statePath(root), "utf-8")).toBe("{broken json");
	});

	it("records fallback metadata together with a fresh planner id", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"3",
				"--artifact",
				"# Rev",
				"--run-id",
				"pp-fb",
				"--planner-id",
				"1-PlannerFresh",
				"--fallback-reason",
				"context_unavailable",
				"--fallback-attempted-id",
				"0-PlannerOld",
				"--fallback-stage-n",
				"3",
				"--fallback-receipt-path",
				".jwc/plans/planphase/pp-fb/stage-03-revision.md",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const state = await readState(root);
		expect(state.planner_fallback_reason).toBe("context_unavailable");
		expect(state.planner_fallback_attempted_id).toBe("0-PlannerOld");
		expect(state.planner_fallback_stage_n).toBe(3);
		expect(state.planner_fallback_receipt_path).toBe(".jwc/plans/planphase/pp-fb/stage-03-revision.md");
		expect(state.planner_subagent_id).toBe("1-PlannerFresh");
	});

	it("rejects invalid --planner-resumable with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"x",
				"--run-id",
				"bad-bool",
				"--planner-resumable",
				"yes",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("invalid --planner-resumable");
	});

	it("rejects invalid --planner-id with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"x",
				"--run-id",
				"bad-id",
				"--planner-id",
				"bad id!",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("invalid --planner-id");
	});

	it("rejects unknown --fallback-reason with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"2",
				"--artifact",
				"x",
				"--run-id",
				"bad-reason",
				"--fallback-reason",
				"because",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("invalid --fallback-reason");
	});

	it("requires --fallback-reason when other fallback flags are present", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"2",
				"--artifact",
				"x",
				"--run-id",
				"missing-reason",
				"--fallback-attempted-id",
				"0-Old",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("--fallback-reason is required");
	});

	it("does not persist an artifact when planner flags are invalid (fail-fast)", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan",
				"--run-id",
				"no-side-effect",
				"--planner-resumable",
				"maybe",
			],
			root,
		);
		expect(result.status).toBe(2);
		const filePath = path.join(root, ".jwc", "plans", "planphase", "no-side-effect", "stage-01-planner.md");
		await expect(fs.readFile(filePath, "utf-8")).rejects.toThrow();
	});

	it("requires --fallback-attempted-id alongside --fallback-reason", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"2",
				"--artifact",
				"x",
				"--run-id",
				"fb-missing-id",
				"--fallback-reason",
				"context_unavailable",
				"--fallback-stage-n",
				"2",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("--fallback-attempted-id is required");
	});

	it("requires --fallback-stage-n alongside --fallback-reason", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"revision",
				"--stage_n",
				"2",
				"--artifact",
				"x",
				"--run-id",
				"fb-missing-stage",
				"--fallback-reason",
				"context_unavailable",
				"--fallback-attempted-id",
				"0-Old",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("--fallback-stage-n is required");
	});

	it("rejects a planner flag supplied without a value (missing value at EOF)", async () => {
		const root = await tempDir();
		const result = await runNativePlanWriterCommand(
			[
				"--write",
				"--stage",
				"planner",
				"--stage_n",
				"1",
				"--artifact",
				"# Plan",
				"--run-id",
				"eof-flag",
				"--planner-id",
			],
			root,
		);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("missing value for --planner-id");
	});
});
