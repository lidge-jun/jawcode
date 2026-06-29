import * as fs from "node:fs/promises";
import * as path from "node:path";

export type WorkspaceFileRejectionReason =
	| "missing_path"
	| "workspace_not_directory"
	| "file_not_found"
	| "outside_workspace"
	| "not_regular_file";

export type WorkspaceFileConfinementDecision =
	| {
			ok: true;
			workspaceRoot: string;
			realPath: string;
			relativePath: string;
			sizeBytes: number;
	  }
	| { ok: false; reason: WorkspaceFileRejectionReason };

function isInsideWorkspace(realWorkspaceRoot: string, realPath: string): boolean {
	const relativePath = path.relative(realWorkspaceRoot, realPath);
	return relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function realpathOrNull(targetPath: string): Promise<string | null> {
	try {
		return await fs.realpath(targetPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export async function resolveWorkspaceFileForNotification(
	workspaceRoot: string,
	candidatePath: string,
): Promise<WorkspaceFileConfinementDecision> {
	const trimmedWorkspaceRoot = workspaceRoot.trim();
	const trimmedCandidatePath = candidatePath.trim();
	if (!trimmedWorkspaceRoot || !trimmedCandidatePath) return { ok: false, reason: "missing_path" };

	const realWorkspaceRoot = await realpathOrNull(trimmedWorkspaceRoot);
	if (!realWorkspaceRoot) return { ok: false, reason: "workspace_not_directory" };
	const workspaceStat = await fs.stat(realWorkspaceRoot);
	if (!workspaceStat.isDirectory()) return { ok: false, reason: "workspace_not_directory" };

	const candidate = path.isAbsolute(trimmedCandidatePath)
		? trimmedCandidatePath
		: path.resolve(realWorkspaceRoot, trimmedCandidatePath);
	const realPath = await realpathOrNull(candidate);
	if (!realPath) return { ok: false, reason: "file_not_found" };
	if (!isInsideWorkspace(realWorkspaceRoot, realPath)) return { ok: false, reason: "outside_workspace" };

	const fileStat = await fs.stat(realPath);
	if (!fileStat.isFile()) return { ok: false, reason: "not_regular_file" };

	return {
		ok: true,
		workspaceRoot: realWorkspaceRoot,
		realPath,
		relativePath: path.relative(realWorkspaceRoot, realPath),
		sizeBytes: fileStat.size,
	};
}
