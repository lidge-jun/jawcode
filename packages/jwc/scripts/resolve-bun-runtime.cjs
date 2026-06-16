const { existsSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { spawnSync } = require("node:child_process");

const MIN_BUN_VERSION = "1.3.14";

function resolveBunRuntime(options = {}) {
	const packageRoot = normalizePackageRoot(options.packageRoot);
	const candidateResolvers = [
		() => explicitBunCandidate(),
		() => packageLocalBunCandidate(packageRoot),
		() => systemBunCandidate(),
	];

	for (const resolveCandidate of candidateResolvers) {
		const candidate = resolveCandidate();
		if (!candidate) continue;
		const version = readBunVersion(candidate.path);
		if (!version) continue;
		if (!versionAtLeast(version, MIN_BUN_VERSION)) {
			continue;
		}
		return {
			ok: true,
			source: candidate.source,
			path: candidate.path,
			version,
			minVersion: MIN_BUN_VERSION,
		};
	}

	return {
		ok: false,
		minVersion: MIN_BUN_VERSION,
		message: [
			`Jawcode requires Bun ${MIN_BUN_VERSION} or newer to run the jwc CLI.`,
			"Install with `npm install -g jawcode` so the package-local bun dependency is available,",
			"or set JWC_BUN_PATH=/absolute/path/to/bun.",
		].join(" "),
	};
}

function normalizePackageRoot(packageRoot) {
	if (packageRoot instanceof URL) return fileURLToPath(packageRoot);
	if (typeof packageRoot === "string") return packageRoot;
	return path.resolve(__dirname, "..");
}

function explicitBunCandidate() {
	const bunPath = process.env.JWC_BUN_PATH;
	if (!bunPath) return undefined;
	return { source: "env:JWC_BUN_PATH", path: bunPath };
}

function packageLocalBunCandidate(packageRoot) {
	try {
		const requireFromPackage = createRequire(path.join(packageRoot, "package.json"));
		const bunPath = requireFromPackage.resolve("bun/bin/bun.exe");
		if (!existsSync(bunPath)) return undefined;
		return { source: "package:bun", path: bunPath };
	} catch {
		return undefined;
	}
}

function systemBunCandidate() {
	const result =
		process.platform === "win32"
			? spawnSync("where", ["bun"], { encoding: "utf8" })
			: spawnSync("sh", ["-lc", "command -v bun"], { encoding: "utf8" });
	const firstLine = result.stdout?.split(/\r?\n/).find(Boolean);
	if (!firstLine) return undefined;
	return { source: "system:PATH", path: firstLine.trim() };
}

function readBunVersion(bunPath) {
	const result = spawnSync(bunPath, ["--version"], { encoding: "utf8" });
	if (result.status !== 0) return undefined;
	const version = result.stdout.trim().split(/\s+/)[0];
	return /^\d+\.\d+\.\d+/.test(version) ? version : undefined;
}

function versionAtLeast(actual, minimum) {
	const left = parseVersion(actual);
	const right = parseVersion(minimum);
	for (let index = 0; index < 3; index++) {
		if (left[index] > right[index]) return true;
		if (left[index] < right[index]) return false;
	}
	return true;
}

function parseVersion(version) {
	return version.split(".").slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
}

module.exports = {
	MIN_BUN_VERSION,
	resolveBunRuntime,
	versionAtLeast,
};
