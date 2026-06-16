#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import { assertCallableTaskRoles } from "./lib/callable-task-roles";

const expectedWorkflowSkills = ["jaw-interview", "plan", "team", "goal"];
const expectedRoleAgentPromptFiles = ["architect", "critic", "executor", "planner"];
const expectedCallableTaskRoles = ["architect", "critic", "executor", "executor_ext", "planner"];
const bundledNonWorkflowSkills = new Set(["browse", "search"]);
const repoRoot = process.cwd();

function listSkillDirs(dir: string): string[] {
	const full = path.join(repoRoot, dir);
	if (!fs.existsSync(full)) return [];
	return fs
		.readdirSync(full, { withFileTypes: true })
		.filter(entry => entry.isDirectory() && fs.existsSync(path.join(full, entry.name, "SKILL.md")))
		.map(entry => entry.name);
}

function listDefinitionFiles(dir: string, extensions: readonly string[]): string[] {
	const full = path.join(repoRoot, dir);
	if (!fs.existsSync(full)) return [];
	return fs
		.readdirSync(full, { withFileTypes: true })
		.filter(entry => entry.isFile() && extensions.some(extension => entry.name.endsWith(extension)))
		.map(entry => {
			const extension = extensions.find(candidate => entry.name.endsWith(candidate));
			return extension ? entry.name.slice(0, -extension.length) : entry.name;
		});
}

async function main(): Promise<void> {
	const visibleSkills = listSkillDirs(".jwc/skills").sort();
	const visibleAgents = listDefinitionFiles(".jwc/agents", [".md", ".toml"]).sort();
	const otherVisibleDefinitions = [
		...listDefinitionFiles(".jwc/commands", [".md"]),
		...listDefinitionFiles(".jwc/rules", [".md"]),
	].sort();
	const bundledSkills = listSkillDirs("packages/coding-agent/src/defaults/jwc/skills")
		.filter(name => !bundledNonWorkflowSkills.has(name))
		.sort();
	const bundledRoleAgentPromptFiles = listDefinitionFiles("packages/coding-agent/src/prompts/agents", [".md"])
		.filter(name => expectedRoleAgentPromptFiles.includes(name))
		.sort();
	const callableTaskRoleFindings = await assertCallableTaskRoles(expectedCallableTaskRoles, repoRoot);
	const unexpectedVisible = [...visibleSkills, ...visibleAgents, ...otherVisibleDefinitions].sort();
	const missingBundledSkills = expectedWorkflowSkills.filter(name => !bundledSkills.includes(name));
	const missingRoleAgentPromptFiles = expectedRoleAgentPromptFiles.filter(
		name => !bundledRoleAgentPromptFiles.includes(name),
	);
	const ignoredDefinitions = getIgnoredDefinitionPaths([
		...expectedWorkflowSkills.map(name => `packages/coding-agent/src/defaults/jwc/skills/${name}/SKILL.md`),
		...expectedRoleAgentPromptFiles.map(name => `packages/coding-agent/src/prompts/agents/${name}.md`),
	]);

	if (
		unexpectedVisible.length > 0 ||
		missingBundledSkills.length > 0 ||
		missingRoleAgentPromptFiles.length > 0 ||
		callableTaskRoleFindings.length > 0 ||
		ignoredDefinitions.length > 0 ||
		bundledSkills.length !== expectedWorkflowSkills.length ||
		bundledRoleAgentPromptFiles.length !== expectedRoleAgentPromptFiles.length
	) {
		console.error("Default surface definitions mismatch");
		console.error(
			JSON.stringify(
				{
					expectedWorkflowSkills,
					expectedRoleAgentPromptFiles,
					expectedCallableTaskRoles,
					visibleSkills,
					visibleAgents,
					otherVisibleDefinitions,
					bundledSkills,
					bundledRoleAgentPromptFiles,
					callableTaskRoleFindings,
					missingBundledSkills,
					missingRoleAgentPromptFiles,
					ignoredDefinitions,
					unexpectedVisible,
				},
				null,
				2,
			),
		);
		process.exit(1);
	}

	console.log(
		`Default surface OK: bundled workflow skills=${bundledSkills.join(", ")} bundled role prompt files=${bundledRoleAgentPromptFiles.join(", ")} callable task roles=${expectedCallableTaskRoles.join(", ")}`,
	);
}

function getIgnoredDefinitionPaths(paths: string[]): string[] {
	const ignored: string[] = [];
	for (const filePath of paths) {
		const result = Bun.spawnSync(["git", "check-ignore", filePath], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
		if (result.exitCode === 0) {
			ignored.push(filePath);
		}
	}
	return ignored;
}

await main();
