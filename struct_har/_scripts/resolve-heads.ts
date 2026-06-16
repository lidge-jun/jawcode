import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

export function resolveForkHead(): string {
	return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
}

export function resolveGjcHead(): string {
	const clone = path.join(ROOT, "devlog/_upstream_gjc");
	if (!fs.existsSync(path.join(clone, ".git"))) {
		return "75d103f45145";
	}
	return execSync("git rev-parse HEAD", { cwd: clone, encoding: "utf8" }).trim();
}

export function resolveOmpHead(): string {
	const clone = path.join(ROOT, "devlog/_upstream_omp");
	if (!fs.existsSync(path.join(clone, ".git"))) {
		return "db421bb2ef68";
	}
	return execSync("git rev-parse HEAD", { cwd: clone, encoding: "utf8" }).trim();
}