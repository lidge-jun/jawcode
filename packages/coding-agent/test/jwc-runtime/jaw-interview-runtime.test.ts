import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import {
	retireJawInterviewStateForWorkflowExit,
	runNativeJawInterviewCommand,
} from "@gajae-code/coding-agent/jwc-runtime/jaw-interview-runtime";
import { runNativePlanWriterCommand } from "@gajae-code/coding-agent/jwc-runtime/plan-writer";

import { getConfigRootDir, setAgentDir } from "@gajae-code/utils";
import { resetSettingsForTest } from "../../src/config/settings";

const tempRoots: string[] = [];
const codingAgentRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");

const originalAgentDir = process.env.GJC_CODING_AGENT_DIR;
const originalJwcSessionId = process.env.JWC_SESSION_ID;
const originalGjcSessionId = process.env.GJC_SESSION_ID;
const fallbackAgentDir = path.join(getConfigRootDir(), "agent");
async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-jaw-interview-runtime-"));
	tempRoots.push(dir);
	return dir;
}

beforeEach(async () => {
	resetSettingsForTest();
	setAgentDir(await tempDir());
	delete process.env.JWC_SESSION_ID;
	delete process.env.GJC_SESSION_ID;
});

afterEach(async () => {
	resetSettingsForTest();
	if (originalAgentDir) {
		setAgentDir(originalAgentDir);
	} else {
		setAgentDir(fallbackAgentDir);
		delete process.env.GJC_CODING_AGENT_DIR;
	}
	if (originalJwcSessionId) {
		process.env.JWC_SESSION_ID = originalJwcSessionId;
	} else {
		delete process.env.JWC_SESSION_ID;
	}
	if (originalGjcSessionId) {
		process.env.GJC_SESSION_ID = originalGjcSessionId;
	} else {
		delete process.env.GJC_SESSION_ID;
	}
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe("native gjc jaw-interview runtime", () => {
	it("advertises the jaw-interview spec persistence and handoff surface in command help", async () => {
		const source = await fs.readFile(path.join(codingAgentRoot, "src/commands/interview.ts"), "utf-8");
		// The lightweight CLI help renderer advertises exactly the static flags/examples declared by the command.
		expect(source).toContain("write: Flags.boolean");
		expect(source).toContain("stage: Flags.string");
		expect(source).toContain("slug: Flags.string");
		expect(source).toContain("spec: Flags.string");
		expect(source).toContain("deliberate: Flags.boolean");
		expect(source).toContain("handoff: Flags.string");
	});

	it("handles missing, valid, and corrupt jaw-interview state during spec persistence", async () => {
		const missingRoot = await tempDir();
		const missing = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "missing-state", "--spec", "# Missing", "--json"],
			missingRoot,
		);
		expect(missing.status).toBe(0);
		const missingState = JSON.parse(
			await fs.readFile(path.join(missingRoot, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(missingState.spec_slug).toBe("missing-state");

		const validRoot = await tempDir();
		const validStatePath = path.join(validRoot, ".jwc", "state", "jaw-interview-state.json");
		await fs.mkdir(path.dirname(validStatePath), { recursive: true });
		await fs.writeFile(
			validStatePath,
			`${JSON.stringify({ transcript: [{ question: "q", answer: "a" }], current_phase: "interviewing" })}\n`,
			"utf-8",
		);
		const valid = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "valid-state", "--spec", "# Valid", "--json"],
			validRoot,
		);
		expect(valid.status).toBe(0);
		const validState = JSON.parse(await fs.readFile(validStatePath, "utf-8"));
		expect(validState.transcript).toEqual([{ question: "q", answer: "a" }]);
		expect(validState.spec_slug).toBe("valid-state");
	});

	it("fails closed on corrupt jaw-interview state unless --force is supplied", async () => {
		const root = await tempDir();
		const statePath = path.join(root, ".jwc", "state", "jaw-interview-state.json");
		await fs.mkdir(path.dirname(statePath), { recursive: true });
		await fs.writeFile(statePath, '{"current_phase":', "utf-8");

		const rejected = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "corrupt-rejected", "--spec", "# Rejected", "--json"],
			root,
		);
		expect(rejected.status).toBe(2);
		expect(rejected.stderr).toContain("existing jaw-interview state is corrupt or tampered");
		expect(rejected.stderr).toContain("use --force to overwrite");
		expect(await fs.readFile(statePath, "utf-8")).toBe('{"current_phase":');
		await expect(fs.access(path.join(root, ".jwc", "specs", "jaw-interview-corrupt-rejected.md"))).rejects.toThrow();

		const forced = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "corrupt-forced", "--spec", "# Forced", "--force", "--json"],
			root,
		);
		expect(forced.status).toBe(0);
		const forcedState = JSON.parse(await fs.readFile(statePath, "utf-8"));
		expect(forcedState.spec_slug).toBe("corrupt-forced");
		expect(forcedState.receipt).toMatchObject({ skill: "jaw-interview", owner: "jwc-runtime" });
		const audit = (await fs.readFile(path.join(root, ".jwc", "state", "audit.jsonl"), "utf-8"))
			.trim()
			.split("\n")
			.map(line => JSON.parse(line) as Record<string, unknown>);
		expect(
			audit.some(entry => entry.skill === "jaw-interview" && entry.verb === "write" && entry.forced === true),
		).toBe(true);
	});

	it("persists a final spec under .jwc/specs through the native CLI/API", async () => {
		const root = await tempDir();
		const specPath = path.join(root, "final-spec.md");
		await fs.writeFile(specPath, "# Final Spec\n\nAcceptance: persist me.\n");

		const result = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "persist-me", "--spec", specPath, "--json"],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.path).toBe(path.join(root, ".jwc", "specs", "jaw-interview-persist-me.md"));
		expect(await fs.readFile(payload.path, "utf-8")).toBe("# Final Spec\n\nAcceptance: persist me.\n");

		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.current_phase).toBe("handoff");
		expect(state.active).toBe(true);
		expect(state.spec_path).toBe(payload.path);
		expect(state.spec_slug).toBe("persist-me");
		await expect(fs.access(path.join(root, ".jwc", "plans"))).rejects.toThrow();
	});

	it("uses --deliberate to persist the final spec and hand off to plan", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(
			[
				"--write",
				"--stage",
				"final",
				"--slug",
				"deliberate-spec",
				"--spec",
				"# Final Spec\n\nUse plan deliberately.",
				"--deliberate",
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.handoff).toMatchObject({ to: "plan", mode: "deliberate" });

		const specPath = path.join(root, ".jwc", "specs", "jaw-interview-deliberate-spec.md");
		expect(await fs.readFile(specPath, "utf-8")).toContain("Use plan deliberately.");

		const jawInterviewState = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(jawInterviewState.active).toBe(false);
		expect(jawInterviewState.current_phase).toBe("handoff");
		expect(jawInterviewState.handoff_to).toBe("plan");
		expect(jawInterviewState.spec_path).toBe(specPath);

		const planState = JSON.parse(await fs.readFile(path.join(root, ".jwc", "state", "plan-state.json"), "utf-8"));
		expect(planState.active).toBe(true);
		expect(planState.current_phase).toBe("planner");
		expect(planState.handoff_from).toBe("jaw-interview");
		const planphaseState = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "planphase-state.json"), "utf-8"),
		);
		expect(planphaseState.mode).toBe("deliberate");
		expect(planphaseState.task).toBe(specPath);
	});

	it("retires persisted handoff state for workflow exit", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "retire-me", "--spec", "# Spec", "--json"],
			root,
		);
		expect(result.status).toBe(0);

		expect(await retireJawInterviewStateForWorkflowExit({ cwd: root, reason: "orchestrate-p" })).toBe(true);
		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.active).toBe(false);
		expect(state.current_phase).toBe("handoff");
		expect(state.workflow_exit_reason).toBe("orchestrate-p");
		expect(state.receipt).toMatchObject({ skill: "jaw-interview", owner: "jwc-runtime" });
	});

	it("does not retire active interviewing on normal P exit", async () => {
		const root = await tempDir();
		expect((await runNativeJawInterviewCommand(["--json", "vague idea"], root)).status).toBe(0);

		expect(await retireJawInterviewStateForWorkflowExit({ cwd: root, reason: "orchestrate-p" })).toBe(false);
		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.active).toBe(true);
		expect(state.current_phase).toBe("interviewing");
	});

	it("retires active interviewing on reset exit", async () => {
		const root = await tempDir();
		expect((await runNativeJawInterviewCommand(["--json", "vague idea"], root)).status).toBe(0);

		expect(
			await retireJawInterviewStateForWorkflowExit({
				cwd: root,
				reason: "orchestrate-reset",
				includeActiveInterview: true,
			}),
		).toBe(true);
		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.active).toBe(false);
		expect(state.current_phase).toBe("interviewing");
		expect(state.workflow_exit_reason).toBe("orchestrate-reset");
	});

	it("keeps jaw-interview spec persistence distinct from planphase plan writes", async () => {
		const root = await tempDir();
		const deepResult = await runNativeJawInterviewCommand(
			["--write", "--stage", "final", "--slug", "separate", "--spec", "# Requirements", "--json"],
			root,
		);
		expect(deepResult.status).toBe(0);
		const deepPayload = JSON.parse(deepResult.stdout ?? "{}");
		expect(deepPayload.path).toContain(path.join(".jwc", "specs", "jaw-interview-separate.md"));

		const planphaseResult = await runNativePlanWriterCommand(
			["--write", "--stage", "final", "--stage_n", "1", "--artifact", "# Plan", "--run-id", "separate", "--json"],
			root,
		);
		expect(planphaseResult.status).toBe(0);
		const planphasePayload = JSON.parse(planphaseResult.stdout ?? "{}");
		expect(planphasePayload.path).toContain(path.join(".jwc", "plans", "planphase", "separate", "stage-01-final.md"));
		expect(await fs.readFile(deepPayload.path, "utf-8")).toBe("# Requirements\n");
		expect(await fs.readFile(planphasePayload.path, "utf-8")).toBe("# Plan\n");
	});
	it("persists Korean as the jaw-interview question language when the initial idea is Korean", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["--json", "한국어 세션에서 구현 방향을 명확히 해줘"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.language).toMatchObject({
			code: "ko",
			label: "Korean",
			source: "initial-idea",
		});
		expect(payload.language.instruction).toContain("Korean");

		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.language).toEqual(payload.language);
		expect(state.state.language).toEqual(payload.language);
	});

	it("lets explicit English requests override Korean jaw-interview language detection", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["--json", "한국어 배경이지만 질문은 영어로 해줘"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.language).toMatchObject({
			code: "en",
			label: "English",
			source: "explicit-user-request",
		});
		expect(payload.language.instruction).toContain("explicitly requested English");
	});

	it("defaults to the SKILL.md default threshold (0.05) when no resolution flag or settings exist", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["my vague idea"], root);
		expect(result.status).toBe(0);
		const state = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "jaw-interview-state.json"), "utf-8"),
		);
		expect(state.resolution).toBe("standard");
		expect(state.threshold).toBeCloseTo(0.05);
		expect(state.threshold_source).toBe("default");
		expect(state.state.initial_idea).toBe("my vague idea");
	});

	it("falls back to the legacy gjc.deepInterview.ambiguityThreshold key (042 D041-D)", async () => {
		const root = await tempDir();
		await fs.mkdir(path.join(root, ".jwc"), { recursive: true });
		await fs.writeFile(
			path.join(root, ".jwc", "settings.json"),
			JSON.stringify({ gjc: { deepInterview: { ambiguityThreshold: 0.12 } } }),
		);
		const result = await runNativeJawInterviewCommand(["--standard", "--json", "idea"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.threshold).toBeCloseTo(0.12);
	});

	it("prefers the new jwc.interview key over the legacy key when both exist", async () => {
		const root = await tempDir();
		await fs.mkdir(path.join(root, ".jwc"), { recursive: true });
		await fs.writeFile(
			path.join(root, ".jwc", "settings.json"),
			JSON.stringify({
				jwc: { interview: { ambiguityThreshold: 0.09 } },
				gjc: { deepInterview: { ambiguityThreshold: 0.4 } },
			}),
		);
		const result = await runNativeJawInterviewCommand(["--standard", "--json", "idea"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.threshold).toBeCloseTo(0.09);
	});

	it("honors jwc.interview.ambiguityThreshold in project .jwc/settings.json", async () => {
		const root = await tempDir();
		await fs.mkdir(path.join(root, ".jwc"), { recursive: true });
		await fs.writeFile(
			path.join(root, ".jwc", "settings.json"),
			JSON.stringify({ jwc: { interview: { ambiguityThreshold: 0.08 } } }),
		);
		const result = await runNativeJawInterviewCommand(["--standard", "--json", "idea"], root);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.threshold).toBeCloseTo(0.08);
		expect(payload.threshold_source).toBe(path.join(root, ".jwc", "settings.json"));
	});

	it("prefers modern config.yml threshold over legacy project settings.json", async () => {
		const root = await tempDir();
		const agentDir = await tempDir();
		setAgentDir(agentDir);
		resetSettingsForTest();
		await fs.writeFile(path.join(agentDir, "config.yml"), "jwc:\n  interview:\n    ambiguityThreshold: 0.2\n");
		await fs.mkdir(path.join(root, ".jwc"), { recursive: true });
		await fs.writeFile(
			path.join(root, ".jwc", "settings.json"),
			JSON.stringify({ jwc: { interview: { ambiguityThreshold: 0.08 } } }),
		);

		resetSettingsForTest();
		const result = await runNativeJawInterviewCommand(["--standard", "--json", "idea"], root);

		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.threshold).toBeCloseTo(0.2);
		expect(payload.threshold_source).toBe(path.join(agentDir, "config.yml"));
	});

	it("--threshold beats project settings.json", async () => {
		const root = await tempDir();
		await fs.mkdir(path.join(root, ".jwc"), { recursive: true });
		await fs.writeFile(
			path.join(root, ".jwc", "settings.json"),
			JSON.stringify({ jwc: { interview: { ambiguityThreshold: 0.08 } } }),
		);
		const result = await runNativeJawInterviewCommand(
			["--threshold", "0.25", "--threshold-source", "flag:explicit", "--json", "idea"],
			root,
		);
		expect(result.status).toBe(0);
		const payload = JSON.parse(result.stdout ?? "{}");
		expect(payload.threshold).toBeCloseTo(0.25);
		expect(payload.threshold_source).toBe("flag:explicit");
	});

	it("--quick / --standard / --deep map to their resolution thresholds", async () => {
		const root = await tempDir();
		const quick = await runNativeJawInterviewCommand(["--quick", "--json", "idea"], root);
		expect(quick.status).toBe(0);
		expect(JSON.parse(quick.stdout ?? "{}").resolution).toBe("quick");
		expect(JSON.parse(quick.stdout ?? "{}").threshold).toBeCloseTo(0.6);

		const root2 = await tempDir();
		const deep = await runNativeJawInterviewCommand(["--deep", "--json", "idea"], root2);
		expect(JSON.parse(deep.stdout ?? "{}").resolution).toBe("deep");
		expect(JSON.parse(deep.stdout ?? "{}").threshold).toBeCloseTo(0.35);
	});

	it("syncs jaw-interview HUD chips for the active run", async () => {
		const root = await tempDir();
		await runNativeJawInterviewCommand(["--standard", "idea body"], root);
		const active = JSON.parse(
			await fs.readFile(path.join(root, ".jwc", "state", "skill-active-state.json"), "utf-8"),
		);
		const entry = (
			active.active_skills as Array<{
				skill: string;
				phase?: string;
				hud?: { chips?: Array<{ label: string; value?: string }> };
			}>
		).find(e => e.skill === "jaw-interview");
		expect(entry).toBeTruthy();
		expect(entry?.phase).toBe("interviewing");
		const chips = entry?.hud?.chips ?? [];
		expect(chips.some(c => c.label === "phase" && c.value === "interviewing")).toBe(true);
		expect(chips.some(c => c.label === "ambiguity")).toBe(true);
	});

	it("rejects --threshold outside (0,1] with exit 2", async () => {
		const root = await tempDir();
		const tooBig = await runNativeJawInterviewCommand(["--threshold", "1.5", "idea"], root);
		expect(tooBig.status).toBe(2);
		expect(tooBig.stderr).toContain("invalid --threshold");

		const negative = await runNativeJawInterviewCommand(["--threshold", "-0.1", "idea"], root);
		expect(negative.status).toBe(2);
	});

	it("rejects combining multiple resolution flags with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["--quick", "--deep", "idea"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("at most one");
	});

	it("rejects missing idea with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["--standard"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("requires an idea");
	});

	it("rejects unknown flags with exit 2", async () => {
		const root = await tempDir();
		const result = await runNativeJawInterviewCommand(["--no-such-flag", "idea"], root);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("unknown flag");
	});
});
