import { promises as fs } from "node:fs";
import * as path from "node:path";
import { getAgentDir, pathIsWithin } from "@jawcode-dev/utils";
import { GJC_PLUGIN_MANIFEST_FILENAME, JwcPluginLoadError } from "./types";

export function jwcPluginUserRoot(): string {
	return path.join(getAgentDir(), "gjc-plugins");
}

export function jwcPluginProjectRoot(cwd: string): string {
	return path.join(cwd, ".jwc", "gjc-plugins");
}

function isEnoent(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export async function rootContainsJwcManifest(dir: string): Promise<boolean> {
	try {
		await fs.access(path.join(dir, GJC_PLUGIN_MANIFEST_FILENAME));
		return true;
	} catch (error) {
		if (isEnoent(error)) return false;
		throw error;
	}
}

async function discoverJwcPluginRootsIn(baseDir: string): Promise<string[]> {
	if (await rootContainsJwcManifest(baseDir)) return [baseDir];

	let entries: import("node:fs").Dirent[];
	try {
		entries = await fs.readdir(baseDir, { withFileTypes: true });
	} catch (error) {
		if (isEnoent(error)) return [];
		throw error;
	}

	const roots = await Promise.all(
		entries
			.filter(entry => entry.isDirectory() || entry.isSymbolicLink())
			.map(async entry => {
				const dir = path.join(baseDir, entry.name);
				return (await rootContainsJwcManifest(dir)) ? dir : null;
			}),
	);

	return roots.filter((root): root is string => root !== null);
}

export async function discoverJwcPluginRoots({ cwd }: { cwd: string; home?: string }): Promise<string[]> {
	const roots = await Promise.all([
		discoverJwcPluginRootsIn(jwcPluginUserRoot()),
		discoverJwcPluginRootsIn(jwcPluginProjectRoot(cwd)),
	]);
	return roots.flat();
}

export function resolveWithinRoot(root: string, rel: string): string {
	const resolvedRoot = path.resolve(root);
	const resolvedPath = path.resolve(resolvedRoot, rel);
	if (!pathIsWithin(resolvedRoot, resolvedPath)) {
		throw new JwcPluginLoadError("missing_file", `GJC plugin path escapes root: ${rel}`);
	}
	return resolvedPath;
}
