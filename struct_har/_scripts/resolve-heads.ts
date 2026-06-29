import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const GJC_HEAD_FALLBACK = "75d103f45145";
const OMP_HEAD_FALLBACK = "db421bb2ef68";

function firstExistingGitClone(candidates: string[]): string | undefined {
	return candidates.find((clone) => fs.existsSync(path.join(clone, ".git")));
}

export function resolveForkHead(): string {
	return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
}

export function resolveGjcClonePath(): string {
	return (
		firstExistingGitClone([
			path.join(ROOT, "devlog/_gjc_chase/gajae-code"),
			path.join(ROOT, "devlog/_upstream_gjc"),
		]) ?? path.join(ROOT, "devlog/_upstream_gjc")
	);
}

export function resolveGjcHead(): string {
	const clone = resolveGjcClonePath();
	if (!fs.existsSync(path.join(clone, ".git"))) {
		return GJC_HEAD_FALLBACK;
	}
	return execSync("git rev-parse HEAD", { cwd: clone, encoding: "utf8" }).trim();
}

export function resolveOmpClonePath(): string {
	return (
		firstExistingGitClone([
			path.join(ROOT, "devlog/_omp_chase/oh-my-pi"),
			path.join(ROOT, "devlog/_upstream_omp"),
		]) ?? path.join(ROOT, "devlog/_upstream_omp")
	);
}

export function resolveOmpHead(): string {
	const clone = resolveOmpClonePath();
	if (!fs.existsSync(path.join(clone, ".git"))) {
		return OMP_HEAD_FALLBACK;
	}
	return execSync("git rev-parse HEAD", { cwd: clone, encoding: "utf8" }).trim();
}
