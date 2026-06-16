import { clearBundledAgentsCache, loadBundledAgents } from "../../packages/coding-agent/src/task/agents";

export function listCallableTaskRoles(): string[] {
	clearBundledAgentsCache();
	return loadBundledAgents()
		.filter(agent => !agent.hide)
		.map(agent => agent.name)
		.sort();
}

export async function assertCallableTaskRoles(
	expected: readonly string[],
	repoRoot = process.cwd(),
): Promise<string[]> {
	const actual = listCallableTaskRoles();
	const sortedExpected = [...expected].sort();
	const findings: string[] = [];
	if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
		findings.push(`callable task roles mismatch: expected ${sortedExpected.join(", ")}, got ${actual.join(", ")}`);
	}
	if (await Bun.file(`${repoRoot}/packages/coding-agent/src/prompts/agents/executor_ext.md`).exists()) {
		findings.push("executor_ext must be generated from executor; prompts/agents/executor_ext.md must not exist");
	}
	return findings;
}
