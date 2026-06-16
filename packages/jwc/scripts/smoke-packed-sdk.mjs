#!/usr/bin/env node
/**
 * Package-specifier SDK and install-contract smoke.
 *
 * Verifies the consumer contract after publication: packed `jawcode`, `jwc` bin,
 * package-local Bun resolution, `jawcode/sdk`, and first-install cli-jaw home
 * bootstrap. By default this co-installs a freshly packed local natives tarball
 * for same-batch release validation; `--registry-faithful` installs only the
 * jawcode tarball and lets npm resolve registry dependencies.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const nativesRoot = path.join(repoRoot, "packages", "natives");
const distNodeSdk = path.join(packageRoot, "dist-node", "sdk.js");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const registryFaithful = process.argv.includes("--registry-faithful");
const postinstallMatrixOnly = process.argv.includes("--postinstall-matrix");
const nativeProbesOnly = process.argv.includes("--native-probes");
assert.ok(existsSync(distNodeSdk), "missing dist-node/sdk.js; run `bun run build:node` first");

const tempRoot = mkdtempSync(path.join(tmpdir(), "jawcode-packed-sdk-"));
const nodeModules = path.join(tempRoot, "node_modules");
const cliJawHome = path.join(tempRoot, "cli-jaw-home");
const skillsFixture = path.join(tempRoot, "skills-fixture");
let jawcodeTarballPath;
let nativesTarballPath;

function run(command, args, options = {}, silent = false) {
	const result = spawnSync(command, args, {
		cwd: packageRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	});
	if (result.status !== 0) {
		const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
		throw new Error(`${command} ${args.join(" ")} failed${output ? `\n${output}` : ""}`);
	}
	const stdout = (result.stdout ?? "").trim();
	if (!silent && stdout) console.log(stdout);
	return stdout;
}

function scrubbedPathEnv(extra = {}) {
	return {
		...process.env,
		CI: "",
		JWC_SAFE: "",
		JWC_SKIP_CLI_JAW_BOOTSTRAP: "",
		...extra,
		PATH: process.env.PATH ?? "",
		JWC_BUN_PATH: "",
	};
}

function resolveNodeExecutable() {
	const nvmNode = process.env.NVM_BIN ? path.join(process.env.NVM_BIN, "node") : "";
	if (nvmNode && existsSync(nvmNode)) return nvmNode;
	const result = spawnSync("node", ["-p", "process.execPath"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
		env: process.env,
	});
	const candidate = result.status === 0 ? result.stdout.trim() : "";
	if (candidate && !candidate.includes(`${path.sep}.bun${path.sep}bin${path.sep}bun`)) return candidate;
	return process.execPath;
}

function writeSkillFixture(root) {
	const skillDir = path.join(root, "github");
	mkdirSync(path.join(skillDir, "node_modules", "left-pad"), { recursive: true });
	writeFileSync(
		path.join(root, "registry.json"),
		`${JSON.stringify({ skills: { github: { version: "1.0.0", category: "orchestration" } } }, null, "\t")}\n`,
	);
	writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: github\ndescription: GitHub skill\n---\n\n# GitHub\n");
	writeFileSync(path.join(skillDir, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
}

function packAt(cwd) {
	const tarballName = run("npm", ["pack", "--silent"], { cwd }, true).split(/\r?\n/u).filter(Boolean).at(-1);
	assert.ok(tarballName, `npm pack did not return a tarball name for ${cwd}`);
	const tarballPath = path.join(cwd, tarballName);
	assert.ok(existsSync(tarballPath), `missing packed tarball: ${tarballPath}`);
	return tarballPath;
}

function installPacked() {
	writeSkillFixture(skillsFixture);
	writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module" }, null, "\t")}\n`);
	const installArgs = ["install", jawcodeTarballPath, "--ignore-scripts=false"];
	if (!registryFaithful) installArgs.splice(2, 0, nativesTarballPath);
	run("npm", installArgs, {
		cwd: tempRoot,
		env: {
			...process.env,
			CI: "",
			JWC_SAFE: "",
			JWC_SKIP_CLI_JAW_BOOTSTRAP: "",
			CLI_JAW_HOME: cliJawHome,
			JWC_CLI_JAW_SKILLS_SOURCE_DIR: skillsFixture,
		},
	});
}

function assertBootstrapOutputs() {
	const settings = JSON.parse(readFileSync(path.join(cliJawHome, "settings.json"), "utf8"));
	assert.equal(settings.cli, "codex");
	assert.equal(settings.workingDir, cliJawHome);
	assert.equal(settings.jawCeo.openaiApiKey, "");
	assert.deepEqual(JSON.parse(readFileSync(path.join(cliJawHome, "heartbeat.json"), "utf8")), { jobs: [] });
	assert.deepEqual(JSON.parse(readFileSync(path.join(cliJawHome, "mcp.json"), "utf8")), { servers: {} });
	assert.ok(existsSync(path.join(cliJawHome, "skills_ref", "registry.json")));
	assert.ok(existsSync(path.join(cliJawHome, "skills", "github", "SKILL.md")));
	assert.equal(existsSync(path.join(cliJawHome, "skills_ref", "github", "node_modules")), false);
	assert.equal(existsSync(path.join(cliJawHome, "skills", "github", "node_modules")), false);
}

function assertRuntimeSource() {
	const verifyScript = path.join(nodeModules, "jawcode", "scripts", "verify-runtime.cjs");
	const output = run(process.execPath, [verifyScript, "--json"], {
		cwd: tempRoot,
		env: scrubbedPathEnv({ CLI_JAW_HOME: cliJawHome }),
	}, true);
	const parsed = JSON.parse(output);
	assert.equal(parsed.ok, true);
	assert.equal(parsed.source, "package:bun");
}

async function assertSdkImport() {
	const importer = path.join(tempRoot, "importer.mjs");
	writeFileSync(
		importer,
		[
			'import assert from "node:assert/strict";',
			'const sdk = await import("jawcode/sdk");',
			'assert.equal(typeof sdk.createAgentSession, "function");',
			'console.log(`[smoke 120] jawcode/sdk import OK — ${Object.keys(sdk).length} exports`);',
		].join("\n"),
	);
	await import(pathToFileURL(importer).href);
}

function runPostinstallMatrix() {
	const script = path.join(nodeModules, "jawcode", "scripts", "bootstrap-cli-jaw-home.cjs");
	for (const [label, env, expected] of [
		["safe", { JWC_SAFE: "1" }, "safe-skipped"],
		["ci", { CI: "true" }, "safe-skipped"],
		["skip", { JWC_SKIP_CLI_JAW_BOOTSTRAP: "1" }, "skipped"],
	]) {
		const matrixHome = path.join(tempRoot, `matrix-${label}`);
		const output = run(process.execPath, [script, "--postinstall", "--json"], {
			cwd: tempRoot,
			env: { ...process.env, CI: "", JWC_SAFE: "", JWC_SKIP_CLI_JAW_BOOTSTRAP: "", ...env, CLI_JAW_HOME: matrixHome },
		}, true);
		const parsed = JSON.parse(output);
		assert.equal(parsed.skills.status, expected);
		assert.ok(existsSync(matrixHome));
		if (label === "skip") assert.equal(existsSync(path.join(matrixHome, "settings.json")), false);
		else assert.ok(existsSync(path.join(matrixHome, "settings.json")));
	}
}

async function runNativeProbes() {
	if (process.platform !== "darwin" || process.arch !== "arm64") {
		console.log("[native probes] skipped: macOS arm64 only");
		return;
	}
	const probe = path.join(tempRoot, "native-probes.mjs");
	writeFileSync(
		probe,
		[
			'import assert from "node:assert/strict";',
			'const natives = await import("@jawcode-dev/natives");',
			'assert.equal(typeof natives, "object");',
			'const Database = (await import("better-sqlite3")).default;',
			'const db = new Database(":memory:");',
			'try { assert.equal(db.prepare("select 1 as value").get().value, 1); } finally { db.close(); }',
			'for (const name of ["markit-ai", "@silvia-odwyer/photon-node"]) {',
			'  try { await import(name); console.log(`[native probes] report-only import OK: ${name}`); }',
			'  catch (error) { console.log(`[native probes] report-only import skipped: ${name}: ${error instanceof Error ? error.message : error}`); }',
			'}',
		].join("\n"),
	);
	run(resolveNodeExecutable(), [probe], { cwd: tempRoot });
}

try {
	jawcodeTarballPath = packAt(packageRoot);
	if (!registryFaithful) nativesTarballPath = packAt(nativesRoot);
	installPacked();
	if (!nativeProbesOnly) {
		assertRuntimeSource();
		const versionOutput = run(path.join(nodeModules, ".bin", "jwc"), ["--version"], {
			cwd: tempRoot,
			env: scrubbedPathEnv({ CLI_JAW_HOME: cliJawHome }),
		});
		assert.equal(versionOutput, `jwc/${packageJson.version}`);
		const helpOutput = run(path.join(nodeModules, ".bin", "jwc"), ["--help"], {
			cwd: tempRoot,
			env: scrubbedPathEnv({ CLI_JAW_HOME: cliJawHome }),
		}, true);
		assert.match(helpOutput, /jwc|Usage|usage/u);
		run(path.join(nodeModules, ".bin", "jwc"), ["--smoke-test"], {
			cwd: tempRoot,
			env: scrubbedPathEnv({ CLI_JAW_HOME: cliJawHome }),
		});
		assertBootstrapOutputs();
		if (!registryFaithful) await assertSdkImport();
	}
	if (postinstallMatrixOnly || !nativeProbesOnly) runPostinstallMatrix();
	if (nativeProbesOnly || process.argv.includes("--native-probes")) await runNativeProbes();
} finally {
	if (jawcodeTarballPath && existsSync(jawcodeTarballPath)) unlinkSync(jawcodeTarballPath);
	if (nativesTarballPath && existsSync(nativesTarballPath)) unlinkSync(nativesTarballPath);
	rmSync(tempRoot, { recursive: true, force: true });
}
