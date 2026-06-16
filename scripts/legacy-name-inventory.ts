#!/usr/bin/env bun
import * as fs from "node:fs";
import * as path from "node:path";

type Bucket = "active-public" | "current-internal" | "compat-internal" | "history" | "reference";

type Hit = {
	bucket: Bucket;
	line: number;
	path: string;
	token: string;
};

const repoRoot = process.cwd();
const tokens = ["gajae", "Gajae", "gjc", "GJC"] as const;
const ignoredDirs = new Set([".git", "node_modules", "dist", "dist-node", "coverage", "build", ".jwc"]);
const ignoredExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".node", ".wasm", ".tgz"]);
const activePublicPaths = new Set([
	"README.md",
	"README.jwc.md",
	"AGENTS.md",
	"CONTRIBUTING.jwc.md",
	"packages/jwc/package.json",
	"packages/jwc/bin/jwc.js",
	"packages/jwc/src/cli-entry.ts",
]);

function relative(file: string): string {
	return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function walk(dir: string, files: string[] = []): string[] {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!ignoredDirs.has(entry.name)) walk(full, files);
		} else if (entry.isFile() && !ignoredExtensions.has(path.extname(entry.name).toLowerCase())) {
			files.push(full);
		}
	}
	return files;
}

function bucketFor(rel: string): Bucket {
	if (activePublicPaths.has(rel) || rel.startsWith("docs/")) return "active-public";
	if (
		rel.startsWith("devlog/_legacy/") ||
		rel.startsWith("devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/") ||
		rel.startsWith("devlog/_upstream_")
	) {
		return "history";
	}
	if (rel.startsWith("devlog/_reference/") || rel.startsWith("struct_har/")) return "reference";
	if (rel.startsWith("packages/") || rel.startsWith("python/") || rel.startsWith("crates/")) return "compat-internal";
	return "current-internal";
}

function scan(): Hit[] {
	const files = walk(repoRoot);
	const hits: Hit[] = [];
	for (const file of files) {
		const rel = relative(file);
		let content: string;
		try {
			content = fs.readFileSync(file, "utf8");
		} catch {
			continue;
		}
		for (const [index, line] of content.split(/\r?\n/).entries()) {
			for (const token of tokens) {
				if (line.includes(token)) {
					hits.push({ bucket: bucketFor(rel), line: index + 1, path: rel, token });
				}
			}
		}
	}
	return hits;
}

const hits = scan();
const byBucket = new Map<Bucket, Hit[]>();
for (const hit of hits) {
	const list = byBucket.get(hit.bucket) ?? [];
	list.push(hit);
	byBucket.set(hit.bucket, list);
}

const summary = Object.fromEntries(
	(["active-public", "current-internal", "compat-internal", "history", "reference"] as Bucket[]).map(bucket => [
		bucket,
		byBucket.get(bucket)?.length ?? 0,
	]),
);

const report = {
	summary,
	samples: Object.fromEntries(
		[...byBucket.entries()].map(([bucket, bucketHits]) => [
			bucket,
			bucketHits.slice(0, 30).map(hit => ({ path: hit.path, line: hit.line, token: hit.token })),
		]),
	),
	total: hits.length,
};

console.log(JSON.stringify(report, null, 2));
