import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	JWC_MODEL_ASSIGNMENT_TARGET_IDS,
	JWC_MODEL_ASSIGNMENT_TARGETS,
} from "@gajae-code/coding-agent/config/model-registry";
import {
	DEFAULT_JWC_DEFINITION_NAMES,
	getDefaultJwcDefinitions,
	getEmbeddedDefaultJwcSkillFragments,
	getEmbeddedDefaultJwcSkills,
	installDefaultJwcDefinitions,
} from "@gajae-code/coding-agent/defaults/jwc-defaults";
import { loadSkills, resetActiveSkillsForTests, setActiveSkills } from "@gajae-code/coding-agent/extensibility/skills";
import { parseInternalUrl } from "@gajae-code/coding-agent/internal-urls/parse";
import { SkillProtocolHandler } from "@gajae-code/coding-agent/internal-urls/skill-protocol";
import { getBundledAgent } from "@gajae-code/coding-agent/task/agents";
import { discoverAgents } from "@gajae-code/coding-agent/task/discovery";

const tempRoots: string[] = [];
const roleAgentNames = ["architect", "critic", "executor", "executor_ext", "planner"] as const;
const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");

async function makeTempRoot(): Promise<string> {
	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-default-definitions-"));
	tempRoots.push(tempRoot);
	return tempRoot;
}

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
	const originalHome = process.env.HOME;
	const home = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-default-home-"));
	tempRoots.push(home);
	process.env.HOME = home;
	try {
		return await fn(home);
	} finally {
		if (originalHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = originalHome;
		}
	}
}

afterEach(async () => {
	resetActiveSkillsForTests();
	await Promise.all(tempRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("default GJC definitions", () => {
	it("bundles all default skills plus fragments as installable assets", () => {
		const definitions = getDefaultJwcDefinitions();
		const workflowDefinitions = definitions.filter(definition => definition.kind === "skill");
		const fragmentDefinitions = definitions.filter(definition => definition.kind === "skill-fragment");
		const skills = workflowDefinitions.map(definition => definition.name).sort();
		const expected = [...DEFAULT_JWC_DEFINITION_NAMES].sort();

		expect(skills).toEqual(expected);
		expect(workflowDefinitions).toHaveLength(6);
		expect(definitions).toHaveLength(10);
		expect(workflowDefinitions.every(definition => definition.relativePath.startsWith("skills/"))).toBe(true);
		expect(workflowDefinitions.every(definition => definition.content.includes(definition.name))).toBe(true);
		expect(fragmentDefinitions).toHaveLength(4);
		expect(fragmentDefinitions.map(definition => definition.parentSkillName).sort()).toEqual([
			"browse",
			"goal",
			"jaw-interview",
			"jaw-interview",
		]);
		expect(fragmentDefinitions.map(definition => definition.relativePath).sort()).toEqual([
			"skill-fragments/browse/web-ai.md",
			"skill-fragments/goal/ai-slop-cleaner.md",
			"skill-fragments/jaw-interview/auto-answer-uncertain.md",
			"skill-fragments/jaw-interview/auto-research-greenfield.md",
		]);
	});

	it("exposes jaw-interview fragments only through the parent-scoped fragment accessor", () => {
		const fragments = getEmbeddedDefaultJwcSkillFragments("jaw-interview");

		expect(
			getEmbeddedDefaultJwcSkills()
				.map(skill => skill.name)
				.sort(),
		).toEqual([...DEFAULT_JWC_DEFINITION_NAMES].sort());
		expect(fragments).toHaveLength(2);
		expect(fragments.map(fragment => fragment.kind)).toEqual(["skill-fragment", "skill-fragment"]);
		expect(fragments.map(fragment => fragment.relativePath).sort()).toEqual([
			"skill-fragments/jaw-interview/auto-answer-uncertain.md",
			"skill-fragments/jaw-interview/auto-research-greenfield.md",
		]);
		expect(fragments.every(fragment => fragment.content.includes("read-only architect"))).toBe(true);
	});

	it("exposes the goal ai-slop-cleaner fragment only through the parent-scoped fragment accessor", () => {
		const fragments = getEmbeddedDefaultJwcSkillFragments("goal");

		expect(
			getEmbeddedDefaultJwcSkills()
				.map(skill => skill.name)
				.sort(),
		).toEqual([...DEFAULT_JWC_DEFINITION_NAMES].sort());
		expect(fragments).toHaveLength(1);
		expect(fragments.map(fragment => fragment.kind)).toEqual(["skill-fragment"]);
		expect(fragments.map(fragment => fragment.relativePath)).toEqual(["skill-fragments/goal/ai-slop-cleaner.md"]);
		expect(fragments[0]!.content).toContain("AI SLOP CLEANUP REPORT");
		expect(fragments[0]!.content).toContain("read-only detector");
	});

	it("exposes the browse web-ai fragment through the parent-scoped fragment accessor", () => {
		const fragments = getEmbeddedDefaultJwcSkillFragments("browse");

		expect(fragments).toHaveLength(1);
		expect(fragments.map(fragment => fragment.kind)).toEqual(["skill-fragment"]);
		expect(fragments.map(fragment => fragment.relativePath)).toEqual(["skill-fragments/browse/web-ai.md"]);
		expect(fragments[0]!.content).toContain("web-ai");
	});

	it("authors the ai-slop-cleaner fragment with the mandated report labels and full taxonomy", () => {
		const fragment = getEmbeddedDefaultJwcSkillFragments("goal")[0]!;
		const content = fragment.content;

		for (const label of [
			"AI SLOP CLEANUP REPORT",
			"Scope:",
			"Mode: read-only detector/report; no edits performed",
			"Blocking Findings",
			"Advisory Findings",
			"Fallback Findings",
			"UI/Design Findings",
			"Missing Test Findings",
			"Recursion Guard",
			"Changed Files Reviewed",
			"Gate Result: PASS | BLOCKED",
		]) {
			expect(content).toContain(label);
		}
		for (const taxonomy of [
			"masking fallback slop",
			"grounded compatibility/fail-safe fallback",
			"Fallback-like code",
			"Duplication",
			"Dead code",
			"Needless abstraction",
			"Boundary violations",
			"UI/design slop",
			"Missing tests",
		]) {
			expect(content).toContain(taxonomy);
		}
	});

	it("wires the ai-slop-cleaner into the goal completion gate before verification and red-team", () => {
		const goal = getDefaultJwcDefinitions().find(
			definition => definition.kind === "skill" && definition.name === "goal",
		);
		if (!goal) throw new Error("missing bundled goal skill");
		const content = goal.content;

		const sectionStart = content.indexOf("## Mandatory completion cleanup and review gate");
		expect(sectionStart).toBeGreaterThanOrEqual(0);
		const afterStart = content.indexOf("\n## ", sectionStart + 1);
		const section = content.slice(sectionStart, afterStart === -1 ? undefined : afterStart);

		const cleanerStep = section.indexOf("2. Run the internal ai-slop-cleaner skill fragment");
		const verifyStep = section.indexOf("3. Rerun verification after the cleaner pass");
		const architectStep = section.indexOf("4. Delegate an `architect` review");
		const redTeamStep = section.indexOf("5. Delegate an `executor` QA/red-team lane");

		expect(cleanerStep).toBeGreaterThanOrEqual(0);
		expect(verifyStep).toBeGreaterThan(cleanerStep);
		expect(architectStep).toBeGreaterThan(verifyStep);
		expect(redTeamStep).toBeGreaterThan(architectStep);

		expect(section).toContain("reruns the cleaner until blocking findings are zero");
		expect(section).toContain("Advisory findings are included in the gate report only");
	});

	it("keeps the five callable role agents bundled when project .jwc is absent", async () => {
		await withTempHome(async home => {
			const repoRoot = await makeTempRoot();
			const agents = await discoverAgents(repoRoot, home);
			const bundledRoleAgents = agents.agents
				.filter(
					agent =>
						agent.source === "bundled" && roleAgentNames.includes(agent.name as (typeof roleAgentNames)[number]),
				)
				.map(agent => agent.name)
				.sort();

			expect(bundledRoleAgents).toEqual([...roleAgentNames].sort());
			expect(agents.projectAgentsDir).toBeNull();
		});
	});

	it("exposes default, external executor, and three review roles as model assignment targets", () => {
		expect(JWC_MODEL_ASSIGNMENT_TARGET_IDS).toEqual(["default", "executor_ext", "architect", "planner", "critic"]);
		expect(JWC_MODEL_ASSIGNMENT_TARGET_IDS.map(id => JWC_MODEL_ASSIGNMENT_TARGETS[id].tag)).toEqual([
			"DEFAULT",
			"EXECUTOR_EXT",
			"ARCHITECT",
			"PLANNER",
			"CRITIC",
		]);
	});

	it("enforces role-agent tool boundaries through parsed frontmatter", () => {
		const executor = getBundledAgent("executor");
		const architect = getBundledAgent("architect");
		const planner = getBundledAgent("planner");
		const critic = getBundledAgent("critic");
		const executorExt = getBundledAgent("executor_ext");

		expect(executor?.tools).toBeUndefined();
		for (const agent of [architect, planner, critic]) {
			expect(agent?.tools).toBeDefined();
			expect(agent?.tools).toContain("yield");
			expect(agent?.tools).toContain("bash");
			expect(agent?.tools).not.toContain("edit");
			expect(agent?.tools).not.toContain("write");
			expect(agent?.bashAllowedPrefixes).toEqual(["jwc planphase --write", "jwc state"]);
		}
		expect(executor?.model).toEqual(["self"]);
		expect(executorExt?.tools).toBeUndefined();
		expect(executorExt?.model).toEqual(["self"]);
		expect(executorExt?.systemPrompt).toContain("Convert a scoped task into a working, verified outcome");
		expect(executorExt?.description).toContain("External");
		for (const agent of [architect, planner, critic]) {
			expect(agent?.model).toBeUndefined();
		}
		expect(architect?.systemPrompt).toContain("Architectural Status");
		expect(architect?.systemPrompt).toContain("CRITICAL");
		expect(architect?.systemPrompt).toContain("REQUEST CHANGES");
		expect(planner?.systemPrompt).toContain("you do not implement");
		expect(critic?.systemPrompt).toContain("OKAY");
		expect(critic?.systemPrompt).toContain("REJECT");
	});

	it("makes installed project workflow skills discoverable without installing project agent stubs", async () => {
		await withTempHome(async home => {
			// Engine brand opt-in: the fork-default jaw brand would substitute the
			// real ~/.cli-jaw global skills root into this fixture-scoped check.
			const savedBrand = process.env.GJC_BRAND_NAME;
			const savedCliJawHome = process.env.CLI_JAW_HOME;
			process.env.GJC_BRAND_NAME = "gjc";
			process.env.CLI_JAW_HOME = home; // isolate from real ~/.cli-jaw/skills/

			try {
				const repoRoot = await makeTempRoot();
				const projectJwcRoot = path.join(repoRoot, ".jwc");
				await installDefaultJwcDefinitions({ targetRoot: projectJwcRoot });

				const skills = await loadSkills({
					cwd: repoRoot,
					enabled: true,
					enablePiProject: true,
					enablePiUser: false,
				});
				const agents = await discoverAgents(repoRoot, home);
				const expected = [...DEFAULT_JWC_DEFINITION_NAMES].sort();

				expect(skills.skills.map(skill => skill.name).sort()).toEqual(expected);
				expect(skills.skills.some(skill => skill.name === "auto-research-greenfield")).toBe(false);
				expect(skills.skills.some(skill => skill.name === "auto-answer-uncertain")).toBe(false);
				expect(
					agents.agents
						.filter(agent => agent.source === "project")
						.map(agent => agent.name)
						.sort(),
				).toEqual([]);
				expect(agents.projectAgentsDir).toBeNull();
			} finally {
				if (savedBrand === undefined) delete process.env.GJC_BRAND_NAME;
				else process.env.GJC_BRAND_NAME = savedBrand;
				if (savedCliJawHome === undefined) delete process.env.CLI_JAW_HOME;
				else process.env.CLI_JAW_HOME = savedCliJawHome;
			}
		});
	});

	it("preserves project .jwc agent overrides at runtime", async () => {
		await withTempHome(async home => {
			const repoRoot = await makeTempRoot();
			const agentsDir = path.join(repoRoot, ".jwc", "agents");
			await fs.mkdir(agentsDir, { recursive: true });
			await Bun.write(
				path.join(agentsDir, "executor.md"),
				`---
name: executor
description: Project executor override.
---
Project executor override body.
`,
			);

			const agents = await discoverAgents(repoRoot, home);
			const executor = agents.agents.find(agent => agent.name === "executor");

			expect(executor?.source).toBe("project");
			expect(executor?.systemPrompt).toContain("Project executor override body");
			expect(agents.projectAgentsDir).toBe(agentsDir);
		});
	});

	it("documents role-agent delegation in system and goal prompts", async () => {
		const systemPrompt = await Bun.file(
			path.join(repoRoot, "packages", "coding-agent", "src", "prompts", "system", "system-prompt.md"),
		).text();
		const goal = await Bun.file(
			path.join(repoRoot, "packages", "coding-agent", "src", "defaults", "jwc", "skills", "goal", "SKILL.md"),
		).text();

		for (const name of roleAgentNames) {
			expect(systemPrompt).toContain(name);
			expect(goal).toContain(name);
		}
		expect(systemPrompt).toContain("delegate bounded slices to `executor`");
		expect(systemPrompt).toContain("committed repo-visible `.jwc` defaults are not the source of truth");
		expect(goal).toContain("run the native orchestrate plan stage first");
		expect(goal).toContain("Role agents return implementation/review evidence");
		expect(goal).toContain("await timeout only limits the leader's wait");
		expect(goal).toContain("must not be used as a cancellation reason");
		expect(goal).toContain("the subagent has actually failed");
		expect(goal).toContain("gone off-track");
		expect(goal).toContain("become unrecoverably wrong");
	});

	it("documents leader-owned Goal checkpoints for Team bridge workers", async () => {
		const team = await Bun.file(
			path.join(repoRoot, "packages", "coding-agent", "src", "defaults", "jwc", "skills", "team", "SKILL.md"),
		).text();
		const goal = await Bun.file(
			path.join(repoRoot, "packages", "coding-agent", "src", "defaults", "jwc", "skills", "goal", "SKILL.md"),
		).text();

		for (const content of [team, goal]) {
			expect(content).toContain('fresh `goal({"op":"get"})` snapshot');
			expect(content).toContain("Workers must not run `jwc goal checkpoint`");
			expect(content).toContain("checkpoint authority stays with the leader");
			expect(content).toContain("Goal does not auto-launch Team");
			expect(content).toContain("performs no hidden goal mutation");
		}
	});

	it("keeps bundled jaw-interview skill on jwc-native workflow vocabulary", () => {
		const jawInterview = getDefaultJwcDefinitions().find(
			definition => definition.kind === "skill" && definition.name === "jaw-interview",
		);
		expect(jawInterview).toBeDefined();
		const content = jawInterview?.content ?? "";

		for (const required of ["ask", ".jwc/state", "pending approval"]) {
			expect(content).toContain(required);
		}
		expect(content).toContain("jwc orchestrate p --spec-ref");
		expect(content).toContain("/skill:team");
		expect(content).toContain("never superseded legacy planning skill loops");
		expect(content).toContain("Direct `.jwc/state` edits are forbidden");
		expect(content).toContain("do not edit `.jwc/state` directly without force override");
		expect(content).toContain("default `0.05`");
		expect(content).toContain("language.instruction");
		expect(content).toContain("Do not surprise a Korean session with English questions");
		expect(content).toContain('"language": "<existing language object from active state, if present>"');
		expect(content).toContain("progress reports, and spec prose");
		expect(content).toContain("translated/localized according to `language.instruction`");
		expect(content).not.toContain("default `0.2`");
		expect(content).not.toContain("20%");

		for (const forbidden of [
			"AskUserQuestion",
			"AskUserQuestionTool",
			"state_write",
			"state_read",
			"Skill(",
			"gajae-code:",
			"/gajae-code",
			"`gjc ",
		]) {
			expect(content).not.toContain(forbidden);
		}
	});

	it("keeps bundled plan stage artifacts on CLI write path", () => {
		const plan = getDefaultJwcDefinitions().find(
			definition => definition.kind === "skill" && definition.name === "plan",
		);
		expect(plan).toBeDefined();
		const content = plan?.content ?? "";

		expect(content).toContain("jwc planphase --write --stage <type> --stage_n <N> --artifact");
		expect(content).toContain("--stage planner");
		expect(content).toContain("--stage architect");
		expect(content).toContain("--stage critic");
		expect(content).toContain("do not directly edit `.jwc/plans`");
		expect(content).toContain(
			"Direct `write`, `edit`, or `ast_edit` calls against `.jwc/specs`, `.jwc/plans`, `.jwc/state`, or any other `.jwc/` path are forbidden",
		);
	});

	it("installs bundled workflow skill definitions without overwriting local edits unless forced", async () => {
		const targetRoot = await makeTempRoot();
		const initial = await installDefaultJwcDefinitions({ targetRoot });
		const jawInterviewSkillPath = path.join(targetRoot, "skills", "jaw-interview", "SKILL.md");
		const installedJawInterview = await Bun.file(jawInterviewSkillPath).text();

		expect(initial.written).toBe(10);
		expect(initial.total).toBe(10);
		expect(initial.skipped).toBe(0);
		expect(initial.files.filter(file => file.kind === "skill-fragment")).toHaveLength(4);

		const installedResearchFragment = await Bun.file(
			path.join(targetRoot, "skill-fragments", "jaw-interview", "auto-research-greenfield.md"),
		).text();
		expect(installedResearchFragment).toContain("ranked candidate answers");
		await Bun.write(jawInterviewSkillPath, "local edit");
		const skipped = await installDefaultJwcDefinitions({ targetRoot });
		expect(skipped.written).toBe(0);
		expect(skipped.skipped).toBe(10);
		expect(await Bun.file(jawInterviewSkillPath).text()).toBe("local edit");

		const check = await installDefaultJwcDefinitions({ targetRoot, check: true });
		expect(check.different).toBe(1);
		expect(check.matching).toBe(9);

		const forced = await installDefaultJwcDefinitions({ targetRoot, force: true });
		expect(forced.written).toBe(10);
		expect(await Bun.file(jawInterviewSkillPath).text()).toBe(installedJawInterview);
		expect(
			forced.files.some(file => file.kind === "skill-fragment" && file.parentSkillName === "jaw-interview"),
		).toBe(true);
	});

	it("does not make installed fragments reachable as skill-relative internal URL assets", async () => {
		await withTempHome(async () => {
			const repoRoot = await makeTempRoot();
			await installDefaultJwcDefinitions({ targetRoot: path.join(repoRoot, ".jwc") });

			const skills = await loadSkills({
				cwd: repoRoot,
				enabled: true,
				enablePiProject: true,
				enablePiUser: false,
			});
			const jawInterview = skills.skills.find(
				skill => skill.name === "jaw-interview" && skill.source === "native:project",
			);
			if (!jawInterview) throw new Error("missing installed jaw-interview skill");

			setActiveSkills([jawInterview]);
			await expect(
				new SkillProtocolHandler().resolve(parseInternalUrl("skill://jaw-interview/auto-research-greenfield.md")),
			).rejects.toThrow("File not found");
		});
	});

	it("does not make the goal ai-slop-cleaner fragment reachable as a skill-relative internal URL asset", async () => {
		await withTempHome(async () => {
			const repoRoot = await makeTempRoot();
			await installDefaultJwcDefinitions({ targetRoot: path.join(repoRoot, ".jwc") });

			const skills = await loadSkills({
				cwd: repoRoot,
				enabled: true,
				enablePiProject: true,
				enablePiUser: false,
			});
			const goal = skills.skills.find(skill => skill.name === "goal" && skill.source === "native:project");
			if (!goal) throw new Error("missing installed goal skill");

			setActiveSkills([goal]);
			await expect(
				new SkillProtocolHandler().resolve(parseInternalUrl("skill://ultragoal/ai-slop-cleaner.md")),
			).rejects.toThrow("Unknown skill: ultragoal");
			await expect(
				new SkillProtocolHandler().resolve(parseInternalUrl("skill://goal/ai-slop-cleaner.md")),
			).rejects.toThrow("File not found");
			await expect(new SkillProtocolHandler().resolve(parseInternalUrl("skill://ai-slop-cleaner"))).rejects.toThrow(
				"Unknown skill: ai-slop-cleaner",
			);
		});
	});
});

describe("bundled skills CLI", () => {
	it("reads embedded workflow skills from outside the repository without .jwc files", async () => {
		const externalRoot = await makeTempRoot();
		const proc = Bun.spawn(
			[
				process.execPath,
				path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts"),
				"skills",
				"read",
				"goal",
				"--json",
			],
			{
				cwd: externalRoot,
				stdout: "pipe",
				stderr: "pipe",
				env: {
					...process.env,
					HOME: await makeTempRoot(),
					PI_NO_TITLE: "1",
					NO_COLOR: "1",
					FORCE_COLOR: undefined,
				},
			},
		);
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		const parsed = JSON.parse(stdout) as { name: string; path: string; source: string; content: string };
		expect(parsed.name).toBe("goal");
		expect(parsed.path).toBe("embedded:jwc/skills/goal/SKILL.md");
		expect(parsed.source).toBe("bundled:default");
		expect(parsed.content).toContain("# Goal");
	});

	it("lists exactly the embedded default workflow skills", async () => {
		const externalRoot = await makeTempRoot();
		const proc = Bun.spawn(
			[
				process.execPath,
				path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts"),
				"skills",
				"list",
				"--json",
			],
			{
				cwd: externalRoot,
				stdout: "pipe",
				stderr: "pipe",
				env: {
					...process.env,
					HOME: await makeTempRoot(),
					PI_NO_TITLE: "1",
					NO_COLOR: "1",
					FORCE_COLOR: undefined,
				},
			},
		);
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		const parsed = JSON.parse(stdout) as { skills: Array<{ name: string; path: string }> };
		expect(parsed.skills.map(skill => skill.name).sort()).toEqual([...DEFAULT_JWC_DEFINITION_NAMES].sort());
		expect(parsed.skills.every(skill => skill.path.startsWith("embedded:jwc/skills/"))).toBe(true);
		expect(parsed.skills.some(skill => skill.name === "auto-research-greenfield")).toBe(false);
		expect(parsed.skills.some(skill => skill.name === "auto-answer-uncertain")).toBe(false);
		expect(parsed.skills.some(skill => skill.name === "ai-slop-cleaner")).toBe(false);
	});

	it("does not expose embedded fragments through skills read", async () => {
		for (const fragmentName of ["auto-research-greenfield", "auto-answer-uncertain", "ai-slop-cleaner"]) {
			const externalRoot = await makeTempRoot();
			const proc = Bun.spawn(
				[
					process.execPath,
					path.join(repoRoot, "packages", "coding-agent", "src", "cli.ts"),
					"skills",
					"read",
					fragmentName,
					"--json",
				],
				{
					cwd: externalRoot,
					stdout: "pipe",
					stderr: "pipe",
					env: {
						...process.env,
						HOME: await makeTempRoot(),
						PI_NO_TITLE: "1",
						NO_COLOR: "1",
						FORCE_COLOR: undefined,
					},
				},
			);
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			expect(exitCode).not.toBe(0);
			expect(stdout).toBe("");
			expect(stderr).toContain("unknown embedded skill");
		}
	});
});
