#!/usr/bin/env node
// jwc — Jawcode CLI entry. Node starts the npm bin, resolves a managed Bun
// runtime, then re-execs this file under Bun. Once running under Bun, workspace
// checkouts run live engine sources; published installs run the prebuilt bundle.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");

process.env.JWC_BRAND_NAME = "jwc";
process.env.JWC_PACKAGE_VERSION = packageJson.version;

if (!globalThis.Bun) {
	const { resolveBunRuntime } = require("../scripts/resolve-bun-runtime.cjs");
	const runtime = resolveBunRuntime({ packageRoot: new URL("..", import.meta.url) });
	if (!runtime.ok) {
		console.error(runtime.message);
		process.exit(1);
	}

	const child = spawnSync(runtime.path, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
		stdio: "inherit",
		env: {
			...process.env,
			JWC_BUN_RUNTIME_SOURCE: runtime.source,
		},
	});
	if (child.error) {
		console.error(`Failed to launch Bun runtime at ${runtime.path}: ${child.error.message}`);
		process.exit(1);
	}
	if (child.signal) {
		process.kill(process.pid, child.signal);
	}
	process.exit(child.status ?? 1);
}

const workspaceCli = new URL("../../coding-agent/src/cli.ts", import.meta.url);
if (existsSync(workspaceCli)) {
	// Internal workspace import: public package/bin/docs remain Jawcode/JWC.
	await import("@jawcode-dev/coding-agent/cli");
} else {
	await import("../dist/jwc.bundle.js");
}
