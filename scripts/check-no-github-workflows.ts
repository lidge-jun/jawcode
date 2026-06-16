#!/usr/bin/env bun
// Runner-policy guard: GitHub-hosted runners only, no self-hosted.
import * as fs from "node:fs";
import * as path from "node:path";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");

if (!fs.existsSync(workflowsDir)) {
	console.log("GitHub workflow guard OK: .github/workflows is absent");
	process.exit(0);
}

const entries = fs.readdirSync(workflowsDir, { withFileTypes: true }).filter(entry => entry.isFile());
if (entries.length === 0) {
	console.log("GitHub workflow guard OK: .github/workflows has no workflow files");
	process.exit(0);
}

const violations: string[] = [];
for (const entry of entries) {
	const filePath = path.join(workflowsDir, entry.name);
	const content = fs.readFileSync(filePath, "utf8");
	const lines = content.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (/runs-on\s*:/.test(line) && /self-hosted/i.test(line)) {
			violations.push(`${path.join(".github", "workflows", entry.name)}:${i + 1}: ${line.trim()}`);
		}
	}
}

if (violations.length > 0) {
	console.error("GitHub workflow guard failed: self-hosted runners are not allowed");
	for (const v of violations) console.error(`  ${v}`);
	process.exit(1);
}

console.log(`GitHub workflow guard OK: ${entries.length} workflow(s), all GitHub-hosted`);
process.exit(0);
