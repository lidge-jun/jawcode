/**
 * Autoresearch must not mistake "git could not tell us" for "the tree is clean".
 *
 * These sets decide which paths count as an iteration's changes and what a
 * discard reverts, so an empty status from an unreadable repository can drop a
 * pre-run baseline or report "nothing to revert" over real work.
 *
 * The distinction is narrow on purpose: a directory that is genuinely not a
 * repository still returns a clean empty status, because that is a true answer.
 */
import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { tryGitStatusResult } from "../src/autoresearch/helpers";

const created: string[] = [];

afterEach(() => {
	for (const dir of created.splice(0)) {
		fs.rmSync(dir, { force: true, recursive: true });
	}
});

function makeTempDir(prefix: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	created.push(dir);
	return dir;
}

describe("autoresearch git status availability", () => {
	it("reports unavailable when the repository exists but cannot be read", async () => {
		const dir = makeTempDir("jwc-corrupt-repo-");
		Bun.spawnSync(["git", "init", "-q", "."], { cwd: dir });
		fs.writeFileSync(path.join(dir, "a.txt"), "hi\n");
		Bun.spawnSync(["git", "add", "a.txt"], { cwd: dir });
		// Corrupt the index: git launches and runs, but the state is unreadable.
		fs.writeFileSync(path.join(dir, ".git", "index"), "x");

		const result = await tryGitStatusResult(dir);
		expect(result.status).toBe("");
		expect(result.unavailable).toBeDefined();
	});

	it("treats a non-repository directory as a genuinely empty status", async () => {
		const dir = makeTempDir("jwc-non-repo-");
		const result = await tryGitStatusResult(dir);
		expect(result.status).toBe("");
		expect(result.unavailable).toBeUndefined();
	});

	it("reports unavailable when repository metadata is malformed", async () => {
		// git emits the SAME "not a git repository" text here as for a genuine
		// non-repo, so classifying on that message would call a broken repository
		// clean. Resolving the root instead separates them.
		const dir = makeTempDir("jwc-nohead-repo-");
		Bun.spawnSync(["git", "init", "-q", "."], { cwd: dir });
		fs.rmSync(path.join(dir, ".git", "HEAD"));

		const result = await tryGitStatusResult(dir);
		expect(result.status).toBe("");
		expect(result.unavailable).toBeDefined();
	});

	it("reports unavailable for a directory that only looks like a repository", async () => {
		const dir = makeTempDir("jwc-fake-git-");
		fs.mkdirSync(path.join(dir, ".git"));

		const result = await tryGitStatusResult(dir);
		expect(result.status).toBe("");
		expect(result.unavailable).toBeDefined();
	});
});
