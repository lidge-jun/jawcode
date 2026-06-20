#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

type Finding = {
	line: number;
	path: string;
	token: string;
};

const repoRoot = process.cwd();
const cliJawRoot = process.env.CLI_JAW_REPO ?? path.resolve(repoRoot, "../cli-jaw");

const forbidden = [
	"jawcode",
	"Gajae-Code",
	"Gajae forge",
	"@jawcode",
	"gaebal-gajae",
	"lidge-jun/jawcode",
	"lidge-jun/jawcode",
	"lidge-jun/jawcode",
	"GJC_BRAND_NAME",
	"GJC_COORDINATOR",
	"GJC_HARNESS",
	"GJC_TEAM",
	"GJC_AUTH_BROKER",
	"GJC_CONFIG_DIR",
	"GJC_CODING_AGENT_DIR",
	"GJC_SESSION",
	"GJC_NATIVE",
	"gjc-plugins",
	"gjc-coordinator",
	"gjc-harness",
	"gjc-dogfood",
	"gjc-search-archive",
	"gjc-sshots",
	"gjc-task",
	"gjc-branch",
	"default-gjc-definitions",
	"gajae_code_harness",
] as const;

const jawcodeTextFiles = [
	"README.md",
	"README.jwc.md",
	"packages/jwc/bin/jwc.js",
	"packages/jwc/src/cli-entry.ts",
];

const jawcodeActiveDocs = new Set(["README.md", "README.jwc.md"]);
const docOnlyForbidden = ["gajae", "Gajae", "gjc", "GJC"] as const;

const cliJawTextFiles = [
	"src/agent/jwc-runtime.ts",
	"src/code-mode/acp-host.ts",
	"src/lib/tui/jawcode-tui-bundle.js",
	"src/lib/tui/jawcode-tui-bundle.mjs",
	"src/lib/tui/jawcode-interactive-bundle.mjs",
];

function scanFile(root: string, relativePath: string, prefix: string): Finding[] {
	const filePath = path.join(root, relativePath);
	if (!fs.existsSync(filePath)) return [];
	const content = fs.readFileSync(filePath, "utf8");
	const findings: Finding[] = [];
	for (const [index, line] of content.split(/\r?\n/).entries()) {
		for (const token of forbidden) {
			if (line.includes(token)) {
				findings.push({ line: index + 1, path: `${prefix}:${relativePath}`, token });
			}
		}
	}
	return findings;
}

function isTracked(root: string, relativePath: string): boolean {
	const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
		cwd: root,
		stdio: "ignore",
	});
	return result.status === 0;
}

function scanPublicFile(root: string, relativePath: string, prefix: string): Finding[] {
	if (prefix === "cli-jaw" && !isTracked(root, relativePath)) return [];
	const findings = scanFile(root, relativePath, prefix);
	if (prefix === "jawcode" && jawcodeActiveDocs.has(relativePath)) {
		const filePath = path.join(root, relativePath);
		const content = fs.readFileSync(filePath, "utf8");
		for (const [index, line] of content.split(/\r?\n/).entries()) {
			for (const token of docOnlyForbidden) {
				if (line.includes(token)) {
					findings.push({ line: index + 1, path: `${prefix}:${relativePath}`, token });
				}
			}
		}
	}
	return findings.filter(finding => {
		// Allow @jawcode imports in jwc package entrypoints
		if (
			prefix === "jawcode" &&
			(finding.path.endsWith("packages/jwc/bin/jwc.js") ||
				finding.path.endsWith("packages/jwc/src/cli-entry.ts")) &&
			(finding.token === "@jawcode" || finding.token === "jawcode")
		) {
			return false;
		}
		// Allow upstream attribution and technical references in active docs
		if (prefix === "jawcode" && jawcodeActiveDocs.has(relativePath)) {
			const filePath = path.join(root, relativePath);
			const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
			const line = lines[finding.line - 1] ?? "";
			if (
				line.includes("fork") ||
				line.includes("upstream") ||
				line.includes("Lineage") ||
				line.includes("namespace originates") ||
				line.includes("포크") ||
				line.includes("업스트림") ||
				line.includes("유래")
			) {
				return false;
			}
			// Allow jawcode/lidge-jun/jawcode in URLs, install commands, git ops,
			// asset paths, and backtick-quoted code references
			if (
				finding.token === "jawcode" ||
				finding.token === "lidge-jun/jawcode"
			) {
				if (
					line.includes("://") ||
					line.includes("shields.io") ||
					line.includes("install -g") ||
					line.includes("git clone") ||
					/^\s*cd\s+\S/.test(line) ||
					line.includes('src="') ||
					line.includes("-logo.") ||
					/`[^`]*jawcode[^`]*`/.test(line)
				) {
					return false;
				}
			}
		}
		return true;
	});
}

function scanJwcPackageMetadata(): Finding[] {
	const filePath = path.join(repoRoot, "packages/jwc/package.json");
	const json = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
	const publicFields = ["name", "description", "homepage", "repository", "bugs", "keywords"] as const;
	const findings: Finding[] = [];
	for (const field of publicFields) {
		// name is the current npm package identity — allowed until renamed
		if (field === "name") continue;
		const value = json[field];
		const text = value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
		for (const token of forbidden) {
			if (text.includes(token)) {
				findings.push({ line: 1, path: `jawcode:packages/jwc/package.json#${field}`, token });
			}
		}
	}
	return findings;
}

const findings = [
	...scanJwcPackageMetadata(),
	...jawcodeTextFiles.flatMap(file => scanPublicFile(repoRoot, file, "jawcode")),
	...cliJawTextFiles.flatMap(file => scanPublicFile(cliJawRoot, file, "cli-jaw")),
];

if (findings.length > 0) {
	console.error("Active public legacy identity findings:");
	console.error(JSON.stringify(findings.slice(0, 200), null, 2));
	if (findings.length > 200) console.error(`... ${findings.length - 200} more`);
	process.exit(1);
}

console.log("Active public legacy identity zero OK");
