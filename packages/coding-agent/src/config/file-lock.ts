import type { Stats } from "node:fs";
import * as fs from "node:fs/promises";
import { isEnoent } from "@jawcode-dev/utils";

export interface FileLockOptions {
	staleMs?: number;
	retries?: number;
	retryDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<FileLockOptions> = {
	staleMs: 10_000,
	retries: 50,
	retryDelayMs: 100,
};

interface LockInfo {
	pid: number;
	timestamp: number;
}

function getLockPath(filePath: string): string {
	return `${filePath}.lock`;
}

async function writeLockInfo(lockPath: string): Promise<LockInfo> {
	const info: LockInfo = { pid: process.pid, timestamp: Date.now() };
	await Bun.write(`${lockPath}/info`, JSON.stringify(info));
	return info;
}

async function readLockInfo(lockPath: string): Promise<LockInfo | null> {
	try {
		const content = await fs.readFile(`${lockPath}/info`, "utf-8");
		return JSON.parse(content) as LockInfo;
	} catch {
		return null;
	}
}

export interface LockDirStatToken {
	dev: number;
	ino: number;
	mtimeMs: number;
	ctimeMs: number;
}

function statToken(stats: Stats): LockDirStatToken {
	return {
		dev: stats.dev,
		ino: stats.ino,
		mtimeMs: stats.mtimeMs,
		ctimeMs: stats.ctimeMs,
	};
}

function sameStatToken(a: LockDirStatToken, b: LockDirStatToken): boolean {
	return a.dev === b.dev && a.ino === b.ino && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

async function readLockDirStat(lockDir: string): Promise<LockDirStatToken | null> {
	try {
		return statToken(await fs.stat(lockDir));
	} catch (error) {
		if (isEnoent(error)) return null;
		throw error;
	}
}

async function readFileLockOwnerToken(lockDir: string): Promise<FileLockOwnerToken | null> {
	const stat = await readLockDirStat(lockDir);
	if (!stat) return null;
	const info = await readLockInfo(lockDir);
	if (!info) return null;
	if (!Number.isFinite(info.pid) || info.pid <= 0) return null;
	if (!Number.isFinite(info.timestamp)) return null;
	const statAfterInfoRead = await readLockDirStat(lockDir);
	if (!statAfterInfoRead || !sameStatToken(stat, statAfterInfoRead)) return null;
	return { ...info, stat };
}

/** Owner identity stamped into a `<file>.lock/info` record. */
export interface FileLockOwnerToken {
	pid: number;
	timestamp: number;
	stat: LockDirStatToken;
}

/** @internal GC: validated owner token read for a `<file>.lock/info` record. */
export async function readFileLockInfoForGc(lockDir: string): Promise<FileLockOwnerToken | null> {
	return readFileLockOwnerToken(lockDir);
}

/** Outcome of a guarded lock-dir removal attempt (`removeFileLockDirForGc`). */
export type FileLockGcRemoval = "removed" | "owner_changed" | "missing";

type LockStaleSnapshot =
	| { stale: false }
	| { stale: true; owner: FileLockOwnerToken }
	| { stale: true; owner: null; stat: LockDirStatToken };

/**
 * @internal
 * Fail-closed removal of a lock dir whose owner is expected to be dead or
 * finished. Re-reads the on-disk owner token as close to the unlink as possible
 * and only deletes the dir when it STILL holds the exact `{pid, timestamp}` and
 * stat identity the caller observed.
 *
 * Closes stale-cleanup TOCTOU windows (GJC #606): between a dead/stale re-read and
 * the unlink, a live process can reclaim a stale lock at the same path
 * (`acquireLock` rms the stale dir, then re-`mkdir`s and rewrites `info` with a
 * fresh pid+timestamp). Deleting by path alone would reap that LIVE lock. Any
 * mismatch (`owner_changed`) or absent/unreadable info (`missing` — e.g. a
 * fresh acquirer between `mkdir` and `writeLockInfo`) refuses the delete and
 * leaves the dir intact. POSIX has no atomic compare-and-delete for a
 * directory, so the residual read->unlink window cannot be fully eliminated,
 * but the reclaim-after-stale scenario is now guarded.
 */
export async function removeFileLockDirForGc(
	lockDir: string,
	expected: FileLockOwnerToken,
): Promise<FileLockGcRemoval> {
	const current = await readFileLockOwnerToken(lockDir);
	if (!current) return "missing";
	if (
		current.pid !== expected.pid ||
		current.timestamp !== expected.timestamp ||
		!sameStatToken(current.stat, expected.stat)
	) {
		return "owner_changed";
	}
	await fs.rm(lockDir, { recursive: true, force: true });
	return "removed";
}

type OwnerLiveness = "alive" | "dead" | "unknown";

function ownerLiveness(pid: number): OwnerLiveness {
	if (!Number.isFinite(pid) || pid <= 0) return "unknown";
	try {
		process.kill(pid, 0);
		return "alive";
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ESRCH") return "dead";
		// EPERM means the process exists but we may not signal it; treat as alive.
		// Anything else is indeterminate.
		return code === "EPERM" ? "alive" : "unknown";
	}
}

async function staleLockSnapshot(lockPath: string, staleMs: number): Promise<LockStaleSnapshot> {
	const owner = await readFileLockOwnerToken(lockPath);
	if (!owner) {
		const stat = await readLockDirStat(lockPath);
		if (!stat) return { stale: false };
		if (Date.now() - stat.mtimeMs <= staleMs) return { stale: false };
		return { stale: true, owner: null, stat };
	}

	// Never reap a live owner by elapsed time: a long legitimate critical section must
	// not have its lock stolen (GJC #652). Reclaim a dead owner immediately. Only when
	// owner liveness is indeterminate do we fall back to the staleMs elapsed-time heuristic.
	const liveness = ownerLiveness(owner.pid);
	if (liveness === "alive") return { stale: false };
	if (liveness === "dead" || Date.now() - owner.timestamp > staleMs) {
		return { stale: true, owner };
	}
	return { stale: false };
}

async function removeStaleLockForAcquire(lockPath: string, snapshot: LockStaleSnapshot): Promise<boolean> {
	if (!snapshot.stale) return false;
	if (snapshot.owner) {
		return (await removeFileLockDirForGc(lockPath, snapshot.owner)) === "removed";
	}

	const currentInfo = await readLockInfo(lockPath);
	if (currentInfo) return false;
	try {
		const currentStat = await readLockDirStat(lockPath);
		if (!currentStat) return false;
		if (!sameStatToken(currentStat, snapshot.stat)) return false;
		await fs.rm(lockPath, { recursive: true, force: true });
		return true;
	} catch (err) {
		if (isEnoent(err)) return false;
		throw err;
	}
}

async function tryAcquireLock(lockPath: string): Promise<FileLockOwnerToken | null> {
	try {
		await fs.mkdir(lockPath);
		const info = await writeLockInfo(lockPath);
		const stat = await readLockDirStat(lockPath);
		if (!stat) return null;
		return { ...info, stat };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			return null;
		}
		throw error;
	}
}

async function releaseLock(lockPath: string, owner: FileLockOwnerToken): Promise<void> {
	try {
		await removeFileLockDirForGc(lockPath, owner);
	} catch {
		// Ignore errors on release
	}
}

async function acquireLock(filePath: string, options: FileLockOptions = {}): Promise<() => Promise<void>> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const lockPath = getLockPath(filePath);

	for (let attempt = 0; attempt < opts.retries; attempt++) {
		const owner = await tryAcquireLock(lockPath);
		if (owner) {
			return () => releaseLock(lockPath, owner);
		}

		const stale = await staleLockSnapshot(lockPath, opts.staleMs);
		if (await removeStaleLockForAcquire(lockPath, stale)) {
			continue;
		}

		await Bun.sleep(opts.retryDelayMs);
	}

	throw new Error(`Failed to acquire lock for ${filePath} after ${opts.retries} attempts`);
}

export async function withFileLock<T>(
	filePath: string,
	fn: () => Promise<T>,
	options: FileLockOptions = {},
): Promise<T> {
	const release = await acquireLock(filePath, options);
	try {
		return await fn();
	} finally {
		await release();
	}
}
