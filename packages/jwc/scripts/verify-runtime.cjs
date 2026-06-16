#!/usr/bin/env node
const { resolveBunRuntime } = require("./resolve-bun-runtime.cjs");

const asJson = process.argv.includes("--json");
const postinstall = process.argv.includes("--postinstall");
const safeMode = process.env.CI === "true" || process.env.JWC_SAFE === "1" || process.env.JWC_SKIP_BUN_INSTALL === "1";
const result = resolveBunRuntime();

if (asJson) {
	process.stdout.write(`${JSON.stringify({ ...result, safeMode, postinstall }, null, 2)}\n`);
	process.exit(result.ok || postinstall ? 0 : 1);
}

if (result.ok) {
	process.stdout.write(`Jawcode Bun runtime: ${result.version} (${result.source})\n`);
	process.exit(0);
}

if (postinstall) {
	const mode = safeMode ? "safe mode" : "postinstall";
	process.stdout.write(`Jawcode Bun runtime check skipped in ${mode}; launcher will verify Bun at runtime.\n`);
	process.exit(0);
}

process.stderr.write(`${result.message}\n`);
process.exit(1);
