import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assertSafeSessionId } from "../harness-control-plane/storage";
import { maskToken } from "./config";

/**
 * Operational snapshot of the session's currently-active ask, published into the discovery record so the
 * out-of-process managed daemon can decode compact button callbacks (which require the ask `options`) and
 * build a preliminary `RemoteActionContext`. Carries NO token, prompt body, or other secret — only the
 * routing-relevant action id and answer constraints. The session remains the final authority for
 * resolution; this is a best-effort hint for the daemon.
 */
export interface NotificationPendingActionSnapshot {
	actionId: string;
	options?: string[];
	allowFreeText?: boolean;
}

export interface NotificationEndpointRecord {
	version: number;
	sessionId: string;
	url: string;
	host: string;
	port: number;
	token: string;
	startedAt: number;
	updatedAt: number;
	pid: number;
	stale?: boolean;
	stoppedAt?: number;
	pendingAction?: NotificationPendingActionSnapshot;
}

export interface NotificationEndpointDisplay {
	version: number;
	sessionId: string;
	url: string;
	host: string;
	port: number;
	tokenMasked: string | null;
	startedAt: number;
	updatedAt: number;
	pid: number;
	stale: boolean;
	stoppedAt?: number;
}

export function notificationDiscoveryDir(stateRoot: string): string {
	return path.join(stateRoot, "notifications");
}

export function notificationDiscoveryPath(stateRoot: string, sessionId: string): string {
	assertSafeSessionId(sessionId);
	return path.join(notificationDiscoveryDir(stateRoot), `${sessionId}.json`);
}

async function ensurePrivateDirectory(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") {
		await fs.chmod(dir, 0o700);
	}
}

export async function writeNotificationDiscoveryRecord(
	stateRoot: string,
	record: NotificationEndpointRecord,
): Promise<string> {
	assertSafeSessionId(record.sessionId);
	const dir = notificationDiscoveryDir(stateRoot);
	await ensurePrivateDirectory(dir);
	const file = notificationDiscoveryPath(stateRoot, record.sessionId);
	const tmp = `${file}.tmp-${randomBytes(4).toString("hex")}`;
	await fs.writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	await fs.rename(tmp, file);
	if (process.platform !== "win32") {
		await fs.chmod(file, 0o600);
	}
	return file;
}

export async function removeNotificationDiscoveryRecord(stateRoot: string, sessionId: string): Promise<void> {
	const file = notificationDiscoveryPath(stateRoot, sessionId);
	try {
		await fs.unlink(file);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

export async function readNotificationDiscoveryRecord(
	stateRoot: string,
	sessionId: string,
): Promise<NotificationEndpointRecord | null> {
	const file = notificationDiscoveryPath(stateRoot, sessionId);
	try {
		const raw = await fs.readFile(file, "utf8");
		return JSON.parse(raw) as NotificationEndpointRecord;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export function toNotificationEndpointDisplay(record: NotificationEndpointRecord): NotificationEndpointDisplay {
	return {
		version: record.version,
		sessionId: record.sessionId,
		url: record.url,
		host: record.host,
		port: record.port,
		tokenMasked: maskToken(record.token),
		startedAt: record.startedAt,
		updatedAt: record.updatedAt,
		pid: record.pid,
		stale: record.stale ?? false,
		stoppedAt: record.stoppedAt,
	};
}
