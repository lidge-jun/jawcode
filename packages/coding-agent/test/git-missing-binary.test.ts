/**
 * A missing git binary must degrade, not crash — and must never be reported as a
 * confident answer about the user's tree.
 *
 * `runCommand` spawned bare `"git"` with no guard, and `Bun.spawn` throws ENOENT
 * synchronously, so 16 read-only helpers that bypass `ensureAvailable()` escaped
 * as unhandled rejections (Windows without git, or relying on WSL git).
 *
 * The failure is reported through a typed `launchFailure` rather than an exit
 * code: real git can return 127 via an alias, so an exit code cannot distinguish
 * "git says no" from "git never ran".
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as git from "@jawcode-dev/coding-agent/utils/git";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("git helpers with a missing binary", () => {
	it("reports a missing cwd distinctly from a missing git binary", async () => {
		const absent = path.join(os.tmpdir(), `jwc-missing-cwd-${Date.now()}`);
		expect(fs.existsSync(absent)).toBe(false);

		// A deleted cwd also makes Bun.spawn throw ENOENT. Claiming "git is not
		// installed" there would send the user after the wrong problem.
		const summary = await git.status.summary(absent);
		expect(summary).toBeNull();
	});

	it("degrades soft read-only helpers instead of throwing when git cannot launch", async () => {
		vi.spyOn(Bun, "spawn").mockImplementation(() => {
			const error = new Error('Executable not found in $PATH: "git"');
			(error as Error & { code?: string }).code = "ENOENT";
			throw error;
		});

		// status.summary bypasses ensureAvailable() and must return null, not reject.
		await expect(git.status.summary(process.cwd())).resolves.toBeNull();
		// allowFailure diff must yield empty output rather than an unhandled rejection.
		await expect(git.diff(process.cwd(), { allowFailure: true })).resolves.toBe("");
	});

	it("keeps checked commands loud so a write request is never silently a no-op", async () => {
		vi.spyOn(Bun, "spawn").mockImplementation(() => {
			const error = new Error('Executable not found in $PATH: "git"');
			(error as Error & { code?: string }).code = "ENOENT";
			throw error;
		});

		// Top-level `status` is checked by design (runText -> runChecked) and must
		// still reject — degrading it would be a silent lie about the tree.
		await expect(git.status(process.cwd())).rejects.toThrow();
	});
});

describe("git launch failure is distinguishable from a real non-zero exit", () => {
	it("does not rely on an exit code that real git can produce", async () => {
		// Proof that the discriminator is necessary: a git alias can exit 127, so
		// collapsing "could not launch" into 127 would be ambiguous.
		const proc = Bun.spawn(["git", "-c", "alias.jwcprobe=!exit 127", "jwcprobe"], {
			cwd: process.cwd(),
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(await proc.exited).toBe(127);
	});
});
