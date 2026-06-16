/**
 * One-time `.gjc` → `.jwc` state-dir migration (Phase β, 061.1 M4 / D-1a·b).
 *
 * Renames the legacy user root (`~/.gjc`) and the project-local state dir
 * (`<cwd>/.gjc`) to their `.jwc` successors on startup. Rename is atomic on
 * POSIX, so live session/state content moves without modification; a sentinel
 * is left behind so older binaries racing on the legacy dir get a hint.
 *
 * This module intentionally keeps the legacy ".gjc" literal — it is excluded
 * from the beta sweep script.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const LEGACY_DIR_NAME = ".gjc";
const SENTINEL = ".jwc-migrated";

function migrateOne(parent: string, targetDirName: string): "migrated" | "skipped" | "failed" {
	const legacy = path.join(parent, LEGACY_DIR_NAME);
	const target = path.join(parent, targetDirName);
	try {
		if (fs.existsSync(target)) return "skipped";
		if (!fs.existsSync(legacy)) return "skipped";
		if (fs.existsSync(path.join(legacy, SENTINEL))) return "skipped";
		try {
			fs.renameSync(legacy, target);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== "EXDEV") throw error;
			fs.cpSync(legacy, target, { recursive: true });
			fs.rmSync(legacy, { recursive: true, force: true });
		}
		// Leave a sentinel where the legacy dir used to be so a stale binary
		// that recreates `.gjc` is detectable and re-migration stays cheap.
		fs.mkdirSync(legacy, { recursive: true });
		fs.writeFileSync(path.join(legacy, SENTINEL), `moved to ${targetDirName} on ${new Date().toISOString()}\n`);
		return "migrated";
	} catch {
		return "failed";
	}
}

/**
 * Run the user-level and project-level migrations. Idempotent and best-effort:
 * failures never block startup (the runtime then simply starts fresh in .jwc).
 */
export function migrateConfigDirOnce(input: { cwd: string; targetDirName: string; home?: string }): {
	user: string;
	project: string;
} {
	const home = input.home ?? os.homedir();
	const user = migrateOne(home, input.targetDirName);
	const project =
		path.resolve(input.cwd) === path.resolve(home) ? "skipped" : migrateOne(input.cwd, input.targetDirName);
	return { user, project };
}

const SESSION_FILE_ENV_KEYS = ["GJC_SESSION_FILE", "JWC_SESSION_FILE"] as const;

/**
 * Repoint session-file env vars that still reference the legacy `~/.gjc` tree
 * (061.1 §4-2: in-flight processes hand absolute paths to subprocesses). Only
 * remaps when the file actually exists at the migrated location.
 */
export function remapLegacySessionFileEnv(input: {
	targetDirName: string;
	home?: string;
	env?: NodeJS.ProcessEnv;
}): void {
	const home = input.home ?? os.homedir();
	const env = input.env ?? process.env;
	const legacyRoot = path.join(home, LEGACY_DIR_NAME) + path.sep;
	for (const key of SESSION_FILE_ENV_KEYS) {
		const value = env[key];
		if (!value?.startsWith(legacyRoot)) continue;
		const candidate = path.join(home, input.targetDirName, value.slice(legacyRoot.length));
		if (fs.existsSync(candidate)) env[key] = candidate;
	}
}
