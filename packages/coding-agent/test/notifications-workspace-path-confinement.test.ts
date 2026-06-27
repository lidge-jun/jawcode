import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolveWorkspaceFileForNotification } from "../src/notifications";

async function withWorkspace<T>(fn: (workspace: string, outside: string) => Promise<T>): Promise<T> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-workspace-confine-"));
	const workspace = path.join(root, "workspace");
	const outside = path.join(root, "outside");
	await fs.mkdir(workspace);
	await fs.mkdir(outside);
	try {
		return await fn(workspace, outside);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

describe("notification workspace path confinement", () => {
	it("resolves relative and absolute regular files inside the workspace", async () => {
		await withWorkspace(async workspace => {
			const file = path.join(workspace, "report.txt");
			await fs.writeFile(file, "hello", "utf8");

			const relative = await resolveWorkspaceFileForNotification(workspace, "report.txt");
			const absolute = await resolveWorkspaceFileForNotification(workspace, file);

			expect(relative).toEqual({
				ok: true,
				workspaceRoot: await fs.realpath(workspace),
				realPath: await fs.realpath(file),
				relativePath: "report.txt",
				sizeBytes: 5,
			});
			expect(absolute).toEqual(relative);
			expect(JSON.stringify(relative)).not.toContain("hello");
			expect(JSON.stringify(relative)).not.toContain("bot-token");
			expect(JSON.stringify(relative)).not.toContain("123456789");
		});
	});

	it("rejects missing inputs, missing candidates, directories, and invalid workspaces", async () => {
		await withWorkspace(async (workspace, outside) => {
			const directory = path.join(workspace, "dir");
			await fs.mkdir(directory);
			const workspaceFile = path.join(outside, "not-workspace.txt");
			await fs.writeFile(workspaceFile, "x", "utf8");

			expect(await resolveWorkspaceFileForNotification(" ", "file.txt")).toEqual({
				ok: false,
				reason: "missing_path",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, " ")).toEqual({
				ok: false,
				reason: "missing_path",
			});
			expect(await resolveWorkspaceFileForNotification(path.join(outside, "missing"), "file.txt")).toEqual({
				ok: false,
				reason: "workspace_not_directory",
			});
			expect(await resolveWorkspaceFileForNotification(workspaceFile, "file.txt")).toEqual({
				ok: false,
				reason: "workspace_not_directory",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, "missing.txt")).toEqual({
				ok: false,
				reason: "file_not_found",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, "dir")).toEqual({
				ok: false,
				reason: "not_regular_file",
			});
		});
	});

	it("rejects relative, absolute, and symlink escapes while allowing internal symlinks", async () => {
		await withWorkspace(async (workspace, outside) => {
			const inside = path.join(workspace, "inside.txt");
			const outsideFile = path.join(outside, "secret.txt");
			await fs.writeFile(inside, "inside", "utf8");
			await fs.writeFile(outsideFile, "secret", "utf8");
			await fs.symlink(inside, path.join(workspace, "inside-link.txt"));
			await fs.symlink(outsideFile, path.join(workspace, "outside-link.txt"));

			expect(await resolveWorkspaceFileForNotification(workspace, "../outside/secret.txt")).toEqual({
				ok: false,
				reason: "outside_workspace",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, outsideFile)).toEqual({
				ok: false,
				reason: "outside_workspace",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, "outside-link.txt")).toEqual({
				ok: false,
				reason: "outside_workspace",
			});
			expect(await resolveWorkspaceFileForNotification(workspace, "inside-link.txt")).toMatchObject({
				ok: true,
				relativePath: "inside.txt",
				sizeBytes: 6,
			});
		});
	});

	it("rejects non-regular special files where the platform supports them", async () => {
		if (process.platform === "win32") return;
		await withWorkspace(async workspace => {
			const fifo = path.join(workspace, "pipe");
			const proc = Bun.spawn(["mkfifo", fifo], { stdout: "pipe", stderr: "pipe" });
			const exitCode = await proc.exited;
			if (exitCode !== 0) return;

			expect(await resolveWorkspaceFileForNotification(workspace, "pipe")).toEqual({
				ok: false,
				reason: "not_regular_file",
			});
		});
	});
});
