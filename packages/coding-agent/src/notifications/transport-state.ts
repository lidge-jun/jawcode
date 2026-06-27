import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { withFileLock } from "../config/file-lock";

export const DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS = 20_000;

export interface TransportIdentity {
	tokenFingerprint: string;
	chatIdFingerprint: string;
}

export interface TransportOwnerState extends TransportIdentity {
	version: 1;
	ownerId: string;
	pid: number;
	startedAt: number;
	heartbeatAt: number;
	stoppedAt?: number;
}

export interface TransportPaths {
	dir: string;
	ownerFile: string;
	rootsFile: string;
}

export interface TransportRootRecord {
	stateRoot: string;
	updatedAt: number;
}

export interface TransportRootsFile {
	version: 1;
	roots: TransportRootRecord[];
	sessions?: Record<string, string>;
}

export interface FreshLiveTransportOwnerInput extends TransportIdentity {
	owner: TransportOwnerState | null | undefined;
	now: number;
	ttlMs: number;
	pidAlive?: (pid: number) => boolean;
}

export function transportPaths(agentDir: string): TransportPaths {
	const dir = path.join(agentDir, "notifications", "telegram");
	return {
		dir,
		ownerFile: path.join(dir, "owner.json"),
		rootsFile: path.join(dir, "roots.json"),
	};
}

export function fingerprintSecret(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function sameTransportIdentity(owner: TransportIdentity, identity: TransportIdentity): boolean {
	return (
		owner.tokenFingerprint === identity.tokenFingerprint && owner.chatIdFingerprint === identity.chatIdFingerprint
	);
}

export function defaultPidAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

export function isFreshLiveTransportOwner(input: FreshLiveTransportOwnerInput): boolean {
	const { owner, now, ttlMs, pidAlive = defaultPidAlive, tokenFingerprint, chatIdFingerprint } = input;
	if (!owner || owner.stoppedAt !== undefined) return false;
	if (!sameTransportIdentity(owner, { tokenFingerprint, chatIdFingerprint })) return false;
	if (!pidAlive(owner.pid)) return false;
	return now - owner.heartbeatAt <= ttlMs;
}

export function markTransportOwnerStopped(owner: TransportOwnerState, now: number): TransportOwnerState {
	return { ...owner, stoppedAt: now };
}

async function ensurePrivateDirectory(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") {
		await fs.chmod(dir, 0o700);
	}
}

async function writePrivateJsonAtomic(file: string, value: unknown): Promise<void> {
	await ensurePrivateDirectory(path.dirname(file));
	const tmp = `${file}.tmp-${randomBytes(4).toString("hex")}`;
	await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	await fs.rename(tmp, file);
	if (process.platform !== "win32") {
		await fs.chmod(file, 0o600);
	}
}

export async function readTransportOwner(agentDir: string): Promise<TransportOwnerState | null> {
	try {
		const raw = await fs.readFile(transportPaths(agentDir).ownerFile, "utf8");
		return JSON.parse(raw) as TransportOwnerState;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export async function writeTransportOwner(agentDir: string, owner: TransportOwnerState): Promise<void> {
	await writePrivateJsonAtomic(transportPaths(agentDir).ownerFile, owner);
}

export async function readTransportRoots(agentDir: string): Promise<TransportRootsFile> {
	try {
		const raw = await fs.readFile(transportPaths(agentDir).rootsFile, "utf8");
		const parsed = JSON.parse(raw) as Partial<TransportRootsFile>;
		return {
			version: 1,
			roots: Array.isArray(parsed.roots) ? parsed.roots : [],
			sessions: parsed.sessions,
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, roots: [] };
		throw error;
	}
}

export async function writeTransportRoots(agentDir: string, rootsFile: TransportRootsFile): Promise<void> {
	const paths = transportPaths(agentDir);
	await ensurePrivateDirectory(paths.dir);
	await withFileLock(paths.rootsFile, async () => {
		await writePrivateJsonAtomic(paths.rootsFile, {
			version: 1,
			roots: rootsFile.roots,
			sessions: rootsFile.sessions,
		});
	});
}

export async function registerTransportRoot(
	agentDir: string,
	stateRoot: string,
	now: number,
): Promise<TransportRootsFile> {
	const absoluteStateRoot = path.resolve(stateRoot);
	const paths = transportPaths(agentDir);
	await ensurePrivateDirectory(paths.dir);
	return withFileLock(paths.rootsFile, async () => {
		const current = await readTransportRoots(agentDir);
		const roots = current.roots.filter(root => root.stateRoot !== absoluteStateRoot);
		roots.push({ stateRoot: absoluteStateRoot, updatedAt: now });
		const next: TransportRootsFile = { version: 1, roots, sessions: current.sessions };
		await writePrivateJsonAtomic(paths.rootsFile, next);
		return next;
	});
}
