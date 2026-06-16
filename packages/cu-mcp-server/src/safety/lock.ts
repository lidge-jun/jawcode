import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LOCK_DIR = join(homedir(), ".claude");
const LOCK_FILE = join(LOCK_DIR, "computer-use.lock");

interface LockInfo {
	sessionId: string;
	pid: number;
	acquiredAt: number;
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function acquireLock(sessionId: string): Promise<boolean> {
	await mkdir(LOCK_DIR, { recursive: true });

	try {
		const raw = await readFile(LOCK_FILE, "utf-8");
		const existing: LockInfo = JSON.parse(raw);

		// Same session — re-acquire
		if (existing.sessionId === sessionId) {
			return true;
		}

		// Different session — check if stale
		if (isProcessAlive(existing.pid)) {
			return false; // Another active session holds the lock
		}
		// Stale lock — clean up and proceed
	} catch {
		// No lock file or unreadable — proceed
	}

	const info: LockInfo = {
		sessionId,
		pid: process.pid,
		acquiredAt: Date.now(),
	};

	// Atomic write: write to temp file then rename (POSIX atomic)
	const tmpFile = join(LOCK_DIR, `computer-use.lock.${randomUUID()}.tmp`);
	await writeFile(tmpFile, JSON.stringify(info), "utf-8");
	await rename(tmpFile, LOCK_FILE);
	return true;
}

export async function releaseLock(sessionId: string): Promise<void> {
	try {
		const raw = await readFile(LOCK_FILE, "utf-8");
		const existing: LockInfo = JSON.parse(raw);
		if (existing.sessionId === sessionId) {
			await unlink(LOCK_FILE);
		}
	} catch {
		// Already gone
	}
}
