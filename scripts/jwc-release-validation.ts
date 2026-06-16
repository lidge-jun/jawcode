#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

type Step = {
	args: string[];
	cwd?: string;
	name: string;
};

const steps: Step[] = [
	{ name: "jwc bundle", args: ["bun", "--cwd=packages/jwc", "run", "bundle"] },
	{ name: "jwc node sdk bundle", args: ["bun", "--cwd=packages/jwc", "run", "build:node"] },
	{ name: "cli-jaw home bootstrap", args: ["bun", "test", "packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts"] },
	{ name: "pack manifest contract", args: ["bun", "test", "packages/coding-agent/test/jwc-package-manifest-contract.test.ts"] },
	{ name: "packed sdk smoke", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs"] },
	{ name: "postinstall mode matrix", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--postinstall-matrix"] },
	{ name: "registry-faithful install", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--registry-faithful"] },
	{ name: "native probes", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--native-probes"] },
	{ name: "release publish contract", args: ["bun", "test", "scripts/release-publish-order.test.ts"] },
	{
		name: "mac mcp/cua defaults",
		args: [
			"bun",
			"test",
			"packages/coding-agent/test/default-mcp-config.test.ts",
			"packages/coding-agent/test/agent-session-mcp-discovery.test.ts",
			"packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts",
			"packages/coding-agent/test/acp-builtins.test.ts",
		],
	},
	{ name: "github workflow guard", args: ["bun", "run", "check:no-github-workflows"] },
	{ name: "active public legacy zero", args: ["bun", "scripts/check-public-legacy-zero.ts"] },
	{ name: "legacy name inventory", args: ["bun", "run", "inventory:legacy-names"] },
];

for (const step of steps) {
	console.log(`\n[validate:jwc-release] ${step.name}`);
	const result = spawnSync(step.args[0]!, step.args.slice(1), {
		cwd: step.cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	if (result.status !== 0) {
		console.error(`[validate:jwc-release] failed: ${step.name}`);
		process.exit(result.status ?? 1);
	}
}

console.log("\n[validate:jwc-release] OK");
