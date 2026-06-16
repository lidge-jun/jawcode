/**
 * Phase β sweep (069.1 P9~P11): flip runtime-facing `.gjc` path literals to
 * `.jwc`. Boundary-safe: never rewrites identifiers like `plan.gjcObjective`
 * (`.gjc` must NOT be followed by [A-Za-z0-9_]). Idempotent.
 * Exclusions: devlog/, structure/, struct_har/, migrate-config-dir.*, this script.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["packages", "docs", "scripts"];
const ROOT_FILES = ["biome.json", ".gitignore", "README.md", "README.jwc.md", "AGENTS.md"];
const EXTS = new Set([".ts", ".js", ".json", ".md", ".sh", ".toml", ".yml", ".yaml", ".py", ".ps1"]);
const EXCLUDE_PARTS = ["node_modules", ".git/", "struct_har", "devlog", "structure/", "migrate-config-dir", "beta-jwc-sweep"];
const PATTERN = /\.gjc(?![A-Za-z0-9_])/g;

let changed = 0;
let hits = 0;

function sweepFile(p: string): void {
	const before = readFileSync(p, "utf8");
	const matches = before.match(PATTERN);
	if (!matches) return;
	writeFileSync(p, before.replace(PATTERN, ".jwc"));
	changed += 1;
	hits += matches.length;
	console.log(`${matches.length}\t${path.relative(ROOT, p)}`);
}

function walk(dir: string): void {
	for (const entry of readdirSync(dir)) {
		const p = path.join(dir, entry);
		const rel = path.relative(ROOT, p);
		if (EXCLUDE_PARTS.some(part => rel.includes(part))) continue;
		const st = statSync(p);
		if (st.isDirectory()) walk(p);
		else if (EXTS.has(path.extname(p))) sweepFile(p);
	}
}

for (const dir of TARGET_DIRS) walk(path.join(ROOT, dir));
for (const f of ROOT_FILES) {
	try {
		sweepFile(path.join(ROOT, f));
	} catch {}
}

// ── Post-sweep fixups (worktree-validated 260612): the dot-boundary pattern
// still catches property accesses like `pkg.gjc ?? x` / `raw.gjc` — restore
// the legacy identifiers and upgrade manifest keys to the jwc→gjc→pi chain.
const POST_FIXES: ReadonlyArray<[string, string, string]> = [
	["packages/coding-agent/src/jwc-runtime/jaw-interview-runtime.ts", "?? root?.jwc?.deepInterview?.ambiguityThreshold", "?? root?.gjc?.deepInterview?.ambiguityThreshold"],
	["packages/coding-agent/src/config/settings.ts", "const legacyJwc = raw.jwc as Record<string, unknown> | undefined;", "const legacyJwc = raw.gjc as Record<string, unknown> | undefined;"],
	["packages/coding-agent/src/config/settings.ts", "if (legacyJwc && Object.keys(legacyJwc).length === 0) delete raw.jwc;", "if (legacyJwc && Object.keys(legacyJwc).length === 0) delete raw.gjc;"],
	["packages/coding-agent/src/discovery/helpers.ts", "const manifest = pkg?.jwc ?? pkg?.pi;", "const manifest = pkg?.jwc ?? pkg?.gjc ?? pkg?.pi;"],
	["packages/coding-agent/src/extensibility/extensions/loader.ts", "const manifest = pkg.jwc ?? pkg.pi;", "const manifest = pkg.jwc ?? pkg.gjc ?? pkg.pi;"],
	["packages/coding-agent/src/extensibility/plugins/installer.ts", "manifest: pkg.jwc || pkg.pi || { version: pkg.version },", "manifest: pkg.jwc || pkg.gjc || pkg.pi || { version: pkg.version },"],
	["packages/coding-agent/src/extensibility/plugins/loader.ts", "const manifest: PluginManifest | undefined = pluginPkg.jwc || pluginPkg.pi;", "const manifest: PluginManifest | undefined = pluginPkg.jwc || pluginPkg.gjc || pluginPkg.pi;"],
	["packages/coding-agent/src/extensibility/plugins/manager.ts", "const manifest: PluginManifest = pkg.jwc || pkg.pi || { version: pkg.version };", "const manifest: PluginManifest = pkg.jwc || pkg.gjc || pkg.pi || { version: pkg.version };"],
	// Round-2 fixups (main-repo run 260612): sites added after the worktree pre-validation.
	["packages/coding-agent/src/extensibility/plugins/installer.ts", "manifest: pkg.jwc || pkg.pi || { version: pkg.version },", "manifest: pkg.jwc || pkg.gjc || pkg.pi || { version: pkg.version },"],
	["packages/coding-agent/src/extensibility/plugins/manager.ts", "const manifest: PluginManifest = pluginPkg.jwc || pluginPkg.pi || { version: pluginPkg.version };", "const manifest: PluginManifest = pluginPkg.jwc || pluginPkg.gjc || pluginPkg.pi || { version: pluginPkg.version };"],
	["packages/coding-agent/src/extensibility/plugins/manager.ts", "const hasManifest = !!(pluginPkg.jwc || pluginPkg.pi);", "const hasManifest = !!(pluginPkg.jwc || pluginPkg.gjc || pluginPkg.pi);"],
	["packages/coding-agent/src/extensibility/plugins/manager.ts", "const manifest: PluginManifest | undefined = pluginPkg.jwc || pluginPkg.pi;", "const manifest: PluginManifest | undefined = pluginPkg.jwc || pluginPkg.gjc || pluginPkg.pi;"],
	["scripts/verify-g002-gates.ts", 'const hasJwcBin = typeof bin.jwc === "string";', 'const hasJwcBin = typeof (bin.jwc ?? bin.gjc) === "string"; // transition: bin key renames with 065.1'],
];
for (const [rel, from, to] of POST_FIXES) {
	const p = path.join(ROOT, rel);
	const content = readFileSync(p, "utf8");
	if (content.includes(from)) {
		writeFileSync(p, content.replace(from, to));
		console.log(`fixup\t${rel}`);
	}
}

console.log(`\nswept ${hits} occurrences across ${changed} files`);
