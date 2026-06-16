#!/usr/bin/env bun
import { $ } from "bun";
import * as path from "node:path";

const repoRoot = path.join(import.meta.dir, "..");
// Local agent sessions may export a workflow session id, which would redirect
// state-runtime tests into session-scoped state paths. CI gates exercise the
// default native-free state files, so keep this script hermetic.
delete process.env.GJC_SESSION_ID;
delete process.env.GJC_STATE_SESSION_ID;

const relevantPathPrefixes = [
	"packages/coding-agent/",
	".github/workflows/dev-ci.yml",
	".github/workflows/ci.yml",
	"scripts/ci-jwc-state-gates.ts",
	"scripts/verify-jwc-state-writers.ts",
	"scripts/generate-jwc-workflow-manifest.ts",
	"scripts/verify-jwc-skill-docs.ts",
	"scripts/verify-g002-gates.ts",
	"package.json",
	"bun.lock",
	"tsconfig.json",
	"tsconfig.base.json",
	"tsconfig.tools.json",
];

const boundedGateCommands = [
	["bun", "scripts/verify-jwc-state-writers.ts", "--fail"],
	["bun", "scripts/generate-jwc-workflow-manifest.ts", "--check"],
	["bun", "scripts/verify-jwc-skill-docs.ts", "--fail"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-schema.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-migrations.test.ts"],
	// NOTE: state-writer-drift.test.ts imports recordSkillActivation (hooks) and
	// persistJwcTeamModeStateSummary (team-runtime), which load the @gajae-code/natives
	// addon transitively, so it runs in the heavier "Affected path validation" job, not
	// this native-free gate.
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-schema-corpus.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-runtime.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-handoff.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-receipts.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-integrity.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-write-hardening.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-graph.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-read-markdown.test.ts"],
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-token-thrift.test.ts"],
	// Lane H read-only doctor: imports only the native-free state-runtime module.
	["bun", "test", "packages/coding-agent/test/jwc-runtime/state-doctor.test.ts"],
	// NOTE: deep-interview-mutation-guard, gjc-skill-state-hooks, and skill-active-state
	// load the @gajae-code/natives addon transitively via the tool/hook runtime, so they
	// run in the heavier "Affected path validation" job rather than this native-free gate.
];

async function changedFiles(): Promise<string[]> {
	if (process.env.GITHUB_EVENT_NAME === "pull_request" && process.env.GITHUB_BASE_SHA) {
		await $`git fetch --no-tags --depth=1 origin ${process.env.GITHUB_BASE_SHA}`.cwd(repoRoot).nothrow();
		const result = await $`git diff --name-only ${process.env.GITHUB_BASE_SHA} HEAD`.cwd(repoRoot).quiet();
		return result.stdout.toString().split("\n").filter(Boolean);
	}

	if (process.env.GITHUB_EVENT_BEFORE && !/^0+$/.test(process.env.GITHUB_EVENT_BEFORE)) {
		await $`git fetch --no-tags --depth=1 origin ${process.env.GITHUB_EVENT_BEFORE}`.cwd(repoRoot).nothrow();
		const result = await $`git diff --name-only ${process.env.GITHUB_EVENT_BEFORE} HEAD`.cwd(repoRoot).quiet();
		return result.stdout.toString().split("\n").filter(Boolean);
	}

	console.log("jwc-state-gates: no comparable base SHA found; running bounded gates.");
	return ["packages/coding-agent/"];
}

function isRelevant(file: string): boolean {
	return relevantPathPrefixes.some(prefix => file === prefix || file.startsWith(prefix));
}

const files = await changedFiles();
const relevantFiles = files.filter(isRelevant);

if (relevantFiles.length === 0) {
	console.log("jwc-state-gates: no relevant paths changed; gate commands skipped.");
	console.log(`jwc-state-gates: inspected ${files.length} changed path(s).`);
	process.exit(0);
}

console.log("jwc-state-gates: relevant paths changed; running bounded gates.");
for (const file of relevantFiles) {
	console.log(`jwc-state-gates: relevant ${file}`);
}

for (const command of boundedGateCommands) {
	console.log(`jwc-state-gates: running ${command.join(" ")}`);
	await $`${command}`.cwd(repoRoot);
}

console.log("jwc-state-gates: bounded gates passed.");
